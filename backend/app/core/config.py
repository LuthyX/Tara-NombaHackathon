# app/core/config.py
#
# This file loads all environment variables from our .env file
# and makes them available throughout the app as typed Python values.
#
# Instead of doing os.environ.get("DATABASE_URL") everywhere,
# we just do: from app.core.config import settings
# and then: settings.DATABASE_URL
#
# pydantic-settings automatically reads from the .env file AND
# validates that required values exist — if DATABASE_URL is missing,
# the app will refuse to start rather than crash mysteriously later.

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── App ───────────────────────────────────────────────────────────────────
    APP_NAME: str = "Tara"
    APP_ENV: str = "development"

    # Used to sign JWT tokens — must be long and random in production
    SECRET_KEY: str

    # Access tokens expire after this many minutes (short = more secure)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15

    # Refresh tokens live longer — used to get new access tokens
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str

    # ── Upstash Redis ─────────────────────────────────────────────────────────
    UPSTASH_REDIS_URL: str
    UPSTASH_REDIS_TOKEN: str

    # ── Nomba Sandbox ─────────────────────────────────────────────────────────
    # IMPORTANT: sandbox.nomba.com for testing, api.nomba.com for production
    # These MUST be paired — sandbox credentials won't work on production URL
    NOMBA_BASE_URL: str = "https://sandbox.nomba.com/v1"

    # The parent account ID goes into the 'accountId' header on every request
    NOMBA_PARENT_ACCOUNT_ID: str

    # Sub-account ID scopes virtual account creation to our account
    NOMBA_SUB_ACCOUNT_ID: str

    # Client ID and secret used to get an access token from Nomba
    NOMBA_CLIENT_ID: str
    NOMBA_CLIENT_SECRET: str

    # Nomba signs webhook payloads with this secret so we can verify they're real
    NOMBA_WEBHOOK_SECRET: str

    # ── CORS ──────────────────────────────────────────────────────────────────
    # FastAPI needs to explicitly allow requests from our frontend domain
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        # Tell pydantic-settings to read from a .env file
        env_file = ".env"
        # Make variable names case-sensitive (DATABASE_URL != database_url)
        case_sensitive = True


# lru_cache means this function only runs ONCE — the settings object is created
# once and reused everywhere. This is efficient and avoids re-reading the .env
# file on every request.
@lru_cache()
def get_settings() -> Settings:
    return Settings()


# This is the object we import everywhere in the app
settings = get_settings()
