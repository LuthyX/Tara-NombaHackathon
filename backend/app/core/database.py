# app/core/database.py
#
# This file sets up our connection to Supabase (PostgreSQL).
#
# Think of it like this:
#   - The ENGINE is the actual connection to the database (like a phone line)
#   - SessionLocal is a FACTORY that creates database sessions
#   - A SESSION is a single conversation with the database
#     (you open it, do your work, then close it)
#   - Base is the parent class all our DB models inherit from —
#     SQLAlchemy uses it to know which classes represent database tables
#
# PSYCOPG3 NOTE:
# We use psycopg3 (the modern PostgreSQL driver) instead of psycopg2
# because psycopg2 doesn't support Python 3.14 yet.
# psycopg3 requires the connection URL to start with "postgresql+psycopg://"
# instead of the standard "postgresql://" — we handle that conversion below
# so you don't need to change anything in your .env file.

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import settings


def _build_db_url(url: str) -> str:
    """
    Convert a standard PostgreSQL URL to the psycopg3 format.

    Supabase gives you a URL like:
      postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

    psycopg3 needs it to be:
      postgresql+psycopg://postgres:password@db.xxx.supabase.co:5432/postgres

    We handle both "postgresql://" and "postgres://" since Supabase
    sometimes provides the shorter "postgres://" format.
    """
    if url.startswith("postgres://"):
        # Replace "postgres://" with the psycopg3 format
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        # Replace "postgresql://" with the psycopg3 format
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    # Already in the right format — return as is
    return url


# Build the correctly formatted database URL
db_url = _build_db_url(settings.DATABASE_URL)

# Create the database engine
# pool_pre_ping=True: before using a connection, check it's still alive
# pool_size=10: keep up to 10 connections open (reuse them instead of creating new ones)
# max_overflow=20: allow up to 20 extra connections if the pool is full
engine = create_engine(
    db_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# SessionLocal is a class we call to create a new DB session
# autocommit=False means we manually control when to save changes (db.commit())
# autoflush=False means SQLAlchemy won't auto-send SQL — we control this too
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# All our DB model classes (Merchant, Workspace, etc.) inherit from Base.
# SQLAlchemy uses Base.metadata to know all the tables that exist in our app.
class Base(DeclarativeBase):
    pass


# This is a FastAPI "dependency" — a function that FastAPI calls automatically
# before running our route handlers, and passes the result as a parameter.
#
# The 'yield' keyword is key here:
#   - Everything BEFORE yield runs before the route handler (open DB session)
#   - Everything AFTER yield runs after the route handler finishes (close session)
#   - This guarantees the DB session is ALWAYS closed, even if an error occurs
#
# Usage in routes:
#   def my_route(db: Session = Depends(get_db)):
#       db.query(...)
def get_db():
    db = SessionLocal()
    try:
        yield db        # hand the session to the route handler
    finally:
        db.close()      # always runs — whether route succeeded or crashed
