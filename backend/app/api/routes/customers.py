# app/api/routes/customers.py
#
# Customer management routes including bulk CSV import.
#
# ROUTES:
#   POST   /workspaces/{id}/customers         → add one customer
#   GET    /workspaces/{id}/customers         → list all customers
#   GET    /workspaces/{id}/customers/{id}    → get single customer
#   PATCH  /workspaces/{id}/customers/{id}    → update customer
#   DELETE /workspaces/{id}/customers/{id}    → delete customer
#   GET    /workspaces/{id}/customers/{id}/payments  → payment history
#   POST   /workspaces/{id}/customers/import  → bulk CSV import
#
# Notice all routes are nested under /workspaces/{workspace_id}/customers
# This is called "nested routing" — it makes the relationship clear
# and ensures data isolation (you must own the workspace to access its customers)

import csv
import io
import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Merchant, Customer, Payment
from app.schemas.workspace import (
    CustomerCreate, CustomerUpdate, CustomerOut, CSVImportResult
)
from app.services.nomba import nomba_service
from app.api.routes.auth import get_current_merchant
from app.api.routes.workspaces import _get_workspace_or_404

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/workspaces/{workspace_id}/customers",
    tags=["Customers"],
)


# ── Create Single Customer ────────────────────────────────────────────────────

@router.post("", response_model=CustomerOut, status_code=201)
async def create_customer(
    workspace_id: str,
    payload     : CustomerCreate,
    db          : Session  = Depends(get_db),
    merchant    : Merchant = Depends(get_current_merchant),
):
    """
    Add a single customer to a workspace.

    After creating the customer record in our DB, we immediately call
    Nomba's API to create a virtual account for them.

    Why async? Because we call Nomba's external API (network call)
    — using async lets FastAPI handle other requests while we wait.
    """
    # Verify the workspace belongs to this merchant
    workspace = _get_workspace_or_404(db, workspace_id, merchant.id)

    # Create customer record in our database first
    customer = Customer(
        workspace_id      = workspace_id,
        name              = payload.name,
        email             = payload.email,
        phone             = payload.phone,
        expected_amount   = payload.expected_amount,
        installment_count = payload.installment_count,
        due_date          = payload.due_date,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)  # loads the generated ID from DB

    # Now call Nomba API to create the virtual account
    # We pass the customer's Tara ID as accountRef so we can identify them from webhooks
    logger.info(f"Creating Nomba virtual account for customer: {customer.name}")
    account = await nomba_service.create_virtual_account(
        customer_name = customer.name,
        customer_id   = customer.id,
        business_name = merchant.business_name,
    )

    if account:
        # Store the virtual account details on the customer record
        customer.virtual_account_number = account["account_number"]
        customer.virtual_account_name   = account["account_name"]
        customer.bank_name              = account["bank_name"]
        customer.nomba_account_ref      = account["account_ref"]
        db.commit()
        db.refresh(customer)
        logger.info(f"Virtual account created: {account['account_number']}")
    else:
        # Nomba call failed — customer is created but has no virtual account yet
        # We log the error but don't delete the customer — can retry later
        logger.error(
            f"Failed to create Nomba virtual account for customer {customer.id} "
            f"({customer.name}). Customer created without virtual account."
        )

    return customer


# ── List Customers ────────────────────────────────────────────────────────────

@router.get("", response_model=list[CustomerOut])
def list_customers(
    workspace_id: str,
    db          : Session  = Depends(get_db),
    merchant    : Merchant = Depends(get_current_merchant),
):
    """Get all customers in a workspace, ordered by creation date."""
    # Verify workspace ownership (data isolation)
    _get_workspace_or_404(db, workspace_id, merchant.id)

    return (
        db.query(Customer)
        .filter(Customer.workspace_id == workspace_id)
        .order_by(Customer.created_at)
        .all()
    )


# ── Get Single Customer ───────────────────────────────────────────────────────

@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(
    workspace_id: str,
    customer_id : str,
    db          : Session  = Depends(get_db),
    merchant    : Merchant = Depends(get_current_merchant),
):
    """Get a single customer's details."""
    _get_workspace_or_404(db, workspace_id, merchant.id)
    return _get_customer_or_404(db, customer_id, workspace_id)


# ── Update Customer ───────────────────────────────────────────────────────────

@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(
    workspace_id: str,
    customer_id : str,
    payload     : CustomerUpdate,
    db          : Session  = Depends(get_db),
    merchant    : Merchant = Depends(get_current_merchant),
):
    """Update customer details (name, email, phone, expected amount, etc.)."""
    _get_workspace_or_404(db, workspace_id, merchant.id)
    customer = _get_customer_or_404(db, customer_id, workspace_id)

    # Only update fields that were provided (PATCH semantics)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(customer, field, value)

    db.commit()
    db.refresh(customer)
    return customer


# ── Delete Customer ───────────────────────────────────────────────────────────

@router.delete("/{customer_id}", status_code=204)
def delete_customer(
    workspace_id: str,
    customer_id : str,
    db          : Session  = Depends(get_db),
    merchant    : Merchant = Depends(get_current_merchant),
):
    """Delete a customer and all their payment records."""
    _get_workspace_or_404(db, workspace_id, merchant.id)
    customer = _get_customer_or_404(db, customer_id, workspace_id)
    db.delete(customer)
    db.commit()


# ── Customer Payment History ──────────────────────────────────────────────────

@router.get("/{customer_id}/payments")
def get_customer_payments(
    workspace_id: str,
    customer_id : str,
    db          : Session  = Depends(get_db),
    merchant    : Merchant = Depends(get_current_merchant),
):
    """
    Get the full payment history for a customer.
    Shows every individual payment event — useful for the customer detail page.
    """
    _get_workspace_or_404(db, workspace_id, merchant.id)
    _get_customer_or_404(db, customer_id, workspace_id)

    payments = (
        db.query(Payment)
        .filter(Payment.customer_id == customer_id)
        .order_by(Payment.created_at.desc())   # newest first
        .all()
    )

    # Return as plain dicts — no response_model needed for flexible structure
    return [
        {
            "id"             : p.id,
            "amount_paid"    : float(p.amount_paid),
            "running_total"  : float(p.running_total),
            "expected_amount": float(p.expected_amount),
            "shortfall"      : float(p.shortfall),
            "credit_balance" : float(p.credit_balance),
            "status"         : p.status.value,
            "nomba_reference": p.nomba_reference,
            "created_at"     : p.created_at.isoformat(),
        }
        for p in payments
    ]


# ── Bulk CSV Import ───────────────────────────────────────────────────────────

@router.post("/import", response_model=CSVImportResult)
async def bulk_import_customers(
    workspace_id: str,
    file        : UploadFile = File(...),   # UploadFile handles file uploads
    db          : Session    = Depends(get_db),
    merchant    : Merchant   = Depends(get_current_merchant),
):
    """
    Import multiple customers from a CSV file.

    Expected CSV format (first row is header):
        name,email,phone,expected_amount,due_date
        John Doe,john@example.com,08012345678,50000,2024-03-01T00:00:00
        Jane Smith,,08098765432,75000,

    Required columns: name, expected_amount
    Optional columns: email, phone, due_date

    Returns a summary of how many succeeded/failed and why.

    THE WOW DEMO MOMENT:
    Upload 10 rows → watch 10 virtual accounts generate in seconds.
    """
    workspace = _get_workspace_or_404(db, workspace_id, merchant.id)

    # Validate file type
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="File must be a .csv file"
        )

    # Read the uploaded file content
    content = await file.read()

    # Decode bytes to string and create a CSV reader
    # io.StringIO turns the string into a file-like object that csv.DictReader can read
    try:
        text_content = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="File must be UTF-8 encoded"
        )

    reader = csv.DictReader(io.StringIO(text_content))

    # Track results
    total   = 0
    success = 0
    errors  = []

    for row_number, row in enumerate(reader, start=2):  # start=2 because row 1 is the header
        total += 1

        # Extract and validate required fields
        name = (row.get("name") or "").strip()
        expected_amount_str = (row.get("expected_amount") or "").strip()

        if not name:
            errors.append(f"Row {row_number}: 'name' column is required")
            continue

        if not expected_amount_str:
            errors.append(f"Row {row_number}: 'expected_amount' column is required")
            continue

        try:
            expected_amount = float(expected_amount_str)
            if expected_amount <= 0:
                errors.append(f"Row {row_number}: expected_amount must be greater than 0")
                continue
        except ValueError:
            errors.append(f"Row {row_number}: expected_amount '{expected_amount_str}' is not a valid number")
            continue

        # Parse optional due_date
        due_date = None
        due_date_str = (row.get("due_date") or "").strip()
        if due_date_str:
            try:
                from datetime import datetime
                due_date = datetime.fromisoformat(due_date_str)
            except ValueError:
                # Due date format is wrong — skip it but don't fail the whole row
                logger.warning(f"Row {row_number}: Could not parse due_date '{due_date_str}' — skipping due date")

        try:
            # Create the customer record
            customer = Customer(
                workspace_id    = workspace_id,
                name            = name,
                email           = (row.get("email") or "").strip() or None,
                phone           = (row.get("phone") or "").strip() or None,
                expected_amount = expected_amount,
                due_date        = due_date,
            )
            db.add(customer)
            db.flush()  # flush to get the customer.id WITHOUT committing yet
                        # We need the ID to pass to Nomba's API

            # Create Nomba virtual account for this customer
            account = await nomba_service.create_virtual_account(
                customer_name = customer.name,
                customer_id   = customer.id,
                business_name = merchant.business_name,
            )

            if account:
                customer.virtual_account_number = account["account_number"]
                customer.virtual_account_name   = account["account_name"]
                customer.bank_name              = account["bank_name"]
                customer.nomba_account_ref      = account["account_ref"]

            success += 1
            logger.info(f"CSV import row {row_number}: created customer {name}")

        except Exception as e:
            # Something went wrong for this specific row — log and continue
            errors.append(f"Row {row_number}: Failed to create customer — {str(e)}")
            db.rollback()   # undo this row's DB changes
            continue

    # Commit all successfully created customers at once
    db.commit()

    logger.info(
        f"CSV import complete: {success}/{total} succeeded, "
        f"{total - success} failed"
    )

    return CSVImportResult(
        total   = total,
        success = success,
        failed  = total - success,
        errors  = errors,
    )


# ── Reusable Helper ───────────────────────────────────────────────────────────

def _get_customer_or_404(db: Session, customer_id: str, workspace_id: str) -> Customer:
    """
    Fetch a customer ensuring they belong to the specified workspace.
    Raises 404 if not found.
    """
    customer = (
        db.query(Customer)
        .filter(
            Customer.id           == customer_id,
            Customer.workspace_id == workspace_id,  # ← DATA ISOLATION
        )
        .first()
    )
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )
    return customer
