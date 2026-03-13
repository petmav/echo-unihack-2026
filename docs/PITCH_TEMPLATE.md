# Echo — Pitch & Submission Notes

## Project Name
**Echo**

## One-liner
Echo shows you that you're not alone — using your exact feeling, matched to everyone who's felt the same.

## Problem
Intrusive negative thoughts feel uniquely isolating. Therapy has a waitlist. Talking to friends feels like a burden. Generic affirmation apps feel hollow. There's no app that just shows you, with evidence, that other people have felt exactly what you're feeling right now — and what actually helped them.

## Solution
You open Echo, tap the logo, and type what's on your mind. 2 seconds later: *"847 people have felt something like this."* You scroll through their experiences. Some of them found a way through — and left a note for you.

No chatbot. No social feed. No clinical questionnaire. Just ambient proof that you're not alone, powered by semantic search and private by design.

## How We Built It
- **Frontend**: Next.js 16, TypeScript, Tailwind CSS (mobile-first)
- **Backend**: FastAPI (Python)
- **Anonymisation**: Qwen3.5-0.8B — self-hosted via Ollama. Raw thought text never leaves our server unstripped.
- **AI**: NanoGPT API — qwen3.5-122b-a10b — humanises anonymised text. Only ever sees post-anonymisation output.
- **Search**: Elasticsearch — vector similarity search on sentiment embeddings, `search_after` pagination, aggregate counts
- **Auth**: Email + bcrypt only. No names, no profile data.

## What Makes It Technically Interesting
Three-stage privacy-preserving pipeline: self-hosted SLM anonymisation → NanoGPT humanisation → Elastic vector semantic retrieval. Raw thought text never persists on any server. NanoGPT never sees a user's original words. Elastic documents have no user linkage whatsoever. A full database breach reveals nothing about any individual.

## Privacy Story (for judges)
*"We designed for the worst case: assume our entire infrastructure is breached. Even then — no attacker can read what any user actually wrote, because we never stored it. No attacker can identify who felt what, because Elastic has no user IDs. The only thing that persists is anonymous proof that humans share the same pain."*

## Prizes Targeting
- [ ] **AI Solutions Prize (Quantium)** — AI is structurally core at every stage: SLM anonymisation, NanoGPT humanisation, Elastic vector semantic search
- [ ] **Best Use of Elastic Technology** — vector similarity search, sentiment clustering, search_after pagination, real-time aggregate match counts
- [ ] **Social Impact Prize** — mental health, accessible to anyone, no clinical gatekeeping, no waitlist
- [ ] **Best Design** — breathing animation, count reveal moment, card scroll UX

## Demo Script (3 min max)
**[0:00 — Hook]**
*"Has anyone here had a thought they were too ashamed to say out loud?"*
[pause]
*"Most of us have. And most of us believe we're the only one who's ever had it."*

**[0:20 — Open the app]**
Show the breathing logo. Tap it. Type a thought live on stage (prepare a relatable one).

**[0:40 — The moment]**
Let the breathing animation play. Don't rush it. Then: the count reveal.
*"That number — that's real data. Those are real people."*

**[1:00 — Scroll the cards]**
Show the response cards. Tap one with a "what helped" badge.
*"This was written by someone who came out the other side. Their exact words. Unedited."*

**[1:30 — Technical]**
*"Here's what happened in those 2 seconds."* Briefly walk through the pipeline: SLM → NanoGPT → Elastic. Show the privacy guarantee: *"The AI never saw what I typed."*

**[2:10 — History / resolve flow]**
Show the history panel, the resolve button, the "what helped" submission.
*"The dataset grows every time someone gets better."*

**[2:40 — Close]**
*"Echo isn't therapy. It's not a chatbot. It's just proof — at 2am when you need it most — that someone else has been exactly where you are."*

## Third-Party APIs & Tools Used
_(Required for submission — list everything)_
- NanoGPT API (qwen3.5-122b-a10b) — OpenAI-compatible, used for humanisation and theme classification
- Elasticsearch / Elastic Cloud
- Qwen3.5-0.8B (via Ollama) — self-hosted anonymisation model
- Ollama (local model serving)
- sentence-transformers / all-MiniLM-L6-v2 (local embeddings)
- AI tools used during development: Claude (claude.ai), Claude Code

## Team Members
| Name | Student ID | University |
|------|-----------|------------|
|      |           |            |

## Submission Checklist
- [ ] Public repo link
- [ ] List of all third-party APIs/tools (above)
- [ ] Screenshots/images of the app
- [ ] 3-minute demo video (pitch + live demo)
- [ ] Live working copy deployed and accessible during judging
- [ ] Database seeded with enough data for a convincing demo
- [ ] Devpost fields filled in
- [ ] Registered on UNIHACK Hackerspace App

## Links
- Devpost: https://unihack2026.devpost.com/
- Repo: [your repo URL]
- Live demo: [your deploy URL]
- Video: [YouTube/Vimeo link]
