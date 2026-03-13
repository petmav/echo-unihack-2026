# Echo — Claude Code Context

## What This Is
**Echo** is a mental health app built for UNIHACK 2026 (March 13-15, 2026). 48-hour build.

The core loop: a user expresses a negative intrusive thought → it is anonymised on our servers by a local SLM → Claude humanises it → Elasticsearch finds others who felt the same → the user sees how many people share their experience and scrolls through their anonymised thoughts → people who resolved similar issues can share what helped, shown verbatim.

---

## The Problem Echo Solves
Intrusive negative thoughts are near-universal but feel uniquely isolating. Existing mental health apps are either clinical tools, social networks with all their risks, or generic affirmation generators. Echo does none of these. It uses search and AI to create ambient, anonymous solidarity — you are not alone, proven with data, without requiring you to talk to anyone.

---

## Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS — mobile-first
- **Backend**: FastAPI (Python), async, RESTful
- **Anonymisation**: Anonymizer SLM 0.6B (Eternis, HuggingFace) — self-hosted via Ollama
- **Humanisation**: Anthropic Claude API (`claude-sonnet-4-20250514`) — only ever sees anonymised text
- **Search/Storage**: Elasticsearch (Elastic Cloud)
- **Auth**: Email + bcrypt password hash only — no names, no DOB, nothing else
- **Infra**: Docker Compose for local dev

---

## Privacy Model — Read This First

This is the single most important architectural constraint. Every feature must respect it.

### Invariant: Raw thought text NEVER persists anywhere except the user's own device

The pipeline is:
```
User types thought (lives in browser RAM only)
        ↓
POST /api/v1/thoughts  (raw text in HTTPS request body only)
        ↓
[OUR SERVER] Anonymizer SLM 0.6B strips PII, preserves emotional specificity
             e.g. "My boss David at Google undermines me"
             →   "My [male name] at [tech company] undermines me"
             RAW TEXT IS DISCARDED IMMEDIATELY — never written to disk or logs
        ↓
[OUR SERVER] Claude receives ONLY the anonymised text
             Humanises to natural 50-60 word expression
             e.g. → "Someone at work consistently undermines me in front of
                     others, and it's eroding my confidence in myself."
        ↓
[ELASTIC]    Indexes: { message_id, humanised_text, sentiment_vector,
                        theme_category, timestamp_week }
             NO account_id. NO raw text. NO IP. NO device info.
        ↓
[OUR SERVER] Returns similar entries + match count to client
        ↓
[DEVICE]     Stores in localStorage: { message_id ↔ raw thought text }
             Personal history and trends computed locally, never uploaded
```

### What lives where

| Data | Location | Notes |
|------|----------|-------|
| Raw thought text | Device only (localStorage) | Never transmitted to any server in persistent form |
| Personal history & trends | Device only (localStorage) | All trend computation is client-side |
| Account (email + bcrypt hash) | Our server DB | Only PII we hold |
| message_id → theme mapping | Our server DB | Links account to themes, not raw text |
| Anonymised + humanised thoughts | Elastic | Zero account linkage |
| "What helped" text | Elastic (after SLM pass) | Stored and shown verbatim |

### Breach impact analysis

- **Our server breached**: Attacker gets email addresses linked to emotional theme categories. Cannot read raw thoughts. Cannot reconstruct original text.
- **Elastic breached**: Attacker gets humanised/anonymised thoughts with no user linkage whatsoever. Effectively an anonymous psychology dataset.
- **Device breached**: Attacker gets one user's own raw thoughts. No other user is affected.

### Hard rules for Claude Code — never violate these

1. NEVER log request bodies in any environment — raw thoughts transit in the body
2. NEVER write raw thought text to any database, log file, cache, or temp file
3. NEVER pass raw thought text to any external API — Claude only receives post-SLM output
4. NEVER store or log IP addresses
5. NEVER add account_id or user identifiers to Elastic documents
6. The anonymiser step is NOT optional and cannot be skipped or bypassed
7. `services/anonymiser.py` must be called FIRST in every pipeline that handles user text

---

## "What Helped" Flow

When a user resolves an issue they can optionally share what helped others. This advice text:
1. Goes through the same Anonymizer SLM 0.6B pass (PII stripped, specificity preserved)
2. Stored verbatim in Elastic, linked to the original thought's message_id
3. Shown verbatim to users who tap a response card — NOT paraphrased, NOT summarised by AI

**Why verbatim?** Misconstrued advice on personal mental health issues is a real harm. Typos are not. Highly specific advice from someone who shared an exact experience is more valuable than any AI-generated summary, and we must not risk changing its meaning.

### Triggering "what helped"
- A delayed opt-in prompt fires ~3 weeks after an unresolved thought, framed celebratorily: *"You haven't mentioned this in a while — did something shift for the better?"*
- Users can also proactively tap the resolve (✓) button on any history item at any time and immediately submit their advice without waiting for the prompt
- The resolve button lives inline on each history panel item

---

## UX Flow

### Primary interaction (mobile-first, 375px baseline)
1. App opens → logo centred on screen, slow breathing animation (inhale/exhale loop)
2. Tap logo → input bubble floats up, soft haptic if available
3. User types thought and submits
4. **The breathing moment**: 2-3 seconds, animated inhale/exhale, subtle *"finding your people..."* text. This is emotionally meaningful — not a spinner. Do not skip or shorten it.
5. **Count reveal**: animated number tick-up — *"847 people have felt something like this"*
6. **Flow into response cards**: humanised thoughts from others, full-bleed cards, scrollable
7. Pagination: load 10-20 cards at a time, append next page on scroll-to-bottom (Elastic `search_after`)
8. Cards with "what helped" attached have a subtle visual distinction (soft highlight or badge)
9. Tap a card → bottom sheet slides up showing the verbatim "what helped" text

### Navigation
- Hamburger (top-left) → history panel slides in
- History panel: each entry shows truncated raw thought (local), resolve (✓) button, "what helped?" expandable field
- Resolved entries visually marked (muted, checkmark)
- Settings: account info (email only), notification opt-in for delayed prompts, delete account

### Auth
- Email + password only
- No name, no DOB, no profile photo, no phone number
- JWT stored in localStorage, 7-day expiry, refresh on activity
- DELETE /api/v1/account endpoint that purges all server-side data for the user

---

## Repo Structure
```
frontend/
  src/
    app/                  → Next.js App Router pages
    components/
      ui/                 → Primitives (Button, Card, BottomSheet, etc.)
      echo/               → Echo-specific components (LogoBubble, ThoughtCard,
                            BreathingAnimation, CountReveal, HistoryPanel)
    lib/
      api.ts              → All backend fetch calls — single source of truth
      storage.ts          → localStorage helpers (raw thoughts, history, trends)
                            Raw thought text only ever touches this file
backend/
  routers/
    thoughts.py           → POST /thoughts, GET /thoughts/similar
    auth.py               → POST /auth/register, /auth/login, /auth/refresh
    resolution.py         → POST /resolution (what helped), GET /resolution/{id}
    account.py            → GET/DELETE /account
  services/
    anonymiser.py         → Anonymizer SLM 0.6B via Ollama — ALWAYS CALLED FIRST
    ai.py                 → Claude API — ONLY called after anonymiser
    elastic.py            → All Elasticsearch operations
    auth.py               → JWT creation/validation, bcrypt hashing
  models/
    thought.py            → Pydantic schemas for thought pipeline
    auth.py               → Pydantic schemas for auth
    resolution.py         → Pydantic schemas for what-helped flow
infra/
  docker-compose.yml
docs/
  ARCHITECTURE.md         → Full system architecture and data flow
  PRIVACY_SPEC.md         → Privacy model, breach analysis, compliance notes
  PITCH_TEMPLATE.md       → Demo script and submission checklist
  FEATURE_SPEC.md         → Complete feature specification
```

---

## Running Locally
```bash
# 1. Pull and serve the anonymiser model (one-time)
ollama pull hf.co/eternisai/anonymizer-0.6b-q4_k_m-gguf
ollama serve   # runs on localhost:11434

# 2. Fill in env vars
cp .env.example .env

# 3. Start everything
docker-compose -f infra/docker-compose.yml up

# Or individually:
cd frontend && npm install && npm run dev    # http://localhost:3000
cd backend && uvicorn main:app --reload     # http://localhost:8000
```

---

## Development Conventions
- TypeScript strict mode throughout frontend
- Pydantic models for ALL request/response shapes in backend
- All API routes prefixed `/api/v1/`
- Components: primitives in `components/ui/`, Echo-specific in `components/echo/`
- Raw thought text is ONLY handled inside `frontend/src/lib/storage.ts`
- The anonymiser service is ALWAYS the first service called for any user-generated text
- Claude is ALWAYS called after the anonymiser, never before
- Mobile-first CSS — design at 375px, enhance upward
- All Elastic operations go through `services/elastic.py` only

---

## Prizes We're Targeting
1. **AI Solutions Prize (Quantium)** — three-stage AI pipeline: SLM anonymisation, Claude humanisation, Elastic vector semantic retrieval
2. **Best Use of Elastic Technology** — vector similarity search, sentiment clustering, `search_after` pagination, real-time aggregate counts
3. **Social Impact Prize** — mental health, ambient solidarity, zero clinical gatekeeping, accessible to anyone
4. **Best Design** — breathing animation, count reveal, card scroll, the logo-tap bubble interaction

---

## Judging Criteria Reminders
- **Polish & Design**: This needs to feel like a real product, not a hackathon prototype. Breathing animation and count reveal are the money shots — get them right first.
- **Technical Difficulty**: Three-stage pipeline (self-hosted SLM → Claude → Elastic vector search) with a privacy architecture is genuinely non-trivial.
- **Originality**: No app does ambient anonymous solidarity with semantic matching + peer resolution advice with this privacy model.
- **Wow Factor**: *"847 people have felt this."* Seed the database before the demo.

---

## Demo Script
Don't open with the app. Open with: *"Has anyone here had a thought they were too ashamed to say out loud?"* Pause. Then open the laptop.

The count reveal is the money shot — make sure Elastic is seeded with enough data before judging begins.
