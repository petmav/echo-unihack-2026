# Echo — System Architecture

## Overview

Echo is a three-tier web application with a privacy-first architecture. The central design principle is **data minimisation at every layer**: each component in the pipeline receives only the minimum information needed to perform its function, and raw user input never persists outside the user's own device.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                   USER'S DEVICE                      │
│                                                      │
│  Next.js App (mobile-first)                          │
│  ┌─────────────────────────────────────────────┐    │
│  │  localStorage                                │    │
│  │  - Raw thought text (never leaves device)    │    │
│  │  - message_id ↔ raw text mapping             │    │
│  │  - Personal history                          │    │
│  │  - Trends (computed locally)                 │    │
│  └─────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS (anonymised text only
                       │ after this point)
┌──────────────────────▼──────────────────────────────┐
│                  OUR SERVER                          │
│                                                      │
│  FastAPI (Python)                                    │
│                                                      │
│  1. Anonymizer SLM 0.6B (Ollama)                     │
│     - Strips PII, preserves specificity              │
│     - Raw text discarded after this step             │
│                                                      │
│  2. Claude API                                       │
│     - Humanises anonymised text (50-60 words)        │
│     - Never sees raw input                           │
│                                                      │
│  3. PostgreSQL                                       │
│     - accounts: { id, email, bcrypt_hash }           │
│     - thought_meta: { account_id, message_id,        │
│                       theme_category, created_week } │
│     (no raw text, no Elastic linkage)                │
│                                                      │
└──────────┬──────────────────┬───────────────────────┘
           │                  │
           ▼                  ▼
┌──────────────────┐  ┌──────────────────────────────┐
│   Elastic Cloud  │  │  Anthropic API               │
│                  │  │  (receives anonymised text   │
│  - thought docs  │  │   only, never raw input)     │
│  - resolution    │  └──────────────────────────────┘
│    docs          │
│  - NO user IDs   │
│  - NO raw text   │
└──────────────────┘
```

---

## Thought Submission Pipeline

### Step 1 — Client submission
The frontend POSTs the raw thought text over HTTPS to `/api/v1/thoughts`. This is the only moment raw text exists outside the device. It lives in the request body in memory only — never logged, never cached.

### Step 2 — Anonymisation (Anonymizer SLM 0.6B)
The anonymiser model runs locally on our server via Ollama. It performs **semantic-preserving PII replacement**, not simple redaction:

| Input | Output |
|-------|--------|
| "My boss David at Google undermines me" | "My [male name] at [tech company] undermines me" |
| "Since moving to Brisbane I've felt so alone" | "Since moving to [city] I've felt so alone" |
| "My mum keeps calling me a failure" | "My [family member] keeps calling me a failure" |

The raw text is discarded from memory immediately after this step. It is never written to disk, never logged, never passed to any downstream service.

### Step 3 — Humanisation (Claude)
Claude receives only the anonymised text and rewrites it as a natural, emotionally resonant 50-60 word expression. This is what other users see — it reads like a human wrote it, without being that specific human's words.

Prompt structure:
```
System: You are helping people feel less alone. Rewrite the following anonymised
        thought as a natural, empathetic 50-60 word expression. Preserve the
        emotional specificity. Do not add interpretation or advice.

User:   [anonymised text]
```

### Step 4 — Elastic indexing
The humanised text is indexed in Elasticsearch with:
- `message_id` (random UUID, generated server-side)
- `humanised_text` (the Claude output)
- `sentiment_vector` (dense vector for similarity search)
- `theme_category` (broad emotional category, e.g. "professional_worth", "relationship_loss")
- `timestamp_week` (week number only, not datetime)
- `has_resolution` (boolean, updated when "what helped" is submitted)

**Critically absent**: account_id, user_id, IP address, raw text, datetime.

### Step 5 — Similarity search
Elasticsearch performs vector similarity search against the sentiment_vector field to return the N most semantically similar thoughts from other users. A count of total matches is returned alongside.

### Step 6 — Client storage
The server returns the `message_id` and match results to the client. The client stores `{ message_id: rawThoughtText }` in localStorage. This is the only persistent record of the raw thought — on the user's own device.

---

## "What Helped" Pipeline

```
User writes resolution text
        ↓
POST /api/v1/resolution  (text in HTTPS body)
        ↓
Anonymizer SLM 0.6B pass (same model, same server)
PII stripped, specificity preserved
Raw text discarded
        ↓
Stored verbatim in Elastic, linked to original message_id
{ message_id, resolution_text (anonymised), submitted_at_week }
        ↓
Shown verbatim to other users who tap the response card
NOT summarised, NOT paraphrased, NOT processed further
```

---

## Authentication

- Email + bcrypt(password, cost=12) stored in PostgreSQL
- JWT issued on login, 7-day expiry, refreshed on activity
- JWT stored in localStorage client-side
- No sessions table — stateless auth
- DELETE /api/v1/account triggers deletion of all thought_meta rows for that account. Elastic documents are NOT deleted (they have no account linkage and remain as anonymous aggregate data).

---

## Elasticsearch Schema

```json
{
  "mappings": {
    "properties": {
      "message_id":        { "type": "keyword" },
      "humanised_text":    { "type": "text" },
      "sentiment_vector":  {
        "type": "dense_vector",
        "dims": 384,
        "index": true,
        "similarity": "cosine"
      },
      "theme_category":    { "type": "keyword" },
      "timestamp_week":    { "type": "integer" },
      "has_resolution":    { "type": "boolean" },
      "resolution_text":   { "type": "text" }
    }
  }
}
```

Sentiment vectors are generated using a local sentence-transformer model (all-MiniLM-L6-v2 via sentence-transformers Python library) — no external API call needed for embeddings.

---

## "Breathing With Others" — Aggregate Theme Counts

The home screen breathing animation is influenced by weekly aggregate counts per emotional theme. This uses Elasticsearch's aggregation framework:

```
GET /api/v1/thoughts/aggregates

Backend query:
{
  "size": 0,
  "query": {
    "range": { "timestamp_week": { "gte": current_week_number } }
  },
  "aggs": {
    "by_theme": {
      "terms": { "field": "theme_category", "size": 50 }
    }
  }
}

Response: [{ "theme": "self_worth", "count": 342 }, ...]
```

The client maps the count for the user's most recent theme to a presence level (0–4), which adjusts the logo's visual parameters. No user IDs are involved — this is purely aggregate data.

---

## "Future You" — Local-Only Letters

Future You letters are stored entirely in the client's localStorage:

```json
{
  "echo_future_letters": [
    {
      "message_id": "abc-123",
      "theme_category": "self_worth",
      "letter_text": "Remember that the comparison trap is just that — a trap.",
      "timestamp": 1710000000000
    }
  ]
}
```

When a new thought is submitted and results return with a `theme_category`, the client checks localStorage for letters with the same theme. No server involvement.

---

## "Guardrails of Care" — Client-Side Safety Layer

Safety resources are rendered purely client-side using a static mapping:

```typescript
RISK_THEMES = { "self_harm", "suicidal_ideation", "crisis",
                "substance_abuse", "eating_disorder", "abuse",
                "domestic_violence" }
```

When `theme_category` from the thought submission response matches any risk theme, a `SafetyBanner` component renders above the response cards. No API call, no log, no localStorage write. The banner contains static helpline numbers and is country-agnostic.

---

## Pagination

Response cards are paginated using Elasticsearch's `search_after` pattern:
- Initial load: 15 cards
- On scroll-to-bottom: append next 15
- Each response includes a `sort` value used as the `search_after` cursor for the next page
- This is stateless and scales to any dataset size

---

## Anonymiser Model

**Model**: Anonymizer SLM 0.6B by Eternis (HuggingFace)
**Served via**: Ollama (`localhost:11434`)
**Quantisation**: Q4_K_M (fits comfortably in CPU RAM, no GPU required)
**Inference time**: Target <500ms per thought on standard server hardware (verify on actual hardware before demo)

Model collection: https://huggingface.co/collections/eternisai/anonymizer-model-series-68af60ea2688db0aba1d564f

---

## Infrastructure

### Local development
- Docker Compose starts FastAPI backend + Next.js frontend
- Ollama runs separately (not containerised, runs on host)
- Elastic Cloud free tier for development

### Production (if deploying for judging)
Recommended minimal stack:
- **Backend**: Railway or Fly.io (single container)
- **Frontend**: Vercel
- **Elastic**: Elastic Cloud free tier (14-day trial covers the event)
- **Ollama/SLM**: Must run on same machine as backend, or a small VPS (DigitalOcean $12/mo droplet is sufficient for the anonymiser at hackathon scale)

---

## Sequence Diagram — Full Thought Submission

```
Client          Backend         Ollama(SLM)     Claude API      Elastic
  │                │                │               │              │
  │─ POST /thoughts ──────────────>│                │              │
  │                │─ anonymise ──>│                │              │
  │                │<── stripped ──│                │              │
  │                │  [raw discarded]               │              │
  │                │─────────── humanise ─────────>│              │
  │                │<─────────── humanised ─────────│              │
  │                │──────────────────── index ──────────────────>│
  │                │<───────────────── message_id ───────────────-│
  │                │──────────────────── search ─────────────────>│
  │                │<─────────────────── results ────────────────-│
  │<── {message_id, count, results} ──────────────────────────────│
  │  [store message_id↔raw in localStorage]
```
