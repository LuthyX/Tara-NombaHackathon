# app/core/security.py
#
# This file handles two security concerns:
#   1. PASSWORD HASHING — we never store plain passwords in the DB
#      When a user registers, we hash their password.
#      When they log in, we hash what they typed and compare the hashes.
#
#   2. JWT TOKENS — JSON Web Tokens are how we keep users logged in.
#      When a user logs in, we give them two tokens:
#        - Access token: short-lived (15 min), used on every API request
#        - Refresh token: longer-lived (7 days), used ONLY to get a new access token
#
#      The user sends their access token in the Authorization header:
#        Authorization: Bearer eyJhbGci...
#      We decode it to find out who they are.

from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from app.core.config import settings


# The algorithm used to sign JWT tokens
ALGORITHM = "HS256"


# ── Password Utilities ────────────────────────────────────────────────────────

import bcrypt

def hash_password(plain_password: str) -> str:
    """Hash a password using bcrypt directly."""
    # encode() converts string to bytes — bcrypt requires bytes
    password_bytes = plain_password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a plain password against a stored hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


# ── JWT Token Utilities ───────────────────────────────────────────────────────

def create_access_token(merchant_id: str) -> str:
    """
    Create a short-lived access token for a logged-in merchant.

    The token contains:
      - sub: the merchant's ID (who this token belongs to)
      - exp: when this token expires
      - type: "access" (so we know this isn't a refresh token being misused)

    The token is signed with our SECRET_KEY — if anyone tampers with it,
    the signature won't match and we'll reject it.
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": merchant_id,    # subject — who this token is for
        "exp": expire,         # expiry — when it stops being valid
        "type": "access",      # token type — so refresh tokens can't be used as access tokens
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(merchant_id: str) -> str:
    """
    Create a longer-lived refresh token.
    Used ONLY to get a new access token when the old one expires.
    Has a longer expiry but is only accepted by the /auth/refresh endpoint.
    """
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {
        "sub": merchant_id,
        "exp": expire,
        "type": "refresh",    # different type — can't be used as access token
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """
    Decode and verify a JWT token.
    Returns the payload (dict) if valid, or None if invalid/expired.

    jose automatically checks:
      - The signature (was it really signed by us?)
      - The expiry (has it expired?)
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        # Token is invalid, tampered with, or expired
        return None
