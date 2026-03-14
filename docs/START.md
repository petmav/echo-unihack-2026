# Getting Started with Echo

Complete guide to running Echo locally, in Docker, and in production. Covers every service, environment variable, and common issue.

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Docker + Docker Compose | v2+ | Runs all services together |
| Python | 3.11+ | Backend development outside Docker |
| Node.js | 20+ | Frontend development |
| Git | Any | Source control |

Optional:
- **Android Studio** — only if building the mobile APK
- **Ollama** — only if running the anonymizer outside Docker

---

## Quick Start (Docker Compose)

This brings up all 5 services: PostgreSQL, Ollama, Elasticsearch, backend, and frontend.

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd echo-unihack-2026

# 2. Create your .env file
cp .env.example .env
# Edit .env — see "Environment Variables" below for what to fill in

# 3. Start everything
docker compose -f infra/docker-compose.yml up -d

# 4. Wait for all services to be healthy (~60-90s on first run)
docker compose -f infra/docker-compose.yml ps
# All services should show "healthy"

# 5. Seed Elasticsearch with demo data (first time only)
docker compose -f infra/docker-compose.yml exec backend python seed_elastic.py

# 6. Open the app
#    Frontend:     http://localhost:3000
#    Backend API:  http://localhost:8000/docs
#    Admin panel:  http://localhost:8000/admin (password printed to backend stderr)
```

### What happens on first startup

1. **PostgreSQL** starts and creates the `echo_db` database
2. **Ollama** starts and auto-pulls the `qwen3.5:0.8b` anonymizer model (~500MB download)
3. **Elasticsearch** starts in single-node mode (local fallback for when Elastic Cloud is not configured)
4. **Backend** waits for Postgres + Ollama + Elasticsearch to be healthy, then starts FastAPI. On first boot it creates the `accounts` and `message_themes` tables automatically
5. **Frontend** runs `npm ci` then `npm run dev` with hot-reload

### Startup order (enforced by health checks)

```
postgres ──┐
ollama ────┤
elasticsearch ─┤
               ├── backend ── frontend
```

---

## Environment Variables

All variables are defined in a single `.env` file at the project root. Docker Compose loads it automatically.

### Required

| Variable | Description | How to get it |
|----------|-------------|---------------|
| `NANOGPT_API_KEY` | API key for thought humanization (Qwen3.5-122B) | [nano-gpt.com](https://nano-gpt.com/) |
| `JWT_SECRET` | Signing key for auth tokens. **Must change from default in production.** | `python -c "import secrets; print(secrets.token_urlsafe(32))"` |

### Elasticsearch (choose one setup)

**Option A — Elastic Cloud (recommended for demo):**

| Variable | Description |
|----------|-------------|
| `ELASTIC_HOST` | Your Elastic Cloud endpoint URL |
| `ELASTIC_API_KEY` | API key from Elastic Cloud console |
| `ELASTIC_CLOUD_ID` | Leave blank for Serverless; set for hosted deployments |

**Option B — Local Elasticsearch (zero config):**

Leave all `ELASTIC_*` variables empty. Docker Compose runs a local Elasticsearch container on port 9200. The backend falls back to `http://localhost:9200` automatically.

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama URL. Docker Compose overrides this to `http://ollama:11434` |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string. Docker Compose overrides this |
| `HOST` | `0.0.0.0` | Backend bind address |
| `PORT` | `8000` | Backend port |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | API base URL the frontend calls. Docker Compose sets this |
| `ADMIN_EMAIL` | (empty) | Email that receives the admin flag on login |
| `ADMIN_PASSWORD` | (auto-generated) | Fixed admin dashboard password. If empty, a random one is generated at startup and printed to stderr |
| `RATE_LIMIT_THOUGHTS_PER_HOUR` | `10` | Max thought submissions per user per hour |
| `RATE_LIMIT_LOGIN_PER_15MIN` | `5` | Max login attempts per IP per 15 minutes |
| `RATE_LIMIT_RESOLUTION_PER_HOUR` | `5` | Max resolution submissions per user per hour |
| `ELASTIC_THOUGHTS_INDEX` | `echo-thoughts` | Elasticsearch index name for thoughts |
| `ELASTIC_RESOLUTIONS_INDEX` | `echo-resolutions` | Elasticsearch index name for resolutions |

### What Docker Compose overrides

The docker-compose file **overrides** these variables to use Docker service hostnames, regardless of what your `.env` says:

```yaml
OLLAMA_HOST=http://ollama:11434          # Uses Docker network, not localhost
DATABASE_URL=postgresql://echo_user:echo_password@postgres:5432/echo_db
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

This means your `.env` values for `OLLAMA_HOST` and `DATABASE_URL` only matter when running services outside Docker.

---

## Running Without Docker

If you prefer to run services directly on your machine.

### Backend

```bash
# 1. Install Python dependencies
cd backend
pip install -r requirements.txt

# 2. Make sure Ollama is running with the anonymizer model
ollama pull qwen3.5:0.8b
ollama serve    # Runs on localhost:11434

# 3. Make sure PostgreSQL is running
#    Update DATABASE_URL in .env to point to your Postgres instance

# 4. Start the backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
#    API docs: http://localhost:8000/docs
#    Admin:    http://localhost:8000/admin
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

The frontend reads `NEXT_PUBLIC_API_URL` from the environment. If unset, it defaults to `http://localhost:8000` (defined in `frontend/src/lib/constants.ts`).

---

## Seeding Demo Data

The seed script populates Elasticsearch with ~500 realistic anonymized thoughts and ~100 "what helped" resolutions across multiple themes and weeks. This is **essential for the demo** — without it, the app works but shows no results.

```bash
# From the backend directory (or via docker exec)
python seed_elastic.py            # Seed if indices are empty
python seed_elastic.py --force    # Wipe and reseed from scratch
python seed_elastic.py --dry-run  # Preview what would be seeded
```

The seed script:
- Generates 384-dim sentence embeddings using `all-MiniLM-L6-v2`
- Distributes entries across 8 ISO weeks (current week gets the most for impressive aggregate counts)
- Creates entries in both `echo-thoughts` and `echo-resolutions` indices
- Requires `ELASTIC_*` env vars or a local Elasticsearch to be running

---

## Running Tests

### Backend (pytest)

```bash
cd backend

# Run all tests (excludes integration tests by default)
python -m pytest -v

# Run a specific test file
python -m pytest tests/test_auth_service.py -v

# Run with coverage
python -m pytest --cov=. --cov-report=html

# Include integration tests (requires Ollama + Postgres running)
python -m pytest -m integration -v

# Lint check
python -m ruff check .
```

Tests use an in-memory SQLite database and mock all external services (Ollama, NanoGPT, Elasticsearch). No running services needed for the default test suite.

### Frontend (TypeScript + lint)

```bash
cd frontend

# Type check
npx tsc --noEmit

# Lint
npx eslint src/
```

### End-to-End (Playwright)

```bash
cd frontend

# Install browser (first time only)
npx playwright install --with-deps chromium

# Run all E2E tests
npx playwright test

# Run with UI (interactive)
npx playwright test --ui

# Run a specific test file
npx playwright test e2e/echo-flow.spec.ts
```

E2E tests mock API responses with `page.route()` — they do not need a running backend.

---

## Docker Services Reference

| Service | Image | Port | Health Check | Volume |
|---------|-------|------|-------------|--------|
| `postgres` | postgres:15-alpine | 5432 | `pg_isready` | `echo-postgres-data` |
| `ollama` | ollama/ollama:latest | 11434 | `ollama list` | `echo-ollama-models` |
| `elasticsearch` | elasticsearch:8.13.0 | 9200 | Cluster health != red | `echo-elasticsearch-data` |
| `backend` | Built from `backend/Dockerfile` | 8000 | `GET /health` | Code mounted for hot-reload |
| `frontend` | node:20-alpine (dev mode) | 3000 | `wget localhost:3000` | Code mounted for hot-reload |

### Resource limits

- Backend: 512MB memory
- Elasticsearch: 1GB memory (JVM heap: 512MB)

### Useful commands

```bash
# View logs for a specific service
docker compose -f infra/docker-compose.yml logs -f backend

# Rebuild backend after Dockerfile or requirements.txt changes
docker compose -f infra/docker-compose.yml build backend
docker compose -f infra/docker-compose.yml up -d backend

# Restart a single service
docker compose -f infra/docker-compose.yml restart backend

# Stop everything
docker compose -f infra/docker-compose.yml down

# Stop and delete all data (Postgres, Ollama models, ES indices)
docker compose -f infra/docker-compose.yml down -v

# Shell into a running container
docker compose -f infra/docker-compose.yml exec backend bash
docker compose -f infra/docker-compose.yml exec ollama sh
```

---

## Making Code Changes

### Backend changes

The backend code is **volume-mounted** into the container (`../backend:/app`), but uvicorn runs without `--reload` in Docker. To pick up changes:

```bash
# Option 1: Restart the container (fast)
docker compose -f infra/docker-compose.yml restart backend

# Option 2: Run locally with auto-reload instead
cd backend
uvicorn main:app --reload --port 8000
```

If you change `requirements.txt`, rebuild the image:

```bash
docker compose -f infra/docker-compose.yml build backend
docker compose -f infra/docker-compose.yml up -d backend
```

### Frontend changes

The frontend runs in dev mode with hot-reload — changes to files in `frontend/src/` are picked up automatically. No restart needed.

If you change `package.json`, the container runs `npm ci` on startup, so just restart it:

```bash
docker compose -f infra/docker-compose.yml restart frontend
```

### Environment variable changes

After editing `.env`:

```bash
# Restart services that use the changed variables
docker compose -f infra/docker-compose.yml up -d backend
# Or restart everything
docker compose -f infra/docker-compose.yml up -d
```

Note: `NEXT_PUBLIC_*` variables are baked into the frontend at build time in production. In the Docker Compose dev setup they're passed as runtime env vars, so a restart is sufficient.

### Database schema changes

The backend calls `init_db()` at startup which runs `Base.metadata.create_all()`. This creates missing tables but **does not modify existing ones**. If you change a model's columns:

```bash
# Option 1: Drop and recreate (dev only — loses data)
docker compose -f infra/docker-compose.yml down -v
docker compose -f infra/docker-compose.yml up -d

# Option 2: Manual migration
docker compose -f infra/docker-compose.yml exec backend python -c "
from database import engine, Base
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
"
```

### Elasticsearch index changes

If you change the index mapping in `services/elastic.py`:

```bash
# Delete and recreate indices (loses data — reseed after)
docker compose -f infra/docker-compose.yml exec backend python -c "
import asyncio
from services.elastic import init_elasticsearch, _es_client
from config import config
asyncio.run(init_elasticsearch())
# Delete old indices
asyncio.run(_es_client.indices.delete(index=config.ELASTIC_THOUGHTS_INDEX, ignore=[404]))
asyncio.run(_es_client.indices.delete(index=config.ELASTIC_RESOLUTIONS_INDEX, ignore=[404]))
"

# Then reseed
docker compose -f infra/docker-compose.yml exec backend python seed_elastic.py --force
```

---

## Building for Production

### Backend Docker image

```bash
cd backend
docker build -t echo-backend .
docker run -p 8000:8000 --env-file ../.env echo-backend
```

### Frontend Docker image

```bash
cd frontend
docker build -t echo-frontend .
docker run -p 3000:3000 echo-frontend
```

The frontend Dockerfile uses a multi-stage build:
1. **deps** — installs node_modules
2. **builder** — builds Next.js with `NEXT_OUTPUT=standalone`
3. **runner** — minimal image with non-root user, runs `node server.js`

### Android APK

```bash
cd frontend
npm run build:apk
# APK output: android/app/build/outputs/apk/debug/app-debug.apk
```

Requires Android Studio or the Android SDK with JDK 17.

---

## Troubleshooting

### "Ollama model not found" or anonymization fails

```bash
# Check if the model is downloaded
docker compose -f infra/docker-compose.yml exec ollama ollama list

# Should show qwen3.5:0.8b. If not:
docker compose -f infra/docker-compose.yml exec ollama ollama pull qwen3.5:0.8b
```

### Backend won't start — "connection refused" to Postgres

The backend waits for Postgres health check before starting. If Postgres takes too long:

```bash
# Check Postgres status
docker compose -f infra/docker-compose.yml logs postgres

# If it's stuck, restart it
docker compose -f infra/docker-compose.yml restart postgres
```

### Elasticsearch "yellow" or "red" status

Single-node ES always shows yellow (no replicas). This is fine for development. Red means a real problem — check logs:

```bash
docker compose -f infra/docker-compose.yml logs elasticsearch
```

### Frontend shows blank screen or API errors

```bash
# 1. Check backend is running
curl http://localhost:8000/health
# Should return: {"status": "healthy"}

# 2. Check CORS — frontend must be on localhost:3000
# CORS is hardcoded to allow localhost:3000 and 127.0.0.1:3000

# 3. Check NEXT_PUBLIC_API_URL is correct
# In Docker: http://localhost:8000/api/v1
# The /api/v1 suffix matters
```

### Tests fail with "psycopg2.OperationalError: connection refused"

Tests should use in-memory SQLite, not PostgreSQL. If you see this error, the test is creating its own `TestClient(app)` without mocking `init_db`. Tests in the `tests/` directory use the `conftest.py` fixtures which handle this automatically.

### Admin password

The admin dashboard password is printed to **stderr** (not the log stream) at startup. To find it:

```bash
docker compose -f infra/docker-compose.yml logs backend 2>&1 | grep "ADMIN"
```

Or set `ADMIN_PASSWORD` in your `.env` to use a fixed password.

---

## Project Structure

```
echo-unihack-2026/
├── .env.example              ← Copy to .env and fill in
├── CLAUDE.md                 ← AI assistant context
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py               ← FastAPI app entry point
│   ├── config.py             ← Environment config (Pydantic)
│   ├── database.py           ← SQLAlchemy models + sessions
│   ├── seed_elastic.py       ← Demo data seeder
│   ├── seed_data.py          ← Pre-written demo content
│   ├── routers/
│   │   ├── auth.py           ← POST /auth/register, /login, /refresh
│   │   ├── thoughts.py       ← POST /thoughts, GET /similar, /aggregates
│   │   ├── resolution.py     ← POST /resolution, GET /resolution/{id}
│   │   ├── account.py        ← GET/DELETE /account
│   │   └── admin.py          ← Admin dashboard + API endpoints
│   ├── services/
│   │   ├── anonymiser.py     ← Qwen3.5-0.8B via Ollama (ALWAYS called first)
│   │   ├── ai.py             ← NanoGPT humanization + classification
│   │   ├── elastic.py        ← Elasticsearch operations
│   │   ├── embeddings.py     ← Sentence embeddings (all-MiniLM-L6-v2)
│   │   └── auth.py           ← JWT + bcrypt
│   ├── middleware/
│   │   ├── logging.py        ← NEVER logs request bodies (privacy)
│   │   ├── rate_limit.py     ← Per-account + per-IP throttling
│   │   ├── cors.py           ← CORS config
│   │   └── request_size.py   ← Body size limits
│   ├── models/               ← Pydantic request/response schemas
│   └── tests/                ← pytest suite (399 tests)
├── frontend/
│   ├── Dockerfile            ← Multi-stage production build
│   ├── package.json
│   ├── next.config.ts        ← Output mode: standard / standalone / export
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx    ← Root layout + ErrorBoundary
│   │   │   ├── page.tsx      ← Main app (home, results, panels)
│   │   │   └── globals.css   ← Tailwind styles
│   │   ├── components/echo/  ← All Echo-specific components
│   │   └── lib/
│   │       ├── api.ts        ← All backend fetch calls
│   │       ├── storage.ts    ← localStorage (ONLY file touching raw thoughts)
│   │       ├── crypto.ts     ← Client-side encryption
│   │       ├── types.ts      ← TypeScript interfaces
│   │       └── constants.ts  ← Theme lists, timing values, limits
│   └── e2e/                  ← Playwright E2E tests
├── infra/
│   └── docker-compose.yml    ← All 5 services
└── docs/
    ├── START.md              ← This file
    ├── ARCHITECTURE.md       ← System architecture
    ├── PRIVACY_SPEC.md       ← Privacy model + breach analysis
    ├── FEATURE_SPEC.md       ← Feature specification
    └── PITCH_TEMPLATE.md     ← Demo script
```
