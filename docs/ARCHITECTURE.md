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
│  1. Qwen3.5-0.8B (Ollama)                            │
│     - Strips PII, preserves specificity              │
│     - Raw text discarded after this step             │
│                                                      │
│  2. NanoGPT API (qwen3.5-122b-a10b)                  │
│     - Humanises anonymised text (50-60 words)        │
│     - Never sees raw input                           │
│                                                      │
│  3. PostgreSQL                                       │
│     - accounts: { id, email, bcrypt_hash }           │
│     - message_themes: { account_id, message_id,      │
│                         theme_category, created_at } │
│     (no raw text, no Elastic linkage)                │
│                                                      │
└──────────┬──────────────────┬───────────────────────┘
           │                  │
           ▼                  ▼
┌──────────────────┐  ┌──────────────────────────────┐
│   Elastic Cloud  │  │  NanoGPT API                 │
│   (Serverless)   │  │  qwen3.5-122b-a10b           │
│  - thought docs  │  │  (receives anonymised text   │
│  - resolution    │  │   only, never raw input)     │
│    docs          │  └──────────────────────────────┘
│  - NO user IDs   │
│  - NO raw text   │
└──────────────────┘
```

---

## Thought Submission Pipeline

### Step 1 — Client submission
The frontend POSTs the raw thought text over HTTPS to `/api/v1/thoughts`. This is the only moment raw text exists outside the device. It lives in the request body in memory only — never logged, never cached.

### Step 2 — Anonymisation (Qwen3.5-0.8B via Ollama)
The anonymiser model runs locally on our server via Ollama. It performs **semantic-preserving PII replacement**, not simple redaction:

| Input | Output |
|-------|--------|
| "My boss David at Google undermines me" | "My [male name] at [tech company] undermines me" |
| "Since moving to Brisbane I've felt so alone" | "Since moving to [city] I've felt so alone" |
| "My mum keeps calling me a failure" | "My [family member] keeps calling me a failure" |

The raw text is discarded from memory immediately after this step. It is never written to disk, never logged, never passed to any downstream service.

### Step 3 — Humanisation (NanoGPT — qwen3.5-122b-a10b)
The NanoGPT API receives only the anonymised text and rewrites it as a natural, emotionally resonant 50-60 word expression. This is what other users see — it reads like a human wrote it, without being that specific human's words.

Prompt structure:
```
System: You are an empathetic rewriter. Convert the anonymized thought you receive
        into a warm, natural first-person expression between 50 and 60 words.
        Replace any bracketed placeholders like [male name], [female name], [company],
        [location] with natural generic references (e.g. 'someone', 'a person',
        'my workplace', 'where I live').
        Preserve the emotional specificity and the core feeling.
        Do not add advice, questions, or affirmations.
        Output ONLY the rewritten thought — no preamble, no commentary.

User:   [anonymised text]
```

### Step 3b — Theme classification (NanoGPT — qwen3.5-122b-a10b)
A second NanoGPT call classifies the humanised text into exactly one of ~30 emotional theme categories (e.g. `work_stress`, `loneliness`, `self_doubt`, `suicidal_ideation`). The theme is used for Elastic search grouping, the safety banner, Future You letter matching, and the breathing animation co-presence level. Falls back to `"other"` if the returned label is not in the valid set.

### Step 4 — Elastic indexing
The humanised text is indexed in Elasticsearch with:
- `message_id` (random UUID, generated server-side)
- `humanised_text` (the Claude output)
- `sentiment_vector` (384-dim dense vector for similarity search, generated by all-MiniLM-L6-v2)
- `theme_category` (emotional category, e.g. `work_stress`, `loneliness`, `self_doubt`)
- `timestamp_week` (ISO week string only, e.g. `"2024-W11"`, not a full datetime)
- `has_resolution` (boolean, updated when "what helped" is submitted)

**Critically absent**: account_id, user_id, IP address, raw text, exact datetime.

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
Qwen3.5-0.8B pass (same model, same server)
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

Two indices are used:

**`echo-thoughts`**
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
      "timestamp_week":    { "type": "keyword" },
      "has_resolution":    { "type": "boolean" }
    }
  }
}
```

**`echo-resolutions`**
```json
{
  "mappings": {
    "properties": {
      "message_id":       { "type": "keyword" },
      "anonymised_text":  { "type": "text" },
      "submitted_at":     { "type": "date" }
    }
  }
}
```

Sentiment vectors are generated using a local sentence-transformer model (all-MiniLM-L6-v2, 384-dim) via `services/embeddings.py` — no external API call needed for embeddings. `timestamp_week` is stored as an ISO week string (e.g. `"2024-W11"`, type `keyword`). Resolution text lives in a dedicated index, not inside the thought document.

---

## "Breathing With Others" — Aggregate Theme Counts

The home screen breathing animation is influenced by weekly aggregate counts per emotional theme. This uses Elasticsearch's aggregation framework:

```
GET /api/v1/thoughts/aggregates

Backend query:
{
  "size": 0,
  "query": {
    "term": { "timestamp_week": "<current_iso_week>" }
  },
  "aggs": {
    "themes": {
      "terms": { "field": "theme_category", "size": 100 }
    }
  }
}

Response: [{ "theme": "work_stress", "count": 342 }, ...]
```

`<current_iso_week>` is formatted as `"YYYY-W##"` (e.g. `"2024-W11"`). Falls back to hardcoded demo aggregates if Elasticsearch is unavailable or returns no results.

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

**Model**: Qwen3.5-0.8B
**Served via**: Ollama (`localhost:11434`), model alias `anonymizer`
**Pull command**: `ollama pull qwen3.5:0.8b && ollama cp qwen3.5:0.8b anonymizer`
**Inference time**: Target <500ms per thought on standard server hardware (verify on actual hardware before demo)

---

## Middleware Stack

The FastAPI backend includes four middleware layers (applied in order):

| Middleware | File | Purpose |
|-----------|------|---------|
| CORS | `middleware/cors.py` | Allows requests from `localhost:3000` / `127.0.0.1:3000` |
| Request size limit | `middleware/request_size.py` | Caps request body at 10 KB (prevents large text abuse) |
| Rate limiting | `middleware/rate_limit.py` | Per-account (JWT) or per-hashed-IP limits; thoughts: 10/hr, login: 5/15 min, resolution: 5/hr |
| Custom logging | `middleware/logging.py` | Logs method/path/status only — never request bodies |

---

## localStorage Encryption

All localStorage keys that contain user-generated text (`echo_thoughts`, `echo_future_letters`) are encrypted at rest using **AES-GCM** via the Web Crypto API (`frontend/src/lib/crypto.ts`). The encryption key is derived from the user's session. Plaintext raw thoughts never sit unencrypted in localStorage on an authenticated device.

---

## Infrastructure

### Local development
- Docker Compose (`infra/docker-compose.yml`) starts PostgreSQL, Ollama, FastAPI backend, and Next.js frontend as four services
- Health checks are defined for all services; backend depends on postgres + ollama being healthy
- Elastic Cloud free tier for development

### Production (if deploying for judging)
Recommended minimal stack:
- **Backend**: Railway or Fly.io (single container)
- **Frontend**: Vercel (web) or sideloaded APK (Android demo)
- **Elastic**: Elastic Cloud free tier (14-day trial covers the event)
- **Ollama/SLM**: Must run on same machine as backend, or a small VPS (DigitalOcean $12/mo droplet is sufficient for the anonymiser at hackathon scale)

---

## Android App (Capacitor)

Echo ships as a native Android APK using [Capacitor](https://capacitorjs.com/). The approach wraps the Next.js static export in an Android WebView shell — zero code rewrite, identical behaviour to the web version.

### How it works

```
next build (NEXT_OUTPUT=export)  →  out/
                                         ↓
                              npx cap sync android
                                         ↓
              android/app/src/main/assets/public/   (WebView serves these)
                                         ↓
                    ./gradlew assembleDebug  →  app-debug.apk
```

The APK contains the entire frontend as static assets. The WebView loads `index.html` locally — no web server needed. All API calls still go over the network to the backend.

### Key configuration

| Setting | Location | Value |
|---------|----------|-------|
| `output` mode | `next.config.ts` | Switches between `standalone` (Docker) and `export` (Capacitor) via `NEXT_OUTPUT` env var |
| `webDir` | `capacitor.config.ts` | `out` — the Next.js static export directory |
| `androidScheme` | `capacitor.config.ts` | `https` — required for Web Crypto API (secure context) |
| `allowMixedContent` | `capacitor.config.ts` | `true` — allows HTTP backend during local demo |

### Native plugins in use

| Plugin | Purpose |
|--------|---------|
| `@capacitor/status-bar` | Sets status bar to `#FAF7F2` on app launch |
| `@capacitor/haptics` | Light haptic on logo tap and thought submit |
| `@capacitor/app` | Hardware back button: closes open panel, or minimizes app from home screen |

All plugin calls are guarded by `Capacitor.isNativePlatform()` — they're no-ops in the web browser.

### Backend URL

`NEXT_PUBLIC_API_URL` is a build-time constant baked into the static export. Two options:

- **CI/CD** (recommended): set `NEXT_PUBLIC_API_URL` as a GitHub repository secret. The `Build Android APK` workflow picks it up automatically.
- **Local/LAN demo**: build locally with `NEXT_PUBLIC_API_URL=http://<LAPTOP_LAN_IP>:8000/api/v1`. The phone and laptop must be on the same WiFi network. If the IP changes, rebuild.

### CI/CD workflow

`.github/workflows/build-apk.yml` runs on:
- Every push to `main` that touches `frontend/`
- Manual dispatch (with optional `api_url` override input)

The APK is uploaded as a workflow artifact (retained 14 days) and can be installed directly via `adb install app-debug.apk`.

Note: GitHub-hosted `ubuntu-latest` runners ship with Android SDK pre-installed. No additional runner setup is needed.

---

## Sequence Diagram — Full Thought Submission

```
Client          Backend         Ollama(SLM)     NanoGPT API     Elastic
  │                │                │               │              │
  │─ POST /thoughts ──────────────>│                │              │
  │                │─ anonymise ──>│                │              │
  │                │<── stripped ──│                │              │
  │                │  [raw discarded]               │              │
  │                │─────────── humanise ──────────>│              │
  │                │<─────────── humanised ──────────│              │
  │                │─────────── classify_theme ─────>│              │
  │                │<─────────── theme_category ─────│              │
  │                │──────────────────── index ──────────────────>│
  │                │<───────────────── confirmed ────────────────-│
  │                │──────────────────── kNN search ─────────────>│
  │                │<─────────────────── results ────────────────-│
  │<── {message_id, theme_category, count, results} ──────────────│
  │  [store message_id↔raw in encrypted localStorage]
```
