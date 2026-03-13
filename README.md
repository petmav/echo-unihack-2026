# Echo 🫂

> *You are not alone — proven with data.*

Built for **UNIHACK 2026** · March 13–15, 2026

## What is Echo?

Echo is a mental health app that shows you how many people have felt exactly what you're feeling right now — and what helped them get through it.

You type a thought. Echo finds everyone who felt the same. No accounts required to feel less alone.

## Team
| Name | Role |
|------|------|
| TBD  | TBD  |

## Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS (mobile-first)
- **Backend**: FastAPI (Python)
- **Anonymisation**: Anonymizer SLM 0.6B (self-hosted via Ollama) — raw thoughts never leave our server unprocessed
- **AI**: Claude (Anthropic) — humanises anonymised text only
- **Search**: Elasticsearch — vector similarity search + aggregate counts
- **Auth**: Email + bcrypt only

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker + Docker Compose
- [Ollama](https://ollama.ai) installed

### Setup
```bash
git clone <repo-url>
cd echo

# Pull the anonymiser model (one-time, ~400MB)
ollama pull hf.co/eternisai/anonymizer-0.6b-q4_k_m-gguf
ollama serve

# Configure environment
cp .env.example .env
# Fill in: ANTHROPIC_API_KEY, ELASTIC_CLOUD_ID, ELASTIC_API_KEY

# Start the app
docker-compose -f infra/docker-compose.yml up
```

Frontend: http://localhost:3000
Backend API: http://localhost:8000
API Docs: http://localhost:8000/docs

### Seed the database (required for demo)
```bash
cd backend && python scripts/seed.py
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — System architecture and data flow
- [`docs/PRIVACY_SPEC.md`](docs/PRIVACY_SPEC.md) — Privacy model and breach analysis
- [`docs/FEATURE_SPEC.md`](docs/FEATURE_SPEC.md) — Full feature specification
- [`docs/PITCH_TEMPLATE.md`](docs/PITCH_TEMPLATE.md) — Demo script and submission checklist
- [`CLAUDE.md`](CLAUDE.md) — Context for Claude Code

## Prizes Targeting
- [ ] AI Solutions Prize (Quantium)
- [ ] Best Use of Elastic Technology
- [ ] Social Impact Prize
- [ ] Best Design
