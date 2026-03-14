# Echo 🫂

> *You are not alone — proven with data.*

Built for **UNIHACK 2026** · March 13–15, 2026

## What is Echo?

Echo is a mental health app that shows you how many people have felt exactly what you're feeling right now — and what helped them get through it.

You type a thought. Echo finds everyone who felt the same. Or tap a topic bubble (work stress, loneliness, anxiety, etc.) to explore others' thoughts without typing. No accounts required to feel less alone.

## Team
| Name | Role |
|------|------|
| TBD  | TBD  |

## Stack

- **Frontend**: Next.js 16, TypeScript, Tailwind CSS (mobile-first)
- **Backend**: FastAPI (Python)
- **Anonymisation**: Qwen3.5-0.8B (self-hosted via Ollama) — raw thoughts never leave our server unprocessed
- **AI**: NanoGPT API — qwen3.5-122b-a10b — humanises anonymised text only
- **Search**: Elasticsearch — vector similarity search + aggregate counts
- **Auth**: Email + bcrypt only

## Quick Start

### Prerequisites
- Docker + Docker Compose

> **Note**: Elasticsearch runs on [Elastic Cloud](https://cloud.elastic.co) — no local Elasticsearch required.

### Setup
```bash
git clone <repo-url>
cd echo-unihack-2026

# 1. Configure environment
cp .env.example .env
# Fill in: NANOGPT_API_KEY, ELASTIC_HOST, ELASTIC_API_KEY, JWT_SECRET

# 2. Start all services (backend, frontend, ollama)
docker-compose -f infra/docker-compose.yml up -d

# 3. Pull the anonymiser model into the ollama container (one-time, ~400MB)
docker-compose -f infra/docker-compose.yml exec ollama ollama pull qwen3.5:0.8b
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Key features
- **Surrounding topics** — Topic bubbles (work stress, loneliness, anxiety, etc.) float around the home screen and the thought input overlay. Tap any bubble to open a page of others' thoughts on that theme.
- **Topic exploration** — Browse thoughts by theme without typing. Uses the same similarity search as thought submission; falls back to demo data when the backend has no data for a theme.

### Seed the database (required for demo)
```bash
cd backend && python seed_elastic.py
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — System architecture and data flow
- [`docs/PRIVACY_SPEC.md`](docs/PRIVACY_SPEC.md) — Privacy model and breach analysis
- [`docs/FEATURE_SPEC.md`](docs/FEATURE_SPEC.md) — Full feature specification
- [`docs/PITCH_TEMPLATE.md`](docs/PITCH_TEMPLATE.md) — Demo script and submission checklist
- [`docs/TEST.md`](docs/TEST.md) — Testing and demo guide (demo mode, Future You, Safety Banner)
- [`CLAUDE.md`](CLAUDE.md) — Context for Claude Code

## Prizes Targeting
- [ ] AI Solutions Prize (Quantium)
- [ ] Best Use of Elastic Technology
- [ ] Social Impact Prize
- [ ] Best Design
