# app/schemas/workspace.py
#
# Pydantic schemas for workspaces, customers, and related data.
# See app/schemas/auth.py for an explanation of what schemas are.

from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
from app.models.models import WorkspaceType, PaymentStatus


# ─────────────────────────────────────────────────────────────────────────────
# WORKSPACE SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class WorkspaceCreate(BaseModel):
    """Data required to create a new workspace."""
    name                : str
    type                : WorkspaceType   # must be "landlord", "school", or "business"
    carry_forward_credit: bool = False    # default: overpayments NOT auto-carried forward

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, value):
        if not value.strip():
            raise ValueError("Workspace name cannot be empty")
        return value.strip()


class WorkspaceUpdate(BaseModel):
    """
    Data allowed when updating a workspace.
    All fields are Optional — client only sends what they want to change.
    (This is the PATCH pattern — only update what's provided)
    """
    name                : Optional[str]  = None
    carry_forward_credit: Optional[bool] = None


class WorkspaceOut(BaseModel):
    """What we return when responding with workspace data."""
    id                  : str
    name                : str
    type                : WorkspaceType
    carry_forward_credit: bool
    created_at          : datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# CUSTOMER SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class CustomerCreate(BaseModel):
    """Data required to add a new customer to a workspace."""
    name             : str
    email            : Optional[str]     = None
    phone            : Optional[str]     = None
    expected_amount  : float             # how much this customer should pay in total
    installment_count: int = 1           # default: pay in one lump sum
    due_date         : Optional[datetime]= None   # optional payment deadline

    @field_validator("expected_amount")
    @classmethod
    def amount_must_be_positive(cls, value):
        if value <= 0:
            raise ValueError("Expected amount must be greater than zero")
        return value

    @field_validator("installment_count")
    @classmethod
    def installments_must_be_at_least_one(cls, value):
        if value < 1:
            raise ValueError("Installment count must be at least 1")
        return value


class CustomerUpdate(BaseModel):
    """Fields allowed when updating customer info (all optional)."""
    name             : Optional[str]      = None
    email            : Optional[str]      = None
    phone            : Optional[str]      = None
    expected_amount  : Optional[float]    = None
    installment_count: Optional[int]      = None
    due_date         : Optional[datetime] = None


class CustomerOut(BaseModel):
    """What we return when responding with customer data."""
    id                    : str
    workspace_id          : str
    name                  : str
    email                 : Optional[str]
    phone                 : Optional[str]
    virtual_account_number: Optional[str]   # filled after Nomba API call
    virtual_account_name  : Optional[str]
    bank_name             : Optional[str]
    expected_amount       : float
    installment_count     : int
    installment_paid      : int
    running_total         : float           # total received so far
    credit_balance        : float           # excess if overpaid
    status                : PaymentStatus   # current reconciliation status
    due_date              : Optional[datetime]
    created_at            : datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# UTILITY SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class CSVImportResult(BaseModel):
    """Summary returned after a bulk CSV import."""
    total  : int          # total rows in the CSV
    success: int          # rows successfully imported
    failed : int          # rows that had errors
    errors : list[str] = []   # list of error messages per failed row


class WorkspaceStats(BaseModel):
    """
    Dashboard summary statistics for a workspace.
    Returned by GET /workspaces/{id}/stats
    """
    total_customers  : int
    total_collected  : float   # sum of all running_totals
    total_outstanding: float   # sum of what's still owed
    total_overdue    : int     # count of OVERDUE customers
    total_paid       : int     # count of fully PAID customers
    total_partial    : int     # count of PARTIALLY_PAID customers
    total_pending    : int     # count of PENDING customers (no payment at all)
