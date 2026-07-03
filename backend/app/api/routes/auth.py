# app/api/routes/auth.py
#
# Authentication routes and the get_current_merchant dependency.
#
# ROUTES IN THIS FILE:
#   POST /auth/register  → create new merchant account
#   POST /auth/login     → log in, get tokens
#   POST /auth/refresh   → get new access token using refresh token
#   GET  /auth/me        → get logged-in merchant's profile
#
# THE AUTH DEPENDENCY:
# ─────────────────────
# get_current_merchant() is used by ALL protected routes via Depends().
# It reads the Bearer token from the request header, decodes it,
# and returns the logged-in Merchant object.
#
# Usage in other route files:
#   def my_route(merchant: Merchant = Depends(get_current_merchant)):
#       # merchant is guaranteed to be a valid, active Merchant

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.models.models import Merchant
from app.schemas.auth import (
    MerchantRegister,
    MerchantLogin,
    TokenResponse,
    RefreshRequest,
    MerchantOut,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# HTTPBearer extracts the token from "Authorization: Bearer <token>" header
security = HTTPBearer()


# ── Register ──────────────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=TokenResponse,   # what this route returns
    status_code=201,                # 201 = Created (more specific than 200 = OK)
)
def register(
    payload: MerchantRegister,      # FastAPI reads + validates the request body
    db     : Session = Depends(get_db),
):
    """
    Create a new Tara merchant account.
    Returns access + refresh tokens so the user is immediately logged in.
    """
    # Check if this email is already registered
    existing = db.query(Merchant).filter(Merchant.email == payload.email).first()
    if existing:
        # 409 Conflict = resource already exists
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # Create the merchant — hash the password, NEVER store plain text
    merchant = Merchant(
        full_name     = payload.full_name,
        business_name = payload.business_name,
        email         = payload.email,
        password_hash = hash_password(payload.password),
        phone         = payload.phone,
    )
    db.add(merchant)
    db.commit()           # save to database
    db.refresh(merchant)  # reload from DB to get the generated ID and timestamps

    # Return tokens — user is logged in immediately after registering
    return TokenResponse(
        access_token = create_access_token(merchant.id),
        refresh_token= create_refresh_token(merchant.id),
    )


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(
    payload: MerchantLogin,
    db     : Session = Depends(get_db),
):
    """
    Log in with email and password.
    Returns access + refresh tokens.
    """
    # Find merchant by email
    merchant = db.query(Merchant).filter(Merchant.email == payload.email).first()

    # Check password — we use verify_password (not direct comparison)
    # Important: we check BOTH conditions together and give a GENERIC error message.
    # Never tell the user whether the email OR password was wrong — that leaks info.
    if not merchant or not verify_password(payload.password, merchant.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not merchant.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated",
        )

    return TokenResponse(
        access_token = create_access_token(merchant.id),
        refresh_token= create_refresh_token(merchant.id),
    )


# ── Refresh Token ─────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest):
    """
    Exchange a refresh token for a new access token.
    Called automatically by the frontend when an access token expires.
    """
    token_data = decode_token(payload.refresh_token)

    # Validate: token must exist, be valid, and be a refresh token (not access token)
    if not token_data or token_data.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    merchant_id = token_data.get("sub")
    return TokenResponse(
        access_token = create_access_token(merchant_id),
        refresh_token= create_refresh_token(merchant_id),  # rotate refresh token too
    )





# ─────────────────────────────────────────────────────────────────────────────
# AUTH DEPENDENCY — used by ALL protected routes across the app
# ─────────────────────────────────────────────────────────────────────────────

def get_current_merchant(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db         : Session = Depends(get_db),
) -> Merchant:
    """
    FastAPI dependency that protects routes.

    How it works:
    1. HTTPBearer extracts the token from "Authorization: Bearer <token>"
    2. We decode the token to get the merchant's ID
    3. We look up the merchant in the DB to make sure they still exist and are active
    4. We return the Merchant object to the route handler

    If anything fails, we raise 401 Unauthorized and the route handler never runs.

    Used like this in other route files:
        def some_protected_route(merchant: Merchant = Depends(get_current_merchant)):
            # this only runs if the user is authenticated
    """
    # Decode the JWT token
    token_data = decode_token(credentials.credentials)

    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or has expired — please log in again",
        )

    if token_data.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A refresh token cannot be used to access protected routes",
        )

    # Look up the merchant in the database
    merchant_id = token_data.get("sub")
    merchant = db.query(Merchant).filter(
        Merchant.id       == merchant_id,
        Merchant.is_active == True,          # reject if account was deactivated
    ).first()

    if not merchant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Merchant account not found or has been deactivated",
        )

    return merchant
# ── Get Current Merchant (Profile) ────────────────────────────────────────────

@router.get("/me", response_model=MerchantOut)
def get_me(
    merchant: Merchant = Depends(get_current_merchant),
):
    """Return the logged-in merchant's profile info."""
    return merchant