# Echo

> *You are not alone — proven with data.*

Built for **UNIHACK 2026** · March 13-15, 2026

---

## What is Echo?

Echo is a privacy-first mental health app that shows you how many people have felt exactly what you're feeling right now — and what helped them get through it.

You type a thought. Echo anonymises it, finds everyone who felt the same, and tells you: *"847 people have felt something like this."* You scroll through their experiences. Some of them found a way through — and left a note for you.

No chatbot. No social feed. No clinical questionnaire. Just ambient proof that you're not alone, powered by semantic search and private by design.

## How It Works

```
You type a thought
       |
  Qwen3.5-0.8B (self-hosted) strips all identifying info
  Raw text is discarded immediately
       |
  NanoGPT humanises the anonymised text (50-60 words)
  Never sees your original words
       |
  Elasticsearch indexes it with a 384-dim sentiment vector
  No account ID, no IP, no raw text stored
       |
  Vector similarity search finds others who felt the same
       |
  You see the count + their anonymised experiences
  Your raw thought stays only on your device (encrypted)
```

## Privacy Model

**Core invariant**: Raw thought text never persists anywhere except your own device.

- **Our server breached?** Attacker gets emails + theme categories. Cannot read raw thoughts.
- **Elasticsearch breached?** Attacker gets anonymised thoughts with zero user linkage.
- **Your device breached?** Only your data. localStorage is encrypted with AES-GCM.

See [`docs/PRIVACY_SPEC.md`](docs/PRIVACY_SPEC.md) for the full breach analysis.

## Team

| Name | Role |
|------|------|
| TBD  | TBD  |

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS, Framer Motion |
| Mobile | Capacitor (Android APK via WebView) |
| Backend | FastAPI (Python), SQLAlchemy (async), Pydantic v2 |
| Anonymisation | Qwen3.5-0.8B via Ollama (self-hosted SLM) |
| Humanisation | NanoGPT API (qwen3.5-122b-a10b, OpenAI-compatible) |
| Search | Elasticsearch 8.13 (vector similarity, kNN, aggregations) |
| Embeddings | all-MiniLM-L6-v2 (local, 384-dim) |
| Auth | Email + bcrypt (cost=12), JWT (7-day expiry) |
| Infra | Docker Compose (5 services: PostgreSQL, Ollama, Elasticsearch, FastAPI, Next.js) |

## Quick Start

### Prerequisites

- Docker + Docker Compose v2+

### Setup

```bash
git clone <repo-url>
cd echo-unihack-2026

# 1. Configure environment
cp .env.example .env
# Fill in: NANOGPT_API_KEY, JWT_SECRET
# Optionally: ELASTIC_HOST + ELASTIC_API_KEY for Elastic Cloud

# 2. Start all 5 services
docker compose -f infra/docker-compose.yml up -d

# 3. Wait for healthy status (~60-90s on first run, Ollama pulls ~500MB model)
docker compose -f infra/docker-compose.yml ps

# 4. Seed Elasticsearch with demo data
docker compose -f infra/docker-compose.yml exec backend python seed_elastic.py

# 5. Open the app
#    Frontend:     http://localhost:3000
#    Backend API:  http://localhost:8000/docs
#    Admin panel:  http://localhost:8000/admin
```

For running without Docker, building the Android APK, or troubleshooting, see [`docs/START.md`](docs/START.md).

## Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | Thought Submission | Tap the logo, type a thought, full AI pipeline processes it |
| 2 | Response Cards | Scroll through others' humanised thoughts with similarity scores |
| 3 | History Panel | Local history with match counts and resolve button |
| 4 | "What Helped" | Mark a thought resolved, share advice — stored and shown verbatim |
| 5 | Personal Trends | Client-side theme frequency, resolution rate, time-to-resolution |
| 6 | Breathing With Others | Logo animation intensity reflects weekly co-presence count |
| 7 | Future You Letters | Write notes to your future self, resurfaced on matching themes |
| 8 | Guardrails of Care | Crisis helplines shown for risk themes (client-side, zero logging) |
| 9 | Topic Exploration | Tap floating bubbles to browse thoughts by theme without typing |
| 10 | Surrounding Topics | Animated topic bubbles on the home screen perimeter |
| 11 | Saved Anchors | Bookmark "what helped" advice locally for future theme matches |
| 12 | Quiet Wins | Celebrates long gaps between theme mentions |
| 13 | Recurrence Pattern | Flags when the same theme appears 3+ times in 14 days |
| 14 | Resolution Aggregates | Shows per-theme stats on how many people shared advice |
| 15 | Advice-First Toggle | Filter results to only cards with "what helped" attached |

See [`docs/FEATURE_SPEC.md`](docs/FEATURE_SPEC.md) for full specifications.

## Testing

```bash
# Backend (399 pytest tests — no running services needed)
cd backend && python -m pytest -v

# Frontend type check
cd frontend && npx tsc --noEmit

# Playwright E2E (mocks API, no backend needed)
cd frontend && npx playwright test
```

See [`docs/TEST.md`](docs/TEST.md) for demo mode testing and feature-by-feature instructions.

## Documentation

| Document | Contents |
|----------|----------|
| [`docs/START.md`](docs/START.md) | Getting started: Docker, env vars, running without Docker, seeding, troubleshooting |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture, sequence diagrams, Elastic schema, middleware, Capacitor |
| [`docs/PRIVACY_SPEC.md`](docs/PRIVACY_SPEC.md) | Privacy model, data inventory, breach analysis, compliance notes |
| [`docs/FEATURE_SPEC.md`](docs/FEATURE_SPEC.md) | Complete specification for all 15 features |
| [`docs/TEST.md`](docs/TEST.md) | Testing guide, demo mode behaviour, Playwright test inventory |
| [`docs/PITCH_TEMPLATE.md`](docs/PITCH_TEMPLATE.md) | Demo script, submission checklist, third-party API list |
| [`CLAUDE.md`](CLAUDE.md) | AI assistant context (privacy rules, conventions, repo structure) |

## Third-Party APIs & Tools

- **NanoGPT API** (qwen3.5-122b-a10b) — humanisation + theme classification
- **Elasticsearch / Elastic Cloud** — vector similarity search + aggregations
- **Qwen3.5-0.8B via Ollama** — self-hosted anonymisation model
- **all-MiniLM-L6-v2** — local sentence embeddings (384-dim)
- **AI tools used during development**: Claude (claude.ai), Claude Code

## Prizes Targeting

- [ ] **AI Solutions Prize (Quantium)** — three-stage AI pipeline: SLM anonymisation, NanoGPT humanisation, Elastic vector semantic search
- [ ] **Best Use of Elastic Technology** — vector similarity, sentiment clustering, `search_after` pagination, real-time aggregate counts
- [ ] **Social Impact Prize** — mental health, ambient solidarity, zero clinical gatekeeping, built-in safety guardrails
- [ ] **Best Design** — breathing animation, count reveal, card scroll UX, Future You letters

## License

See [LICENSE](LICENSE).
