# Echo — Testing & Demo Guide

This document explains how to test and demo the three advanced features when the backend/Elasticsearch is unavailable.

---

## Demo Mode

When the backend is unreachable, all thought submissions fall back to **demo mode** automatically. Demo mode:

- Uses seed data (12 pre-written humanised thoughts) as the results
- Displays a match count of 847
- Infers the theme category from the raw text using client-side keyword matching
- Seeds a Future You letter into localStorage on first use

No configuration is needed — the demo fallback activates whenever the `POST /api/v1/thoughts` call fails.

---

## Feature D: "Breathing With Others"

**How to test**: Open the app and navigate to the home screen. The presence indicator text and `data-presence-level` attribute on the logo are always visible in demo mode (random count 127–527 is generated on each home screen load).

**Playwright test**: `e2e/new-features.spec.ts` → "Breathing With Others" describe block.

No special seeding required — the demo fallback handles it.

---

## Feature E: "Future You" — Testing the Theme Matching

### How the matching works

Future You letters are stored in `localStorage` under the key `echo_future_letters`. Each letter has a `theme_category` field. When a new thought is submitted, the app checks if any stored letters match the `theme_category` of the result.

**The letter ONLY appears when the themes match.** If you write a letter after resolving a `self_worth` thought, it will only resurface when a new thought is also classified as `self_worth`.

### Demo seed letter

On first demo-mode submission, a pre-written letter is automatically seeded into localStorage with theme `self_worth`:

> "Hey — I know you're comparing yourself again. Remember last time? It passed. You started writing down what you actually did well, and the comparison lost its power. You're not behind. You're on your own path."

### How to trigger the banner in demo mode

1. Open the app, complete onboarding/auth
2. Submit any thought → demo mode seeds the letter
3. Submit a **second** thought that is non-risk-themed (e.g. "I keep comparing myself to others")
4. The demo fallback classifies non-risk text as `self_worth`
5. The Future You banner appears above the response cards: *"A note from past you"*

### How to test with a specific theme

To manually seed a letter for a specific theme, run this in the browser console:

```javascript
const letters = JSON.parse(localStorage.getItem("echo_future_letters") || "[]");
letters.push({
  message_id: "manual-test",
  theme_category: "relationship_loss",  // change to any theme
  letter_text: "Your test letter text here",
  timestamp: Date.now() - 604800000
});
localStorage.setItem("echo_future_letters", JSON.stringify(letters));
```

Then submit a thought. In demo mode, non-risk text always classifies as `self_worth`, so for themes other than `self_worth` you would need the backend running to return a different `theme_category`.

### When the banner does NOT appear

- The submitted thought's theme does not match any stored letter's theme
- No letters exist in localStorage
- The letter and thought have different `theme_category` values

This is by design — showing an unrelated past letter would be confusing and potentially harmful.

---

## Feature F: "Guardrails of Care" — Testing the Safety Banner

### How it works in production

The backend's theme classifier assigns one of the risk categories (`self_harm`, `suicidal_ideation`, `crisis`, `substance_abuse`, `eating_disorder`, `abuse`, `domestic_violence`) and the client renders the safety banner when the theme matches.

### How it works in demo mode (no backend)

When the backend is unavailable, the client uses **keyword pattern matching** on the raw thought text to infer a risk theme. This is defined in `frontend/src/lib/constants.ts` as `RISK_KEYWORD_PATTERNS`.

### Test phrases that trigger the safety banner in demo mode

| Phrase | Detected theme |
|--------|---------------|
| "I don't want to be here anymore" | `self_harm` |
| "I want to disappear" | `self_harm` |
| "I want everything to stop" | `self_harm` |
| "I keep hurting myself" | `self_harm` |
| "I don't want to live" | `suicidal_ideation` |
| "I don't want to wake up" | `suicidal_ideation` |
| "everyone would be better off without me" | `suicidal_ideation` |
| "no reason to keep going on" | `suicidal_ideation` |
| "I can't go on" | `crisis` |
| "I've reached my breaking point" | `crisis` |
| "help me" | `crisis` |
| "I can't stop drinking" | `substance_abuse` |
| "I think I'm relapsing" | `substance_abuse` |
| "I've been starving myself" | `eating_disorder` |
| "I keep purging" | `eating_disorder` |
| "my partner hits me" | `domestic_violence` |
| "I'm afraid of my boyfriend" | `domestic_violence` |

### Test phrases that do NOT trigger the banner

| Phrase | Classified as |
|--------|--------------|
| "I feel stressed about work" | `self_worth` (default) |
| "I keep comparing myself to others" | `self_worth` (default) |
| "Nobody understands me" | `self_worth` (default) |
| "I feel invisible at work" | `self_worth` (default) |

### How to demo this

1. Open the app, complete onboarding/auth
2. Submit a thought using one of the trigger phrases above (e.g. *"I don't want to be here anymore"*)
3. After the breathing animation, the safety banner appears above the response cards with helpline numbers
4. Submit a non-trigger phrase (e.g. *"I feel stressed about work"*)
5. No safety banner appears

### Pattern reference

All patterns are defined in `RISK_KEYWORD_PATTERNS` in `frontend/src/lib/constants.ts`. They are case-insensitive regular expressions tested against the raw thought text. The first matching pattern determines the theme.

### Privacy note

The client-side keyword matching is a fallback only. It runs in the browser, never sends the text to any server, and no record of the match is stored anywhere. In production, the server-side theme classifier (which runs after anonymisation) is the primary classifier.

---

## Running the Playwright Tests

```bash
cd frontend

# All tests (desktop + mobile)
npx playwright test

# New feature tests only
npx playwright test e2e/new-features.spec.ts

# With screenshots
npx playwright test e2e/new-features.spec.ts --project=desktop

# Screenshots are saved to frontend/screenshots/
```

---

## Feature G: Surrounding Topics & Topic Exploration

**How to test**: Open the app and go to the home screen. Topic bubbles (e.g. "loneliness", "work stress") float around the perimeter. Tap a bubble → the topic screen opens ("Others on [topic]") with thoughts in that theme. Bubbles are also clickable when the thought input overlay is open (tap logo to open input, then tap any bubble).

**Demo mode**: When the backend has no data for a theme, the frontend falls back to demo thoughts in `DEMO_TOPIC_THOUGHTS` (e.g. loneliness, work_stress). No configuration needed.

**Playwright**: Topic exploration can be tested by tapping a bubble and asserting the topic screen title and thought count.

---

## History Panel — Match Count

**What**: Each past thought stores the match count from when it was submitted (e.g. "2 people have felt something like this"). This number is saved to localStorage with the thought and displayed in the history panel.

**How to test**: Submit a thought → open History (hamburger) → the new entry shows the match count below the thought text. In demo mode, the count is 847. With the backend, it reflects the actual Elasticsearch match total.

**Storage**: `match_count` is an optional field on `LocalThought` in `echo_thoughts`. Legacy thoughts without it simply omit the line.

---

### Test inventory for new features

| Test | File | What it verifies |
|------|------|-----------------|
| Presence indicator visible | `new-features.spec.ts` | Home screen shows "N others breathing" text |
| Logo presence level attribute | `new-features.spec.ts` | `data-presence-level` is 0–4 |
| Future letter trigger shown | `new-features.spec.ts` | After resolving, "Write a note" appears |
| Future letter save flow | `new-features.spec.ts` | Write, save, verify in localStorage |
| Future letter banner on match | `new-features.spec.ts` | Banner appears when theme matches |
| Safety banner for risk themes | `new-features.spec.ts` | Banner appears with helpline info |
| Safety banner absent for safe themes | `new-features.spec.ts` | Banner does NOT appear for `self_worth` |
| Risk theme constants | `new-features.spec.ts` | All 7 risk themes are defined |
| Surrounding topics / Topic exploration | (manual or new spec) | Bubbles clickable; topic screen loads thoughts |
| History match count | (manual) | Past thoughts show "N people have felt something like this" |
