# main.py
#
# The entry point of our FastAPI application.
#
# This file:
#   1. Creates the FastAPI app instance
#   2. Configures CORS (so our React frontend can talk to us)
#   3. Registers all our route modules
#   4. Starts/stops the scheduler on app startup/shutdown
#   5. Defines the /health endpoint for UptimeRobot
#
# HOW FASTAPI STARTS:
# ────────────────────
# We run this with: uvicorn main:app --reload
#   - 'main' = this file (main.py)
#   - 'app'  = the FastAPI instance we create below
#   - '--reload' = restart automatically when code changes (development only)

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import auth, workspaces, customers
from app.webhooks.handler import router as webhook_router
from app.services.scheduler import start_scheduler, stop_scheduler

# Configure logging — this makes all our logger.info() calls appear in the terminal
logging.basicConfig(
    level  = logging.INFO,
    format = "%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────
# The lifespan function runs code at app startup and shutdown.
# @asynccontextmanager makes it work as a context manager with yield.
#
# Everything BEFORE yield → runs at startup
# Everything AFTER yield  → runs at shutdown
#
# This is the modern FastAPI way (replaces @app.on_event("startup"))

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP ──
    logger.info(f"Starting {settings.APP_NAME} API...")
    logger.info(f"Environment: {settings.APP_ENV}")
    logger.info(f"Nomba Base URL: {settings.NOMBA_BASE_URL}")
    start_scheduler()   # register and start the nightly reconciliation job
    logger.info(f"{settings.APP_NAME} API is ready ✅")

    yield   # app is running — handle requests

    # ── SHUTDOWN ──
    logger.info(f"Shutting down {settings.APP_NAME} API...")
    stop_scheduler()


# ── FastAPI App ───────────────────────────────────────────────────────────────

app = FastAPI(
    title       = f"{settings.APP_NAME} API",
    description = "Every payment, perfectly placed.",
    version     = "1.0.0",
    lifespan    = lifespan,
    # These settings hide our API docs in production (optional)
    docs_url    = "/docs" if settings.APP_ENV == "development" else None,
    redoc_url   = "/redoc" if settings.APP_ENV == "development" else None,
)


# ── CORS Middleware ───────────────────────────────────────────────────────────
# CORS = Cross-Origin Resource Sharing
#
# Browsers block JavaScript from making requests to a different domain by default.
# Our React frontend (localhost:5173) needs to call our API (localhost:8000).
# Different ports = different origins = blocked without CORS headers.
#
# This middleware adds the right headers to tell browsers: "this is allowed".

app.add_middleware(
    CORSMiddleware,
    # Which origins (domains) are allowed to call our API
    allow_origins=[
        settings.FRONTEND_URL,       # from .env (e.g. https://tara.vercel.app)
        "http://localhost:5173",     # Vite dev server
        "http://localhost:3000",     # alternative React dev port
    ],
    allow_credentials=True,    # allow cookies and auth headers
    allow_methods=["*"],       # allow all HTTP methods (GET, POST, PATCH, DELETE, etc.)
    allow_headers=["*"],       # allow all headers (including Authorization)
)


# ── Register Routes ───────────────────────────────────────────────────────────
# We use prefix="/api/v1" so all our endpoints start with /api/v1/
# e.g. POST /api/v1/auth/register
#      GET  /api/v1/workspaces
#      POST /api/v1/webhooks/nomba

API_PREFIX = "/api/v1"

app.include_router(auth.router,       prefix=API_PREFIX)
app.include_router(workspaces.router, prefix=API_PREFIX)
app.include_router(customers.router,  prefix=API_PREFIX)
app.include_router(webhook_router,    prefix=API_PREFIX)


# ── Health Check Endpoint ─────────────────────────────────────────────────────
# UptimeRobot pings GET /health every 5 minutes to keep our Render server alive.
# Without this, Render's free tier hibernates after 15 minutes of inactivity
# and we'd miss webhook events while it's asleep.

@app.get("/health", tags=["Health"])
def health_check():
    """
    Health check endpoint.
    Used by UptimeRobot to keep the Render server awake.
    Returns a simple JSON response to confirm the server is running.
    """
    return {
        "status" : "ok",
        "app"    : settings.APP_NAME,
        "version": "1.0.0",
    }


@app.get("/", tags=["Root"])
def root():
    """Root endpoint — useful to check the API is reachable."""
    return {
        "message": f"Welcome to the {settings.APP_NAME} API",
        "docs"   : "/docs",
    }

@app.get("/health")
@app.head("/health")  # ← add this line
def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
