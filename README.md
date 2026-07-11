# Tara — Every payment, perfectly placed.

> Built for the Nomba Hackathon 2026 · Virtual Accounts as Infrastructure Track

Tara gives every Nigerian landlord, school, and business owner a unique virtual bank account number for each of their payers — so every payment reconciles automatically with zero manual effort.

---

## 🏆 Track

**Virtual Accounts as Infrastructure (Build Track)**

Judged on:
- Reconciliation logic quality
- Underpayment and overpayment handling
- Customer-level reporting clarity

---

## 🚀 Live Demo

- **Frontend:** https://tara-nomba-hackathon.vercel.app
- **Backend API:** https://tara-nombahackathon.onrender.com
- **API Docs:** https://tara-nombahackathon.onrender.com/docs

---

## 💡 What Tara Does

Every Nigerian landlord, school admin, and business owner faces the same problem — they share one bank account number with dozens of payers. When money arrives, figuring out who paid what becomes a manual, error-prone process carried out via WhatsApp messages and spreadsheets.

Tara eliminates this entirely:

1. Merchant signs up and creates a workspace (Landlord, School, or Business)
2. Merchant adds customers (individually or via bulk CSV import)
3. Each customer gets their own unique Nomba virtual account number
4. When payment arrives → Tara reconciles it automatically
5. Merchant sees a real-time dashboard: who paid, who didn't, who paid short

---

## 🏗️ Architecture

```
React Frontend (Vercel)
        ↓
FastAPI Backend (Render)
        ↓
Nomba Virtual Account API ← creates unique NUBANs per customer
Nomba Webhooks            ← real-time payment notifications
Nomba Transactions API    ← nightly cross-verification
        ↓
Supabase (PostgreSQL)     ← stores all data with ACID transactions
Upstash Redis             ← idempotency keys (prevent double reconciliation)
APScheduler               ← nightly reconciliation job at midnight
```

---

## ⚙️ Reconciliation Engine

The core of Tara. Handles every payment scenario:

| Scenario | What Tara Does |
|---|---|
| Exact payment | Marks customer as PAID ✅ |
| Underpayment | Tracks cumulative balance, shows exact shortfall |
| Multiple partial payments | Accumulates across payments until target reached |
| Overpayment | Logs credit balance, optionally carries forward to next cycle |
| Installment plan | Tracks progress per installment milestone |
| Missed due date | Nightly job promotes to OVERDUE |

**Dual-source reconciliation:**
- **Webhooks** — real-time payment detection (primary)
- **Transactions API** — nightly cross-check to catch missed webhooks (backup)

---

## 🔒 Security

- HMAC-SHA256 webhook signature verification on every incoming request
- Upstash Redis idempotency keys — prevents double-processing on Nomba retries
- Atomic database transactions — payment record + webhook status updated together
- JWT authentication with refresh token rotation
- Workspace-level data isolation — merchants can never see each other's data
- Input validation via Pydantic on every endpoint
- No API keys exposed in frontend

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS + shadcn/ui |
| Charts | Recharts |
| Data Fetching | TanStack Query (React Query) |
| Backend | Python 3.12 + FastAPI |
| Database | Supabase (PostgreSQL) + SQLAlchemy + Alembic |
| Cache | Upstash Redis |
| Scheduler | APScheduler (nightly reconciliation job) |
| Auth | JWT + python-jose + bcrypt |
| HTTP Client | httpx (async Nomba API calls) |
| Frontend Host | Vercel |
| Backend Host | Render + UptimeRobot (keep-alive) |

---

## 📁 Project Structure

```
tara/
├── backend/
│   ├── app/
│   │   ├── api/routes/
│   │   │   ├── auth.py          # Register, login, refresh token
│   │   │   ├── workspaces.py    # Workspace CRUD + dashboard stats
│   │   │   └── customers.py     # Customer CRUD + CSV bulk import
│   │   ├── core/
│   │   │   ├── config.py        # Settings from .env
│   │   │   ├── database.py      # Supabase connection
│   │   │   ├── security.py      # JWT + password hashing
│   │   │   └── redis.py         # Upstash idempotency
│   │   ├── models/
│   │   │   └── models.py        # All database tables
│   │   ├── schemas/
│   │   │   ├── auth.py          # Auth request/response schemas
│   │   │   └── workspace.py     # Workspace/customer schemas
│   │   ├── services/
│   │   │   ├── nomba.py         # Nomba API integration
│   │   │   ├── reconciliation.py# Core reconciliation engine
│   │   │   └── scheduler.py     # Nightly reconciliation job
│   │   └── webhooks/
│   │       └── handler.py       # Nomba webhook receiver
│   ├── alembic/                 # Database migrations
│   └── main.py                  # FastAPI app entry point
└── frontend/
    └── src/
        ├── pages/               # Login, Register, Dashboard, Customers...
        ├── components/          # Layout, ProtectedRoute
        ├── hooks/               # React Query data hooks
        ├── lib/                 # API client, utilities
        └── context/             # Auth context
```

---

## 🚀 Local Setup

### Prerequisites
- Python 3.12
- Node.js 18+
- Supabase account
- Upstash Redis account
- Nomba sandbox credentials

### Backend

```bash
cd backend

# Create virtual environment
python3.12 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Fill in your values in .env

# Run database migrations
alembic revision --autogenerate -m "initial tables"
alembic upgrade head

# Start the server
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Set VITE_API_URL=http://localhost:8000/api/v1

# Start dev server
npm run dev
```

---

## 🔑 Environment Variables

### Backend (.env)

```env
APP_NAME=Tara
APP_ENV=development
SECRET_KEY=your-secret-key

# Supabase
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

# Upstash Redis
UPSTASH_REDIS_URL=https://your-redis.upstash.io
UPSTASH_REDIS_TOKEN=your-token

# Nomba Sandbox
NOMBA_BASE_URL=https://sandbox.nomba.com/v1
NOMBA_PARENT_ACCOUNT_ID=your-parent-account-id
NOMBA_SUB_ACCOUNT_ID=your-sub-account-id
NOMBA_CLIENT_ID=your-client-id
NOMBA_CLIENT_SECRET=your-client-secret
NOMBA_WEBHOOK_SECRET=your-webhook-secret

# CORS
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8000/api/v1
```

---

## 🔌 Nomba API Integration

| API | Endpoint | Usage |
|---|---|---|
| Auth | `POST /v1/auth/token/issue` | Get Bearer token |
| Virtual Accounts | `POST /v1/accounts/virtual/{subAccountId}` | Create unique NUBAN per customer |
| Webhooks | `transfer.completed` event | Real-time payment reconciliation |
| Transactions | `GET /v1/transactions/accounts/{subAccountId}` | Nightly cross-verification |

---

## 🎯 Workspace Types

| Type | Users | Terminology |
|---|---|---|
| 🏠 Landlord | Property owners, estate managers | Tenants, Rent |
| 🏫 School | School admins, PTAs, tutors | Students, Fees |
| 💼 Business | Freelancers, vendors, consultants | Clients, Invoice |

**Coming soon:** 🤝 Ajo/Esusu rotating savings group tracker

---

## 📊 Database Schema

| Table | Purpose |
|---|---|
| `merchants` | Tara user accounts |
| `workspaces` | Collection workspaces per merchant |
| `customers` | Payers with virtual account details |
| `payments` | Individual payment events (audit trail) |
| `webhook_events` | All incoming Nomba webhooks |
| `reconciliation_logs` | Nightly job run summaries |

---

## 🧪 Testing Webhooks Locally

Generate a test webhook signature and fire it:

```bash
python3 - << 'EOF'
import hmac, hashlib, json

secret  = "your-webhook-secret"
payload = json.dumps({
    "eventId"  : "test-001",
    "eventType": "transfer.completed",
    "data"     : {
        "destinationAccountNumber": "YOUR_VIRTUAL_ACCOUNT_NUMBER",
        "amount"                  : 2000000,
        "transactionReference"    : "TXN-TEST-001"
    }
}, separators=(',', ':'))

sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
print(f'curl -X POST http://localhost:8000/api/v1/webhooks/nomba \\\n  -H "Content-Type: application/json" \\\n  -H "nomba-signature: {sig}" \\\n  -d \'{payload}\'')
EOF
```

---

*Built with ❤️ on Nomba's Virtual Account Infrastructure*
