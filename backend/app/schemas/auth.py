# app/schemas/auth.py
#
# SCHEMAS are Pydantic models that define the shape of data
# coming IN to our API (request bodies) and going OUT (responses).
#
# They are DIFFERENT from our SQLAlchemy models (which define DB tables).
# Think of it this way:
#   - SQLAlchemy model = blueprint for the DATABASE TABLE
#   - Pydantic schema  = blueprint for the API REQUEST/RESPONSE
#
# Pydantic automatically:
#   - Validates that required fields are present
#   - Converts types (e.g. "123" string → 123 int)
#   - Returns clear error messages for invalid data
#   - Strips extra fields the client shouldn't be sending

from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime


# ── Register Schema ───────────────────────────────────────────────────────────

class MerchantRegister(BaseModel):
    """Data required to create a new Tara account."""
    full_name    : str
    business_name: str
    email        : EmailStr   # EmailStr validates it's a properly formatted email
    password     : str
    phone        : Optional[str] = None   # Optional — not required

    @field_validator("password")
    @classmethod
    def password_must_be_strong_enough(cls, value):
        """
        @field_validator is a Pydantic decorator that runs custom validation
        on a specific field. If we raise ValueError, Pydantic returns a 422
        error to the client with our error message.
        """
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return value

    @field_validator("full_name", "business_name")
    @classmethod
    def fields_must_not_be_empty(cls, value):
        """Strip whitespace and make sure the field isn't just spaces."""
        if not value.strip():
            raise ValueError("This field cannot be empty")
        return value.strip()  # return cleaned value


# ── Login Schema ──────────────────────────────────────────────────────────────

class MerchantLogin(BaseModel):
    """Data required to log in."""
    email   : EmailStr
    password: str


# ── Token Response Schema ─────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    """
    What we send back after successful login or registration.
    The client stores these tokens and uses access_token for all API calls.
    """
    access_token : str
    refresh_token: str
    token_type   : str = "bearer"   # standard OAuth2 token type


# ── Refresh Request Schema ────────────────────────────────────────────────────

class RefreshRequest(BaseModel):
    """Sent by client when their access token expires and they need a new one."""
    refresh_token: str


# ── Merchant Response Schema ──────────────────────────────────────────────────

class MerchantOut(BaseModel):
    """
    What we return when someone requests merchant profile info (/auth/me).
    
    Notice: password_hash is NOT included here — we never send that to the client.
    Only include fields that are safe to expose.
    
    model_config = {"from_attributes": True} tells Pydantic it can read values
    directly from a SQLAlchemy model object (instead of only from dicts).
    """
    id           : str
    full_name    : str
    business_name: str
    email        : str
    phone        : Optional[str]
    created_at   : datetime

    model_config = {"from_attributes": True}
