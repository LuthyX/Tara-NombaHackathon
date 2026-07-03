# app/webhooks/handler.py
#
# This file handles incoming webhook notifications from Nomba.
#
# WHAT IS A WEBHOOK?
# ───────────────────
# Instead of us constantly asking Nomba "has anyone paid?",
# Nomba TELLS US the moment a payment happens by sending an HTTP POST
# request to our webhook URL with details about the payment.
#
# OUR WEBHOOK URL (what we submit to Nomba):
#   Development: https://abc123.ngrok.io/api/v1/webhooks/nomba
#   Production:  https://your-app.onrender.com/api/v1/webhooks/nomba
#
# THE SECURITY CHALLENGE:
# ────────────────────────
# Anyone on the internet could POST to our webhook URL.
# We need to verify that the request actually came from Nomba, not an attacker.
# Nomba signs each webhook with a HMAC-SHA256 signature using our webhook secret.
# We verify this signature before doing anything with the data.
#
# PROCESSING FLOW:
# ────────────────
# 1. Receive webhook → verify signature → reject if invalid
# 2. Parse JSON payload
# 3. Store event to DB immediately (audit trail)
# 4. Check Redis idempotency → skip if duplicate
# 5. Find customer by virtual account number
# 6. Run reconciliation engine
# 7. Commit everything atomically
# 8. Return 200 OK to Nomba

import hmac
import hashlib
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.redis import is_duplicate_event
from app.models.models import Customer, WebhookEvent, WebhookEventStatus
from app.services.reconciliation import reconcile_payment

logger = logging.getLogger(__name__)

# Create a router — this is like a mini-app that we attach to the main FastAPI app
router = APIRouter()


def verify_nomba_signature(raw_body: bytes, signature_header: str) -> bool:
    """
    Verify that a webhook request actually came from Nomba.

    Nomba computes: HMAC-SHA256(webhook_secret, request_body)
    and sends the result in the 'x-nomba-signature' header.

    We compute the same thing on our side and compare.
    If they match → request is genuine.
    If they don't → someone is trying to fake a payment notification.

    Why hmac.compare_digest() instead of ==?
    Using == to compare strings leaks timing information — an attacker
    can measure how long the comparison takes to guess the secret one
    character at a time. compare_digest() always takes the same time.
    """
    # Compute what the signature SHOULD be
    expected_signature = hmac.new(
        settings.NOMBA_WEBHOOK_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    # Safe constant-time comparison
    return hmac.compare_digest(expected_signature, signature_header)


@router.post("/webhooks/nomba")
async def handle_nomba_webhook(
    request: Request,
    db     : Session = Depends(get_db),
):
    """
    Main webhook endpoint. Nomba POSTs here when a payment is made.

    We always return 200 OK after storing the event — even if processing fails.
    Why? Because if we return 4xx/5xx, Nomba will keep retrying, which can
    cause duplicate processing. We handle retries ourselves via idempotency.
    """

    # ── Step 1: Read the raw request body ─────────────────────────────────────
    # We need the RAW bytes to verify the signature.
    # If we parsed it first, the byte order might change and break signature verification.
    raw_body = await request.body()

    # ── Step 2: Verify webhook signature ──────────────────────────────────────
    # Get Nomba's signature from the request header
    signature = request.headers.get("nomba-signature", "")

    if not signature:
        logger.warning("Webhook received with no signature header — rejected")
        raise HTTPException(status_code=401, detail="Missing webhook signature")

    if not verify_nomba_signature(raw_body, signature):
        logger.warning("Webhook received with INVALID signature — potential attack, rejected")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    logger.info("Webhook signature verified ✅")

    # ── Step 3: Parse the JSON payload ────────────────────────────────────────
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        logger.error("Webhook payload is not valid JSON")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    # Extract the event ID and type from the payload
    # Nomba may use different field names — we check multiple possibilities
    event_id   = payload.get("eventId") or payload.get("id") or ""
    event_type = payload.get("eventType") or payload.get("type") or ""

    if not event_id:
        logger.error("Webhook payload missing event ID")
        raise HTTPException(status_code=400, detail="Missing event ID in payload")

    logger.info(f"Webhook received: type={event_type} event_id={event_id}")

    # ── Step 4: Store event to DB immediately ─────────────────────────────────
    # We store BEFORE processing so we have an audit trail even if processing fails.
    # unique constraint on event_id means this will fail if truly duplicate —
    # in that case we catch the error and return early.
    try:
        webhook_event = WebhookEvent(
            event_id  = event_id,
            event_type= event_type,
            payload   = payload,
            status    = WebhookEventStatus.received,
        )
        db.add(webhook_event)
        db.flush()   # send to DB but don't commit yet — we commit everything together later
    except Exception:
        # unique constraint violation — this event_id already exists in DB
        db.rollback()
        logger.info(f"Event {event_id} already in DB — duplicate, skipping")
        return {"status": "duplicate", "event_id": event_id}

    # ── Step 5: Check Redis idempotency ───────────────────────────────────────
    # Double-check with Redis (faster than DB) — belt and suspenders approach
    if is_duplicate_event(event_id):
        webhook_event.status = WebhookEventStatus.duplicate
        db.commit()
        logger.info(f"Event {event_id} found in Redis — duplicate, skipping")
        return {"status": "duplicate", "event_id": event_id}

    # ── Step 6: Process the event ─────────────────────────────────────────────
    # We only process payment completion events — ignore everything else
    PAYMENT_EVENT_TYPES = {
        "transfer.completed",
        "TRANSFER_COMPLETED",
        "virtual_account.credit",
        "VIRTUAL_ACCOUNT_CREDIT",
    }

    if event_type in PAYMENT_EVENT_TYPES:
        try:
            await _process_payment_event(db, payload, webhook_event)
        except Exception as e:
            # Processing failed — log the error, mark event as failed
            # but still return 200 to stop Nomba from retrying
            logger.error(f"Failed to process payment event {event_id}: {str(e)}", exc_info=True)
            webhook_event.status        = WebhookEventStatus.failed
            webhook_event.error_message = str(e)
            db.commit()
            return {"status": "error", "event_id": event_id, "message": str(e)}
    else:
        # Event type we don't handle — just mark as processed and move on
        logger.info(f"Unhandled event type '{event_type}' — ignoring")
        webhook_event.status = WebhookEventStatus.processed
        db.commit()

    return {"status": "ok", "event_id": event_id}


async def _process_payment_event(
    db           : Session,
    payload      : dict,
    webhook_event: WebhookEvent,
) -> None:
    """
    Extract payment details from the webhook payload and trigger reconciliation.

    The payload structure from Nomba looks something like:
    {
      "eventId": "abc-123",
      "eventType": "transfer.completed",
      "data": {
        "destinationAccountNumber": "9391076543",
        "amount": 5000000,           ← in kobo (divide by 100 for naira)
        "transactionReference": "TXN_xyz"
      }
    }

    ATOMIC COMMIT:
    We commit the payment record AND the webhook event status update together.
    If either fails, both are rolled back. This ensures we never have a state
    where the payment is recorded but the webhook is still marked 'received'.
    """
    # The actual payment data is nested inside "data"
    data = payload.get("data", payload)

    # Extract the virtual account number that received the payment
    # Nomba may use different field names — check all possibilities
    account_number = (
        data.get("destinationAccountNumber")
        or data.get("accountNumber")
        or data.get("virtualAccountNumber")
        or ""
    )

    if not account_number:
        raise ValueError(
            f"Could not find account number in webhook payload. "
            f"Available keys: {list(data.keys())}"
        )

    # Extract the amount
    # Nomba sends amounts in KOBO (like cents — 100 kobo = 1 naira)
    # If amount > 100, it's likely in kobo. If ≤ 100, it might already be naira.
    raw_amount   = data.get("amount", 0)
    amount_naira = float(raw_amount) / 100 if float(raw_amount) > 100 else float(raw_amount)

    # Nomba's reference for this transaction
    nomba_reference = (
        data.get("transactionReference")
        or data.get("reference")
        or webhook_event.event_id
    )

    logger.info(
        f"Processing payment: account={account_number} "
        f"amount=₦{amount_naira:,.2f} ref={nomba_reference}"
    )

    # ── Find the customer — belt and suspenders approach ─────────────────────
    #
    # We try THREE methods to identify the customer from the webhook payload:
    #
    # Method 1 — by virtual account NUMBER (most reliable)
    #   The webhook includes the account number that received the payment.
    #   We match it against customer.virtual_account_number in our DB.
    #
    # Method 2 — by accountRef matched to customer.id (fallback)
    #   When we created the virtual account, we passed customer.id as accountRef.
    #   Nomba echoes this back in the webhook payload.
    #
    # Method 3 — by nomba_account_ref stored on customer (last resort)
    #   The accountRef Nomba returned when we created the account.

    customer = None

    # Method 1 — look up by virtual account number
    if account_number:
        customer = db.query(Customer).filter(
            Customer.virtual_account_number == account_number
        ).first()
        if customer:
            logger.info(f"Customer identified by account number: {customer.name}")

    # Method 2 — fall back to accountRef (which we set to customer.id)
    if not customer:
        account_ref = (
            data.get("accountRef")
            or data.get("accountReference")
            or data.get("customerRef")
            or ""
        )
        if account_ref:
            customer = db.query(Customer).filter(
                Customer.id == account_ref
            ).first()
            if customer:
                logger.info(f"Customer identified by accountRef: {customer.name}")

    # Method 3 — by nomba_account_ref stored on customer
    if not customer:
        account_ref = (
            data.get("accountRef")
            or data.get("accountReference")
            or ""
        )
        if account_ref:
            customer = db.query(Customer).filter(
                Customer.nomba_account_ref == account_ref
            ).first()
            if customer:
                logger.info(f"Customer identified by nomba_account_ref: {customer.name}")

    if not customer:
        logger.warning(
            f"No customer found for webhook event. "
            f"account_number={account_number} "
            f"accountRef={data.get('accountRef', 'N/A')} "
            f"Available payload keys: {list(data.keys())}"
        )
        webhook_event.status        = WebhookEventStatus.processed
        webhook_event.error_message = (
            f"No Tara customer matched. "
            f"account_number={account_number} "
            f"accountRef={data.get('accountRef', 'N/A')}"
        )
        db.add(webhook_event)
        db.commit()
        return

    # ── Run the reconciliation engine ─────────────────────────────────────────
    # This updates the customer's status and creates a Payment record.
    # It does NOT commit — we do that below, atomically with the event update.
    payment = reconcile_payment(
        db             = db,
        customer       = customer,
        amount_paid    = amount_naira,
        nomba_reference= nomba_reference,
        idempotency_key= webhook_event.event_id,
    )

    # ── Mark webhook as successfully processed ────────────────────────────────
    webhook_event.status       = WebhookEventStatus.processed
    webhook_event.processed_at = datetime.now(timezone.utc)
    db.add(webhook_event)

    # ── ATOMIC COMMIT ─────────────────────────────────────────────────────────
    # Both the payment record AND the webhook event status are committed together.
    # Either both succeed or both fail — no partial state.
    db.commit()

    logger.info(
        f"✅ Payment reconciled: {customer.name} paid ₦{amount_naira:,.2f} "
        f"— new status: {payment.status.value}"
    )
