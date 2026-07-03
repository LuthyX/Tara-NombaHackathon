# Tara Backend

> Every payment, perfectly placed.

## Setup Instructions

### 1. Create a virtual environment
```bash
python -m venv venv

# On Mac/Linux:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Set up environment variables
```bash
cp .env.example .env
# Open .env and fill in your actual values
```

### 4. Run database migrations
```bash
alembic revision --autogenerate -m "initial tables"
alembic upgrade head
```

### 5. Start the server
```bash
uvicorn main:app --reload
```

API docs available at: http://localhost:8000/docs

### 6. Set up ngrok for webhooks (development)
```bash
ngrok http 8000
# Submit the HTTPS URL to Nomba:
# https://abc123.ngrok.io/api/v1/webhooks/nomba
```

## Project Structure

```
backend/
├── main.py                     # FastAPI app entry point
├── requirements.txt            # Python dependencies
├── .env.example                # Environment variable template
├── alembic.ini                 # Alembic config
├── alembic/
│   └── env.py                  # Migration runner
└── app/
    ├── core/
    │   ├── config.py           # Settings from .env
    │   ├── database.py         # DB connection + session
    │   ├── security.py         # JWT + password hashing
    │   └── redis.py            # Upstash Redis idempotency
    ├── models/
    │   └── models.py           # All database tables
    ├── schemas/
    │   ├── auth.py             # Auth request/response shapes
    │   └── workspace.py        # Workspace/customer shapes
    ├── services/
    │   ├── nomba.py            # Nomba API integration
    │   ├── reconciliation.py   # Core reconciliation engine
    │   └── scheduler.py        # Nightly reconciliation job
    ├── api/routes/
    │   ├── auth.py             # /auth/* endpoints
    │   ├── workspaces.py       # /workspaces/* endpoints
    │   └── customers.py        # /workspaces/{id}/customers/* endpoints
    └── webhooks/
        └── handler.py          # Nomba webhook receiver
```
