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

**Processing state**: After submission, the input bubble collapses back and the breathing animation resumes. Overlay text cycles slowly through:
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

**Tap behaviour**: Tapping a standard card does nothing (or a subtle expand animation showing full text if truncated). Tapping a highlighted card opens a bottom sheet showing the verbatim "what helped" text.

**Bottom sheet**: Clean, readable, full verbatim text of the resolution. Shown exactly as submitted — typos included. No AI processing, no reformatting. A small note at the bottom: *"Written by someone who's been there."*

---

### 3. History Panel

Accessed via hamburger menu (top-left). Slides in as a side drawer.

**Contents**: A list of the user's submitted thoughts, sourced from localStorage. Each item shows:
- Truncated raw thought text (first ~60 chars)
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
2. Anonymizer SLM 0.6B pass on our server (PII stripped, specificity preserved)
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

Store the seed script in `backend/scripts/seed.py`.
