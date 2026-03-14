# Echo — Feature Specification

## Core Feature Set

---

### 1. Thought Submission

**Entry point**: The app opens directly to the home screen — no onboarding, no splash, no tutorial. The Echo logo sits centred on screen with a slow breathing animation (inhale 3s, hold 1s, exhale 3s, repeat).

**Interaction**: Tapping the logo triggers the input bubble. The bubble floats up from the logo position, expands to a comfortable text input area. Soft haptic feedback on supported devices.

**Input constraints**:
- Plain text only, no formatting
- Suggested max ~280 characters (a thought, not an essay)
- Character count shown when approaching limit
- Submit on tap of send button or keyboard submit

**Processing state**: After submission, the input bubble collapses back and the breathing animation resumes. Overlay text cycles slowly through (≈2.8s per phrase):
- *"finding your people..."*
- *"you're not alone in this..."*
- *"others have been here too..."*

Duration: 2-3 seconds minimum regardless of actual processing time. This pause is intentional — it gives the moment weight.

**Count reveal**: The breathing animation fades and a number ticks up from 0 to the match count. Typography is large, centred, bold. Below it: *"people have felt something like this."*

**Response cards flow in** beneath the count, smooth scroll animation.

---

### 2. Response Cards

Each card displays the Claude-humanised anonymised thought from another user (50-60 words). Cards are full-width, comfortable padding, soft card shadow.

**Visual states**:
- Standard card: no resolution attached
- Highlighted card: has "what helped" attached — subtle warm background tint, small badge e.g. *"someone found a way through"*

**Pagination**: 15 cards on initial load. On scroll-to-bottom, next 15 are appended silently (no loading indicator unless slow — use skeleton cards if >500ms).

**Advice-first toggle**: Above the cards, a block card contains the switch *"Show only what helped"*. When on, the list filters to cards that have an attached resolution. Client-side filter only.

**Tap behaviour**: Tapping a standard card does nothing (or a subtle expand animation showing full text if truncated). Tapping a highlighted card opens a bottom sheet showing the verbatim "what helped" text.

**Bottom sheet**: Clean, readable, full verbatim text of the resolution. Shown exactly as submitted — typos included. No AI processing, no reformatting. A small note at the bottom: *"Written by someone who's been there."*

---

### 3. History Panel

Accessed via hamburger menu (top-left). Slides in as a side drawer.

**Contents**: A list of the user's submitted thoughts, sourced from localStorage. Each item shows:
- Truncated raw thought text (first ~60 chars)
- Match count when available: *"N people have felt something like this"* (from the search at submit time)
- Submission date (stored locally)
- Resolution status indicator (resolved ✓ / unresolved)

**Per-item actions**:
- **Resolve button (✓)**: Marks the item as resolved. Triggers the "what helped" input inline (expandable text field directly below the item). Submitting the text runs it through the anonymisation pipeline and stores it.
- **Unresolved items** older than ~3 weeks display a soft pulsing indicator as a gentle prompt (not a notification, just visual)

**Resolved items**: Shown in a muted style with a checkmark. Can still be tapped to view/edit the "what helped" text.

---

### 4. "What Helped" Submission

**Triggered by**:
- Proactive: user taps ✓ on any history item at any time
- Prompted: delayed opt-in push/in-app notification (~3 weeks after unresolved thought)

**Prompt framing** (celebratory, never clinical):
> *"Hey — you mentioned feeling [theme] a while back. We noticed you haven't brought it up recently. Did something shift for the better? If so, others who feel the same would love to know what helped."*

**Input**: Free text, no character limit (reasonable UX limit ~500 chars). No formatting.

**What happens to it**:
1. Sent to `/api/v1/resolution` over HTTPS
2. Qwen3.5-0.8B (Ollama) anonymisation pass on our server (PII stripped, specificity preserved)
3. Stored verbatim in Elastic, linked to original message_id
4. Shown verbatim to other users — no AI processing

**Opt-out**: Users can disable delayed prompts in Settings. Proactive resolve is always available regardless.

---

### 5. Personal Trends Dashboard

Accessed from the history panel or hamburger menu.

**All computation is local** — no server involved. The trends are derived from the theme categories stored alongside message_ids in localStorage.

**Displays**:
- Most frequent emotional themes over time
- Frequency chart (simple bar or line, last 12 weeks)
- Resolution rate (% of thoughts marked resolved)
- Streak/cadence info if applicable

**Privacy note visible in UI**: *"This data lives only on your device and is never uploaded."*

---

### 6. Authentication

**Signup**: Email + password. Nothing else. No name field, no DOB, no phone.

**Login**: Email + password → JWT returned → stored in localStorage.

**Session**: 7-day JWT expiry. Silently refreshed on app open if within expiry window.

**Account deletion**: Settings → Delete Account → confirmation dialog → `DELETE /api/v1/account` → all server-side data purged → localStorage cleared → user returned to signup screen.

**Forgot password**: Standard email reset flow (requires email sending capability — use a transactional email service like Resend or SendGrid).

---

### 7. Onboarding (minimal)

First app open only:
1. Brief animated explanation of what Echo is (3 cards, swipeable, skippable)
2. Privacy statement — plain language, not legal boilerplate: *"Your words stay on your device. We only ever see the emotion, never the details."*
3. Signup / Login prompt
4. Done — straight to home screen

No tutorial overlay, no tooltips. The app should be self-evident.

---

### 8. "Breathing With Others" — Ambient Co-Presence

**What**: The breathing animation on the home screen is subtly influenced by how many other people are sharing thoughts in the same emotional space that week. This is ambient, anonymous co-presence — you can *feel* that others are here without seeing or identifying anyone.

**Visual states** (mapped from aggregate weekly theme counts):

| Presence Level | Threshold | Visual Change |
|---|---|---|
| 0 (quiet) | 0–9 | Default breathing animation |
| 1 (present) | 10–49 | Slightly deeper arc hue, +5% opacity on ripples |
| 2 (gathering) | 50–199 | Warmer arc colour, +10% ripple opacity, ambient glow more visible |
| 3 (together) | 200–499 | Noticeably deeper hue, +15% ripples, slightly slower/deeper breathing |
| 4 (resonant) | 500+ | Deepest hue, +20% ripples, strongest glow, slowest breathing rhythm |

**Text indicator**: Below the logo, a subtle line: *"127 others breathing in this space this week"*

**Data source**: `GET /api/v1/thoughts/aggregates` returns per-theme weekly counts from Elastic (no user IDs). Falls back to demo random data if backend is unavailable.

**Privacy**: Aggregate-only. No individual tracking. The count cannot be attributed to any user.

---

### 9. "Future You" — One-Way Letters to Your Future Self

**What**: After resolving a thought and writing "what helped", users see an optional prompt: *"Write a note to your future self?"* The note is stored locally and resurfaces when a similar theme appears again.

**Flow**:
1. User resolves a thought and submits "what helped"
2. Below the resolution, a subtle trigger appears: envelope icon + "Write a note to your future self?"
3. Tapping expands a textarea with prompt: *"If this feeling comes back, what would you want to remember?"*
4. User writes and saves → stored in localStorage keyed by `message_id` and `theme_category`
5. Next time the user submits a thought with a matching `theme_category`, the letter appears as a banner above the response cards: *"A note from past you"*

**Storage**: `echo_future_letters` key in localStorage. Array of `{ message_id, theme_category, letter_text, timestamp }`.

**Matching**: When results screen loads with a `theme_category`, local storage is checked for any letters with the same theme. Most recent match is shown.

**Privacy**: 100% local. Never uploaded. Cleared on account deletion.

---

### 10. "Guardrails of Care" — Light-Touch Safety Layer

**What**: When the theme classification for a submitted thought falls into risk-related categories, a static safety resource block appears above the response cards. No clinical intervention, no logging — just a visible, static set of helpline numbers.

**Risk theme categories**: `self_harm`, `suicidal_ideation`, `crisis`, `substance_abuse`, `eating_disorder`, `abuse`, `domestic_violence`

**Safety block content**:
- Heading: *"You're not alone — and help is available"*
- Body: *"If you or someone you know is in immediate danger, please reach out."*
- Contact list:
  - Lifeline (AU): 13 11 14
  - Crisis Text Line: Text HOME to 741741
  - Beyond Blue (AU): 1300 22 4636
  - IASP: Find help near you (link)
- Footer: *"This information is shown based on the topic of your thought. It is not logged or recorded in any way."*

**Rendering**: Entirely client-side. The `theme_category` string is matched against a static set of risk categories. No API call, no event emitted, no log written.

**Privacy**: Zero logging. The safety banner display is never recorded anywhere — not in localStorage, not in any API call, not in any analytics. This is a deliberate design choice: users in crisis should never worry that asking for help will leave a trace.

---

### 11. Surrounding Topics & Topic Exploration

**What**: Topic bubbles (work stress, loneliness, anxiety, grief, family pressure, etc.) float around the home screen and the thought input overlay. Bubbles cycle every ~6 seconds with different topics and positions. Tapping a bubble opens a new screen: *"Others on [topic]"* with a scrollable list of thoughts in that theme.

**Visual style**: Bubbles have a deeper shadow, a shining border (white glow at ~35–55% opacity), and a subtle breathe animation (scale 1 → 1.05 → 1.03 → 1.05 → 1 over 5s).

**Flow**:
1. Topic bubbles appear in the perimeter (never blocking the logo or central CTA), and remain clickable when the thought input overlay is open
2. User taps a bubble (home or input overlay) → input closes if open → haptic feedback → navigate to topic screen
3. Backend: `GET /api/v1/thoughts/seed-for-theme?theme=X` returns one `message_id` for that theme
4. Frontend calls `GET /api/v1/thoughts/similar?message_id=...` for semantic similarity results
5. Falls back to `GET /api/v1/thoughts/by-theme?theme=X` if no seed, then to demo data if both return empty
6. Topic screen: back button, title, thought count, `ThoughtCardList` with pagination

**Privacy**: Same as main thought flow — only anonymised/humanised thoughts are returned. No user linkage.

**Mobile**: 44px minimum touch targets on bubbles, safe-area padding, `touch-action: manipulation` for responsive taps.

---

## Features to Cut if Time-Poor (in order)

1. **Personal trends dashboard** — nice to have, not core
2. **Delayed notification prompts** — proactive resolve button is sufficient
3. **Animated count reveal** — can be a static number on first build, animate later
4. **Onboarding cards** — go straight to auth if needed
5. **Forgot password** — can be omitted for hackathon (just tell users to create a new account)

## Features that are NON-NEGOTIABLE for demo

1. Breathing animation on home screen
2. Thought submission → anonymisation → humanisation → similarity search (full pipeline)
3. Count display
4. Response cards with pagination
5. At least one card with "what helped" attached (seed the database)
6. History panel with resolve button

---

## Seeding the Database for Demo

**Before judging begins**, run a seed script that submits 50-100 realistic thoughts through the full pipeline so the similarity search returns meaningful results. Without this, every demo thought returns 0 matches.

Seed thoughts should cover common themes:
- Professional worth and workplace anxiety
- Relationship and friendship uncertainty
- Self-worth and comparison to others
- Family pressure
- Uncertainty about the future

At least 5-10 seed entries should have "what helped" text attached, so the highlighted card state is visible in the demo.

The seed script is at `backend/seed_elastic.py`.
