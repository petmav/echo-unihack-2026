# Echo — Privacy Specification

## Philosophy

Echo's privacy model is built on one principle: **design for the worst case**.

Assume a breach will happen. Assume an attacker gets everything — the database, the logs, the source code. What can they learn about any individual user? If the answer is "almost nothing meaningful", the privacy model is working.

This document defines exactly what that means in practice.

---

## Data Inventory

### What we collect

| Field | Where stored | Why | Retention |
|-------|-------------|-----|-----------|
| Email address | Our server (PostgreSQL) | Account identity | Until account deletion |
| bcrypt password hash | Our server (PostgreSQL) | Authentication | Until account deletion |
| message_id | Our server (PostgreSQL) + device localStorage | Links local history to server records | Until account deletion (server); user-controlled (device) |
| Emotional theme category | Our server (PostgreSQL) | Trend analysis, personalisation | Until account deletion |
| Humanised/anonymised thought text | Elastic Cloud | Core product feature — shown to other users | Indefinite (no user linkage exists to enable deletion) |
| "What helped" text (anonymised) | Elastic Cloud | Core product feature — shown to other users | Indefinite |
| Timestamp (week number only) | Elastic Cloud | Temporal clustering | Indefinite |
| Raw thought text | Device localStorage only | User's personal history | User-controlled |
| Personal trends | Device localStorage only | Personal dashboard | User-controlled |
| "Future You" letters | Device localStorage only | Personal self-reflection | User-controlled |
| Theme aggregate counts | Elastic Cloud (computed) | Co-presence animation | Ephemeral (not stored as separate docs) |

### What we explicitly do NOT collect

- IP addresses (stripped at reverse proxy level before hitting FastAPI)
- Full timestamps or datetimes (week numbers only)
- Device identifiers or fingerprints
- User agent strings
- Names, DOB, phone numbers, or any profile information
- Location data
- Raw thought text on any server

---

## The Anonymisation Contract

The Anonymizer SLM 0.6B model performs the following transformation before any text is stored or passed to external APIs:

**Entities replaced with semantic placeholders:**
- Person names → `[male name]`, `[female name]`, `[name]`
- Locations (cities, streets, venues) → `[city]`, `[location]`, `[place]`
- Organisations and workplaces → `[company]`, `[tech company]`, `[workplace]`
- Relationships → `[family member]`, `[partner]`, `[friend]`
- Ages and dates → `[age]`, `[time period]`

**What is preserved:**
- The emotional content and specificity of the thought
- The nature of the relationship (e.g. the power dynamic of "boss", the intimacy of "partner")
- The context that makes advice relevant (e.g. "at work" vs "at home")

This is semantic-preserving anonymisation, not redaction. The goal is that two people who had the same experience can still find each other's advice, even after anonymisation.

---

## Breach Impact Analysis

### Scenario 1: Our PostgreSQL database is breached

**Attacker obtains:**
- Email addresses
- bcrypt password hashes (cost=12, computationally expensive to crack)
- Rows of `{ account_id, message_id, theme_category, timestamp_week }`

**What they can learn about a user:**
- That this email address has submitted thoughts in the categories e.g. `["professional_worth", "relationship_loss"]`
- Roughly when (week-level precision, no day/time)

**What they cannot learn:**
- What the user actually wrote
- The content of any thought
- Anything stored in Elastic (no cross-reference is possible — Elastic docs have no account_id)

**Severity: Low.** Emotional theme categories are effectively demographic data, not thought content.

---

### Scenario 2: Our Elasticsearch index is breached

**Attacker obtains:**
- Humanised/anonymised thought text
- Sentiment vectors
- Theme categories
- "What helped" texts (anonymised)
- message_ids (random UUIDs)
- Week numbers

**What they can learn:**
- The content of thoughts, post-anonymisation
- No user identity whatsoever — there is no account_id or email in any Elastic document
- No way to link any document to any user in our PostgreSQL database (message_ids are not stored in a way that enables cross-reference without both databases)

**What they cannot learn:**
- Who wrote anything
- Any user's identity
- Any user's original unprocessed words

**Severity: Very low.** The dataset reads as an anonymous collection of human emotional experiences. No individual can be identified.

---

### Scenario 3: A user's device is compromised

**Attacker obtains:**
- That user's raw thought history (stored in localStorage)
- That user's message_id mapping
- That user's JWT (valid for up to 7 days)

**What they can learn:**
- The content of that one user's thoughts, including raw unprocessed text
- Nothing about any other user

**What they cannot learn:**
- Any other user's data
- The content of other users' thoughts
- Any server-side data beyond what the JWT allows (their own account)

**Severity: Moderate for the individual user, zero impact on any other user.** This is equivalent to someone finding a private journal — serious, but contained.

---

### Scenario 4: Complete breach (everything)

Even with our server database, Elastic index, and source code simultaneously:
- Elastic docs have no account_id field
- PostgreSQL has no thought text
- The cross-reference requires both `message_id` in localStorage AND in our DB
- Without the user's device, the bridge between identity and content does not exist

**Severity: Low-moderate.** An attacker with everything could potentially attempt to correlate message_ids across our DB and Elastic, but this only reveals theme categories (not content) mapped to email addresses.

---

## Privacy Implications of New Features

### "Breathing With Others" (Aggregate Co-Presence)

| Concern | Resolution |
|---------|------------|
| Can the aggregate count reveal individual activity? | No. Counts are per-theme per-week, aggregated across all users. Minimum threshold of 10 before visual change. |
| Does fetching aggregates reveal user intent? | The aggregate endpoint returns counts for all themes. The client selects the relevant theme locally. |
| Is the user's most recent theme leaked? | No. `getMostRecentTheme()` reads from localStorage. The API call fetches all aggregates — no filtering server-side. |

### "Future You" (Local Letters)

| Concern | Resolution |
|---------|------------|
| Where are letters stored? | localStorage only (`echo_future_letters` key). Never transmitted to any server. |
| Are letters included in any API payload? | No. Letters are read and written exclusively by `storage.ts`. |
| What happens on account deletion? | `clearAllData()` removes `echo_future_letters` alongside all other local data. |
| Can letters leak in a device breach? | Yes — same risk profile as raw thought text. One user's letters exposed, no other user affected. |

### "Guardrails of Care" (Safety Banner)

| Concern | Resolution |
|---------|------------|
| Is the display of safety resources logged? | **No.** Deliberately not logged — not in analytics, not in localStorage, not in any API call. |
| Could a server-side actor determine a user triggered the safety banner? | Only if they know the user's `theme_category` from the DB AND that category is in the risk set. The category is already stored in our DB as part of the core flow. The safety banner adds no new data exposure. |
| Why not log safety banner displays? | Users in crisis must not fear that seeking help creates a record. Trust is paramount. |

---

## Compliance Notes

### Australian Privacy Act 1988
Echo collects "personal information" (email addresses). Under the APP (Australian Privacy Principles):
- We must have a privacy policy (create before launch)
- Users must be able to access and delete their data (DELETE /api/v1/account implements this)
- We must not use personal information for a purpose other than the primary purpose of collection

### GDPR (if EU users access the app)
The EU Shared Future Prize is a target — EU judges may consider GDPR compliance:
- Legal basis for processing: legitimate interest + consent at signup
- Right to erasure: implemented via account deletion endpoint
- Data minimisation: core to our architecture
- Privacy by design: documented in this spec

---

## Implementation Checklist

Before demo/submission, verify:

- [ ] FastAPI request logging disabled in production (`--no-access-log` flag)
- [ ] Nginx/reverse proxy configured to strip `X-Forwarded-For` and not log IPs
- [ ] Elastic Cloud index verified to contain no account_id or raw text fields
- [ ] Anonymiser called before any Claude API call — verified in code
- [ ] DELETE /api/v1/account tested and confirmed to purge all server-side user data
- [ ] localStorage cleared on account deletion from the client
- [ ] HTTPS enforced (no HTTP fallback)
- [ ] JWT secret is a strong random string (not "change-me")
- [ ] bcrypt cost factor is 12 or higher
- [ ] No `.env` file committed to the repository
