# app/api/routes/workspaces.py
#
# Workspace CRUD routes and dashboard stats.
#
# ROUTES:
#   POST   /workspaces              → create a new workspace
#   GET    /workspaces              → list all workspaces for this merchant
#   GET    /workspaces/{id}         → get a single workspace
#   PATCH  /workspaces/{id}         → update workspace settings
#   DELETE /workspaces/{id}         → delete a workspace
#   GET    /workspaces/{id}/stats   → dashboard summary stats

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Merchant, Workspace, Customer, PaymentStatus, Payment
from app.schemas.workspace import (
    WorkspaceCreate, WorkspaceUpdate, WorkspaceOut, WorkspaceStats
)
from app.api.routes.auth import get_current_merchant

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])


# ── Create Workspace ──────────────────────────────────────────────────────────

@router.post("", response_model=WorkspaceOut, status_code=201)
def create_workspace(
    payload : WorkspaceCreate,
    db      : Session  = Depends(get_db),
    merchant: Merchant = Depends(get_current_merchant),   # requires auth
):
    """
    Create a new workspace (e.g. "Sunrise Apartments" as a landlord workspace).
    The merchant_id is taken from the logged-in user's token — not from the request.
    This means a merchant can only create workspaces for themselves.
    """
    workspace = Workspace(
        merchant_id          = merchant.id,    # always the logged-in merchant's ID
        name                 = payload.name,
        type                 = payload.type,
        carry_forward_credit = payload.carry_forward_credit,
    )
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return workspace


# ── List Workspaces ───────────────────────────────────────────────────────────

@router.get("", response_model=list[WorkspaceOut])
def list_workspaces(
    db      : Session  = Depends(get_db),
    merchant: Merchant = Depends(get_current_merchant),
):
    """
    Get all workspaces belonging to the logged-in merchant.
    DATA ISOLATION: we filter by merchant.id so merchants can never see each other's data.
    """
    return (
        db.query(Workspace)
        .filter(Workspace.merchant_id == merchant.id)
        .order_by(Workspace.created_at)
        .all()
    )


# ── Get Single Workspace ──────────────────────────────────────────────────────

@router.get("/{workspace_id}", response_model=WorkspaceOut)
def get_workspace(
    workspace_id: str,
    db          : Session  = Depends(get_db),
    merchant    : Merchant = Depends(get_current_merchant),
):
    """
    Get a single workspace by ID.
    Returns 404 if workspace doesn't exist OR belongs to a different merchant.
    """
    return _get_workspace_or_404(db, workspace_id, merchant.id)


# ── Update Workspace ──────────────────────────────────────────────────────────

@router.patch("/{workspace_id}", response_model=WorkspaceOut)
def update_workspace(
    workspace_id: str,
    payload     : WorkspaceUpdate,
    db          : Session  = Depends(get_db),
    merchant    : Merchant = Depends(get_current_merchant),
):
    """
    Update workspace settings (name or carry_forward_credit toggle).
    We use PATCH (not PUT) because we only update fields that are provided.
    """
    workspace = _get_workspace_or_404(db, workspace_id, merchant.id)

    # Only update fields that were actually provided in the request
    # model_dump(exclude_none=True) returns only non-None fields
    update_data = payload.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(workspace, field, value)   # dynamically set each field

    db.commit()
    db.refresh(workspace)
    return workspace


# ── Delete Workspace ──────────────────────────────────────────────────────────

@router.delete("/{workspace_id}", status_code=204)
def delete_workspace(
    workspace_id: str,
    db          : Session  = Depends(get_db),
    merchant    : Merchant = Depends(get_current_merchant),
):
    """
    Delete a workspace and all its customers/payments (cascade delete).
    204 = No Content — success with no response body.
    """
    workspace = _get_workspace_or_404(db, workspace_id, merchant.id)
    db.delete(workspace)
    db.commit()
    # No return needed for 204


# ── Workspace Stats (Dashboard) ───────────────────────────────────────────────

@router.get("/{workspace_id}/stats", response_model=WorkspaceStats)
def get_workspace_stats(
    workspace_id: str,
    db          : Session  = Depends(get_db),
    merchant    : Merchant = Depends(get_current_merchant),
):
    """
    Return summary statistics for the workspace dashboard:
    - How many customers total
    - Total amount collected
    - Total amount still outstanding
    - Breakdown by payment status
    """
    # Verify the workspace belongs to this merchant
    _get_workspace_or_404(db, workspace_id, merchant.id)

    # Fetch all customers in this workspace
    customers = (
        db.query(Customer)
        .filter(Customer.workspace_id == workspace_id)
        .all()
    )

    # Calculate total collected across all customers
    total_collected = sum(float(c.running_total or 0) for c in customers)

    # Calculate outstanding — what's still owed by unpaid customers
    total_outstanding = sum(
        max(0, float(c.expected_amount) - float(c.running_total or 0))
        for c in customers
        if c.status in [
            PaymentStatus.pending,
            PaymentStatus.partially_paid,
            PaymentStatus.overdue,
        ]
    )

    return WorkspaceStats(
        total_customers   = len(customers),
        total_collected   = round(total_collected, 2),
        total_outstanding = round(total_outstanding, 2),
        total_overdue     = sum(1 for c in customers if c.status == PaymentStatus.overdue),
        total_paid        = sum(1 for c in customers if c.status == PaymentStatus.paid),
        total_partial     = sum(1 for c in customers if c.status == PaymentStatus.partially_paid),
        total_pending     = sum(1 for c in customers if c.status == PaymentStatus.pending),
    )


# ── Reusable Helper ───────────────────────────────────────────────────────────

def _get_workspace_or_404(db: Session, workspace_id: str, merchant_id: str) -> Workspace:
    """
    Fetch a workspace by ID, ensuring it belongs to the given merchant.

    This is our DATA ISOLATION guard — even if someone knows another
    merchant's workspace ID, they can't access it because we always
    filter by both workspace_id AND merchant_id together.

    Raises 404 if not found (instead of 403 Forbidden, so we don't
    reveal that the workspace exists but belongs to someone else).
    """
    workspace = (
        db.query(Workspace)
        .filter(
            Workspace.id          == workspace_id,
            Workspace.merchant_id == merchant_id,   # ← DATA ISOLATION
        )
        .first()
    )

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )

    return workspace

@router.get("/{workspace_id}/activity")
def get_workspace_activity(
    workspace_id: str,
    limit       : int = 20,
    db          : Session  = Depends(get_db),
    merchant    : Merchant = Depends(get_current_merchant),
):
    """
    Fetch recent payment activity across all customers in a workspace.
    Powers the reconciliation activity feed on the dashboard.
    """
    _get_workspace_or_404(db, workspace_id, merchant.id)

    # Join payments with customers to get customer names
    results = (
        db.query(Payment, Customer)
        .join(Customer, Payment.customer_id == Customer.id)
        .filter(Payment.workspace_id == workspace_id)
        .order_by(Payment.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id"             : payment.id,
            "customer_name"  : customer.name,
            "customer_id"    : customer.id,
            "amount_paid"    : float(payment.amount_paid),
            "running_total"  : float(payment.running_total),
            "expected_amount": float(payment.expected_amount),
            "shortfall"      : float(payment.shortfall),
            "credit_balance" : float(payment.credit_balance),
            "status"         : payment.status.value,
            "created_at"     : payment.created_at.isoformat(),
        }
        for payment, customer in results
    ]
