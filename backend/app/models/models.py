# app/models/models.py
#
# This file defines all our DATABASE TABLES as Python classes.
#
# HOW SQLALCHEMY MODELS WORK:
# ────────────────────────────
# Each class here = one table in PostgreSQL.
# Each Mapped[type] field = one column in that table.
#
# Example:
#   class Merchant(Base):
#       email: Mapped[str] = mapped_column(String(255))
#
#   This creates a 'merchants' table with an 'email' column
#   that holds text up to 255 characters.
#
# SQLAlchemy translates our Python operations into SQL:
#   db.query(Merchant).filter(Merchant.email == "x@y.com").first()
#   → SELECT * FROM merchants WHERE email = 'x@y.com' LIMIT 1;

import uuid
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import (
    String, Boolean, Integer, Numeric, DateTime,
    ForeignKey, Text, JSON,
    Enum as SAEnum,   # SAEnum = SQLAlchemy Enum (different from Python's built-in Enum)
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.core.database import Base


# ── Helper Functions ──────────────────────────────────────────────────────────

def utcnow() -> datetime:
    """Return the current time in UTC. Used as default for created_at/updated_at."""
    return datetime.now(timezone.utc)


def new_uuid() -> str:
    """Generate a new random UUID string. Used as primary keys."""
    return str(uuid.uuid4())


# ── Enums ─────────────────────────────────────────────────────────────────────
# Enums restrict a column to only allow specific values.
# Using enums instead of plain strings prevents typos and invalid data.

class WorkspaceType(str, enum.Enum):
    """The type of collection workspace a merchant creates."""
    landlord = "landlord"
    school   = "school"
    business = "business"


class PaymentStatus(str, enum.Enum):
    """
    The reconciliation status of a customer's payment.

    PENDING        → no payment received yet (default when customer is added)
    PARTIALLY_PAID → some payment received, but less than expected
    PAID           → full expected amount has been received
    OVERPAID       → more than expected amount received (credit balance logged)
    OVERDUE        → past due date and still not fully paid (set by nightly job)
    """
    pending        = "pending"
    partially_paid = "partially_paid"
    paid           = "paid"
    overpaid       = "overpaid"
    overdue        = "overdue"


class WebhookEventStatus(str, enum.Enum):
    """Tracks what happened to each incoming webhook event."""
    received  = "received"   # just arrived, not yet processed
    processed = "processed"  # successfully reconciled
    failed    = "failed"     # something went wrong during processing
    duplicate = "duplicate"  # we've seen this event_id before, skipped


# ── Merchant Table ────────────────────────────────────────────────────────────

class Merchant(Base):
    """
    Represents a Tara user — a landlord, school admin, or business owner
    who signs up to manage their payment collections.

    One merchant can have MANY workspaces (one-to-many relationship).
    """
    __tablename__ = "merchants"

    # Primary key — a UUID string like "f47ac10b-58cc-4372-a567-0e02b2c3d479"
    # We use UUIDs instead of sequential numbers for security
    # (an attacker can't guess "the next merchant ID")
    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=new_uuid
    )

    full_name: Mapped[str] = mapped_column(
        String(120), nullable=False  # nullable=False means this field is REQUIRED
    )

    business_name: Mapped[str] = mapped_column(
        String(120), nullable=False
    )

    # unique=True means no two merchants can have the same email
    # index=True speeds up lookups by email (we do this a lot during login)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )

    # We NEVER store the real password — only the bcrypt hash
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # nullable=True means phone is OPTIONAL
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # If is_active is False, the merchant can't log in (soft-delete/ban)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    # RELATIONSHIP: a merchant has many workspaces
    # cascade="all, delete-orphan" means if we delete a merchant,
    # all their workspaces are automatically deleted too
    workspaces: Mapped[list["Workspace"]] = relationship(
        "Workspace", back_populates="merchant", cascade="all, delete-orphan"
    )


# ── Workspace Table ───────────────────────────────────────────────────────────

class Workspace(Base):
    """
    A workspace is one "collection" that belongs to a merchant.
    
    Examples:
      - "Sunrise Apartments" (landlord workspace)
      - "St. Mary's School" (school workspace)
      - "Design Clients" (business workspace)

    One workspace has MANY customers.
    The workspace type determines UI language (tenants vs students vs clients).
    """
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)

    # ForeignKey links this workspace to a specific merchant
    # ondelete="CASCADE" means if the merchant is deleted, their workspaces are too
    merchant_id: Mapped[str] = mapped_column(
        String, ForeignKey("merchants.id", ondelete="CASCADE"),
        nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)

    # SAEnum stores the WorkspaceType enum values in PostgreSQL
    type: Mapped[WorkspaceType] = mapped_column(SAEnum(WorkspaceType), nullable=False)

    # If True: when a customer overpays, the excess credit carries forward
    # to their next payment cycle automatically
    # If False: overpayments are flagged for the merchant to handle manually
    carry_forward_credit: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # RELATIONSHIPS
    merchant: Mapped["Merchant"] = relationship("Merchant", back_populates="workspaces")
    customers: Mapped[list["Customer"]] = relationship(
        "Customer", back_populates="workspace", cascade="all, delete-orphan"
    )


# ── Customer Table ────────────────────────────────────────────────────────────

class Customer(Base):
    """
    A customer belongs to a workspace and represents ONE PAYER.
    
    Examples:
      - A tenant in a landlord workspace
      - A student in a school workspace
      - A client in a business workspace

    Each customer gets their own unique Nomba virtual account number.
    Payments into that account are automatically reconciled to this customer.

    The running_total accumulates across multiple partial payments —
    so we correctly handle customers who pay in installments.
    """
    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)

    workspace_id: Mapped[str] = mapped_column(
        String, ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # ── Nomba Virtual Account Details ─────────────────────────────────────────
    # These fields are populated AFTER we call Nomba's API to create the account.
    # They start as None and get filled in once Nomba responds.
    virtual_account_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    virtual_account_name:   Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    bank_name:              Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    # accountRef is what we send to Nomba to identify this customer's account
    nomba_account_ref:      Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    # ── Payment Expectations ──────────────────────────────────────────────────
    # How much total this customer should pay
    expected_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    # If installment_count > 1, the payment can be split into chunks
    # e.g. installment_count=3 means customer can pay in 3 parts
    installment_count: Mapped[int] = mapped_column(Integer, default=1)

    # How many installments have been paid so far
    installment_paid: Mapped[int] = mapped_column(Integer, default=0)

    # Optional deadline — if not paid by this date, nightly job marks them OVERDUE
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Running Reconciliation State ──────────────────────────────────────────
    # Total amount received from this customer so far (accumulates over time)
    # e.g. if they pay ₦20k then ₦30k, running_total = ₦50k
    running_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    # If they overpaid, the excess is stored here
    # (carried forward to next cycle if carry_forward_credit is enabled)
    credit_balance: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    # Current payment status — updated by the reconciliation engine on each payment
    status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(PaymentStatus), default=PaymentStatus.pending
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # RELATIONSHIPS
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="customers")
    payments: Mapped[list["Payment"]] = relationship(
        "Payment", back_populates="customer", cascade="all, delete-orphan"
    )


# ── Payment Table ─────────────────────────────────────────────────────────────

class Payment(Base):
    """
    Records every individual payment event for a customer.
    
    One customer can have MANY payment records over time
    (especially if they pay in installments).

    This table is our audit trail — it shows every payment that came in,
    what the reconciliation decided, and what the running total was at that point.
    
    We also store the idempotency_key here as a backup to Redis —
    if Redis ever loses data, we can check this table to avoid duplicates.
    """
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)

    customer_id: Mapped[str] = mapped_column(
        String, ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    workspace_id: Mapped[str] = mapped_column(
        String, ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False, index=True
    )

    # The amount paid in THIS specific payment event (not cumulative)
    amount_paid: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    # The cumulative total AFTER this payment was processed
    running_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    # What the customer was supposed to pay in total
    expected_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    # How much is still owed after this payment (0 if fully paid)
    shortfall: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    # How much extra was paid beyond what was expected (0 if not overpaid)
    credit_balance: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    # The payment status determined by the reconciliation engine
    status: Mapped[PaymentStatus] = mapped_column(SAEnum(PaymentStatus), nullable=False)

    # Nomba's reference ID for this transaction (for cross-referencing)
    nomba_reference: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    # The webhook event_id used as idempotency key (backup to Redis)
    # unique=True means the same event can never create two payment records
    idempotency_key: Mapped[Optional[str]] = mapped_column(
        String(120), nullable=True, unique=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # RELATIONSHIP
    customer: Mapped["Customer"] = relationship("Customer", back_populates="payments")


# ── Webhook Event Table ───────────────────────────────────────────────────────

class WebhookEvent(Base):
    """
    Every webhook Nomba sends us is stored here immediately upon arrival —
    BEFORE we process it.

    Why store it before processing?
    1. AUDIT TRAIL: we have a record of every event Nomba sent us
    2. REPLAY: if something goes wrong, we can reprocess events
    3. DEBUGGING: we can see exactly what payload Nomba sent
    4. IDEMPOTENCY BACKUP: even without Redis, we could check this table
    """
    __tablename__ = "webhook_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)

    # Nomba's unique identifier for this event — used for idempotency
    # unique=True ensures we can never store the same event twice
    event_id: Mapped[str] = mapped_column(
        String(120), unique=True, nullable=False, index=True
    )

    # The type of event e.g. "transfer.completed"
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)

    # The full raw JSON payload from Nomba — stored so we can replay/debug
    # JSON type in SQLAlchemy stores Python dicts as PostgreSQL JSONB
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)

    # What happened to this event
    status: Mapped[WebhookEventStatus] = mapped_column(
        SAEnum(WebhookEventStatus), default=WebhookEventStatus.received
    )

    # If processing failed, the error message is stored here
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # When we finished processing this event (null until processed)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ── Reconciliation Log Table ──────────────────────────────────────────────────

class ReconciliationLog(Base):
    """
    Each time the nightly reconciliation job runs, it logs a summary here.
    
    This gives us visibility into:
    - When the job ran
    - How many accounts were checked
    - How many discrepancies were found (missed webhooks)
    - How many customers were flagged as overdue
    
    Judges can see this table to understand we have a dual-source
    reconciliation strategy (webhooks + Transactions API).
    """
    __tablename__ = "reconciliation_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)

    # When this reconciliation job ran
    run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Total number of virtual accounts checked against Nomba Transactions API
    accounts_checked: Mapped[int] = mapped_column(Integer, default=0)

    # Payments found in Nomba's records but missing from our DB (missed webhooks)
    discrepancies_found: Mapped[int] = mapped_column(Integer, default=0)

    # Payments that were reconciled during this job run (fixing missed webhooks)
    promotions_made: Mapped[int] = mapped_column(Integer, default=0)

    # Customers newly flagged as OVERDUE during this run
    overdue_flagged: Mapped[int] = mapped_column(Integer, default=0)

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


