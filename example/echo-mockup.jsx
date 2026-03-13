import { useState, useEffect, useRef, useCallback } from "react";

/* ─── seed data ─── */
const SIMILAR_THOUGHTS = [
  { id: "t1", text: "There's this constant feeling that I'm falling behind while everyone around me seems to be moving forward effortlessly. I compare myself to others and wonder if I'll ever measure up to where I should be.", hasResolution: true, resolution: "I started writing down three things I did well each week, no matter how small. After a couple of months, I realised I was comparing my beginning to everyone else's middle. The comparison didn't stop completely but it lost its teeth." },
  { id: "t2", text: "I feel invisible at work. I contribute ideas and effort but it's like nobody notices. The recognition always goes to someone louder, someone more confident, and I'm left wondering if my work even matters.", hasResolution: false },
  { id: "t3", text: "Sometimes I lie awake replaying every awkward thing I've ever said in a conversation. The shame hits me physically and I convince myself everyone remembers those moments as vividly as I do.", hasResolution: true, resolution: "Honestly what helped was asking a close friend if they remembered a specific moment I'd been agonizing over for years. They had absolutely no idea what I was talking about. That one conversation did more than months of overthinking." },
  { id: "t4", text: "I moved to a new city for an opportunity that felt right at the time but now I'm surrounded by strangers and the loneliness is heavier than I expected. I smile through the day and fall apart at night.", hasResolution: false },
  { id: "t5", text: "My family expects me to follow a path I never chose. Every conversation turns into pressure about careers, relationships, timelines. I love them but I feel like I'm disappearing into their version of who I should be.", hasResolution: true, resolution: "I wrote a letter to my parents. Not to send — just for me. It helped me separate what I actually wanted from what I thought I was supposed to want. Then I had one honest conversation. Just one. It didn't fix everything but it cracked the door open." },
  { id: "t6", text: "I keep starting things with so much energy and then abandoning them halfway through. Projects, hobbies, relationships. I'm terrified that I'm fundamentally incapable of following through on anything that matters.", hasResolution: false },
  { id: "t7", text: "There's a person in my life who makes me feel small in ways that are hard to explain to anyone else. It's not dramatic or obvious — it's subtle, constant, and I'm starting to believe the things they imply about me.", hasResolution: true, resolution: "I started keeping a note on my phone of every time they said something that made me feel bad. Reading it back after a month made the pattern undeniable. It's easier to trust your own perception when you have the receipts." },
  { id: "t8", text: "I graduated months ago and still don't know what I'm doing. Everyone posts about their new jobs and achievements and I'm here applying to things I don't even want, wondering if the version of me that had ambitions still exists somewhere.", hasResolution: false },
  { id: "t9", text: "I catch myself performing happiness around people because the alternative — being honest about how I feel — sounds exhausting and risky. I'm tired of being the person who's always fine.", hasResolution: false },
  { id: "t10", text: "I helped someone through the hardest time of their life and when I needed the same they weren't there. The imbalance in who I am for others versus who they are for me is a loneliness I can't articulate.", hasResolution: true, resolution: "I had to grieve the friendship I thought I had separately from the person. Once I stopped expecting reciprocity from that specific person, I could actually see the people who do show up for me. They were there all along." },
  { id: "t11", text: "I look at old photos of myself and feel a deep sadness for how harshly I judged that person. I was so much kinder to everyone else than I was to myself, and I'm still doing it.", hasResolution: false },
  { id: "t12", text: "I've been told I'm too sensitive my whole life and I've started to believe it. But what if I'm not too much — what if the people around me are just not enough?", hasResolution: true, resolution: "Finding one person who appreciated my sensitivity instead of tolerating it changed everything. You don't need everyone to understand you. You need the right ones." },
];

const HISTORY_ITEMS = [
  { id: "h1", text: "I feel like I'm failing at everything and nobody notices how much I'm struggling", date: "2 days ago", resolved: false, theme: "self_worth" },
  { id: "h2", text: "My closest friend hasn't checked in on me in months and it's breaking my heart", date: "1 week ago", resolved: true, theme: "relationship_loss", whatHelped: "I told them directly that I missed them. Turns out they were going through something too." },
  { id: "h3", text: "Everyone at work seems to know what they're doing except me", date: "2 weeks ago", resolved: false, theme: "professional_worth" },
  { id: "h4", text: "I keep comparing my life to people on social media and feeling worthless", date: "3 weeks ago", resolved: true, theme: "comparison", whatHelped: "Deleted the apps for 30 days. The first week was hard. After that I forgot to reinstall them." },
  { id: "h5", text: "My parents keep asking when I'll get a real job and it's crushing me", date: "1 month ago", resolved: false, theme: "family_pressure" },
];

const ONBOARDING = [
  { title: "You're not alone", desc: "Echo finds others who have felt exactly what you're feeling right now — anonymously, privately, without judgement." },
  { title: "Your words stay yours", desc: "Your thoughts never leave your device. We only ever see the emotion, never the details. No names, no data, no trace." },
  { title: "Sometimes it helps\nto know", desc: "When others find their way through, they share what helped — in their own words, for people just like you." },
];

/* ─── helpers ─── */
const lerp = (a, b, t) => a + (b - a) * t;

/* ─── main app ─── */
export default function EchoApp() {
  const [screen, setScreen] = useState("onboarding"); // onboarding | auth | home | processing | results
  const [authMode, setAuthMode] = useState("login");
  const [onboardIdx, setOnboardIdx] = useState(0);
  const [inputOpen, setInputOpen] = useState(false);
  const [thoughtText, setThoughtText] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [countAnimDone, setCountAnimDone] = useState(false);
  const [processingText, setProcessingText] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bottomSheet, setBottomSheet] = useState(null);
  const [resolveId, setResolveId] = useState(null);
  const [resolveText, setResolveText] = useState("");
  const [cardsVisible, setCardsVisible] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const TARGET_COUNT = 847;
  const processingPhrases = ["finding your people...", "you're not alone in this...", "others have been here too..."];

  /* ── count animation ── */
  useEffect(() => {
    if (screen !== "results") return;
    setMatchCount(0);
    setCountAnimDone(false);
    setCardsVisible(0);
    let start = null;
    const duration = 1800;
    const animate = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setMatchCount(Math.round(lerp(0, TARGET_COUNT, eased)));
      if (p < 1) requestAnimationFrame(animate);
      else {
        setCountAnimDone(true);
        /* stagger cards in */
        for (let i = 0; i < SIMILAR_THOUGHTS.length; i++) {
          setTimeout(() => setCardsVisible((v) => v + 1), 120 * i);
        }
      }
    };
    const t = setTimeout(() => requestAnimationFrame(animate), 400);
    return () => clearTimeout(t);
  }, [screen]);

  /* ── processing text cycling ── */
  useEffect(() => {
    if (screen !== "processing") return;
    setProcessingText(0);
    const iv = setInterval(() => setProcessingText((p) => (p + 1) % 3), 1200);
    const timeout = setTimeout(() => {
      clearInterval(iv);
      setScreen("results");
    }, 3600);
    return () => { clearInterval(iv); clearTimeout(timeout); };
  }, [screen]);

  const handleSubmit = () => {
    if (!thoughtText.trim()) return;
    setInputOpen(false);
    setScreen("processing");
  };

  const handleResolve = (id) => {
    if (resolveId === id) { setResolveId(null); return; }
    setResolveId(id);
    setResolveText("");
  };

  /* ─── STYLES (CSS-in-JS for single file) ─── */
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,300&family=Outfit:wght@300;400;500;600&display=swap');

    :root {
      --bg: #FAF7F2;
      --bg-warm: #F5EDE3;
      --text: #2C2825;
      --text-soft: #7A706A;
      --text-muted: #B5ADA6;
      --accent: #C8856C;
      --accent-soft: #E8C4B4;
      --accent-glow: rgba(200,133,108,0.15);
      --card-bg: #FFFFFF;
      --card-shadow: 0 2px 20px rgba(44,40,37,0.06);
      --highlight: #FFF8F0;
      --highlight-border: #EEDCC8;
      --resolve-green: #7BAE7F;
      --serif: 'Fraunces', Georgia, serif;
      --sans: 'Outfit', system-ui, sans-serif;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body { background: var(--bg); }

    .echo-root {
      font-family: var(--sans);
      color: var(--text);
      background: var(--bg);
      min-height: 100vh;
      max-width: 430px;
      margin: 0 auto;
      position: relative;
      overflow-x: hidden;
    }

    /* ── noise overlay ── */
    .echo-root::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
      pointer-events: none;
      z-index: 1000;
    }

    /* ── breathing animation ── */
    @keyframes breathe {
      0%, 100% { transform: scale(1); opacity: 0.85; }
      35% { transform: scale(1.12); opacity: 1; }
      50% { transform: scale(1.10); opacity: 1; }
      65% { transform: scale(1.12); opacity: 1; }
    }

    @keyframes breatheRing {
      0%, 100% { transform: scale(1); opacity: 0.15; }
      35% { transform: scale(1.35); opacity: 0.08; }
      50% { transform: scale(1.4); opacity: 0.06; }
      65% { transform: scale(1.35); opacity: 0.08; }
    }

    @keyframes breatheRingOuter {
      0%, 100% { transform: scale(1); opacity: 0.08; }
      35% { transform: scale(1.6); opacity: 0.03; }
      65% { transform: scale(1.6); opacity: 0.03; }
    }

    @keyframes floatUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }

    @keyframes slideInLeft {
      from { transform: translateX(-100%); }
      to { transform: translateX(0); }
    }

    @keyframes pulseResolve {
      0%, 100% { box-shadow: 0 0 0 0 rgba(200,133,108,0.3); }
      50% { box-shadow: 0 0 0 6px rgba(200,133,108,0); }
    }

    @keyframes countPop {
      0% { transform: scale(0.8); opacity: 0; }
      60% { transform: scale(1.05); }
      100% { transform: scale(1); opacity: 1; }
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    @keyframes textCycle {
      0%, 20% { opacity: 0; transform: translateY(8px); }
      25%, 75% { opacity: 1; transform: translateY(0); }
      80%, 100% { opacity: 0; transform: translateY(-8px); }
    }

    .logo-container {
      position: relative;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 160px;
      height: 160px;
    }

    .logo-core {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, var(--accent), #A06B55);
      animation: breathe 7s ease-in-out infinite;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      z-index: 2;
      transition: transform 0.2s ease;
    }

    .logo-core:active { transform: scale(0.95); }

    .logo-ring {
      position: absolute;
      width: 100px;
      height: 100px;
      border-radius: 50%;
      border: 1.5px solid var(--accent);
      animation: breatheRing 7s ease-in-out infinite;
    }

    .logo-ring-outer {
      position: absolute;
      width: 100px;
      height: 100px;
      border-radius: 50%;
      border: 1px solid var(--accent-soft);
      animation: breatheRingOuter 7s ease-in-out infinite;
    }

    .logo-text {
      font-family: var(--serif);
      font-size: 28px;
      font-weight: 300;
      color: white;
      letter-spacing: 4px;
      text-transform: lowercase;
      user-select: none;
    }

    /* ── input bubble ── */
    .input-overlay {
      position: fixed;
      inset: 0;
      background: rgba(250,247,242,0.92);
      backdrop-filter: blur(20px);
      z-index: 50;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      animation: fadeIn 0.3s ease;
    }

    .input-bubble {
      width: 100%;
      max-width: 380px;
      animation: floatUp 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .input-bubble textarea {
      width: 100%;
      min-height: 140px;
      border: none;
      border-radius: 24px;
      padding: 24px;
      font-family: var(--sans);
      font-size: 17px;
      font-weight: 300;
      line-height: 1.65;
      color: var(--text);
      background: var(--card-bg);
      box-shadow: 0 8px 40px rgba(44,40,37,0.08);
      resize: none;
      outline: none;
    }

    .input-bubble textarea::placeholder {
      color: var(--text-muted);
      font-style: italic;
    }

    .input-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 16px;
      padding: 0 8px;
    }

    .char-count {
      font-size: 13px;
      color: var(--text-muted);
      font-weight: 400;
      font-variant-numeric: tabular-nums;
    }

    .send-btn {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      border: none;
      background: var(--accent);
      color: white;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      box-shadow: 0 4px 16px rgba(200,133,108,0.3);
    }

    .send-btn:hover { transform: scale(1.06); }
    .send-btn:disabled { opacity: 0.4; cursor: default; transform: none; }

    .close-input {
      position: absolute;
      top: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: transparent;
      color: var(--text-soft);
      font-size: 24px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* ── processing screen ── */
    .processing-text {
      font-family: var(--sans);
      font-size: 16px;
      font-weight: 300;
      color: var(--text-soft);
      letter-spacing: 0.5px;
      margin-top: 40px;
      height: 24px;
      text-align: center;
    }

    .processing-text span {
      animation: textCycle 1.2s ease-in-out;
      display: inline-block;
    }

    /* ── count reveal ── */
    .count-section {
      text-align: center;
      padding: 0 24px;
      animation: countPop 0.6s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .count-number {
      font-family: var(--serif);
      font-size: 72px;
      font-weight: 700;
      color: var(--text);
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    .count-label {
      font-family: var(--sans);
      font-size: 17px;
      font-weight: 300;
      color: var(--text-soft);
      margin-top: 8px;
      line-height: 1.5;
    }

    /* ── response cards ── */
    .cards-container {
      padding: 32px 20px 120px;
    }

    .thought-card {
      background: var(--card-bg);
      border-radius: 20px;
      padding: 24px;
      margin-bottom: 14px;
      box-shadow: var(--card-shadow);
      transition: all 0.25s ease;
      cursor: default;
      opacity: 0;
      transform: translateY(16px);
    }

    .thought-card.visible {
      opacity: 1;
      transform: translateY(0);
      transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .thought-card.highlighted {
      background: var(--highlight);
      border: 1px solid var(--highlight-border);
      cursor: pointer;
    }

    .thought-card.highlighted:hover {
      box-shadow: 0 4px 24px rgba(200,133,108,0.12);
    }

    .card-text {
      font-size: 15.5px;
      font-weight: 300;
      line-height: 1.7;
      color: var(--text);
    }

    .card-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 14px;
      padding: 6px 14px;
      border-radius: 20px;
      background: var(--accent-glow);
      font-size: 12.5px;
      font-weight: 500;
      color: var(--accent);
      letter-spacing: 0.2px;
    }

    .card-badge::before {
      content: '✦';
      font-size: 10px;
    }

    /* ── bottom sheet ── */
    .sheet-overlay {
      position: fixed;
      inset: 0;
      background: rgba(44,40,37,0.3);
      z-index: 100;
      animation: fadeIn 0.2s ease;
    }

    .sheet {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      max-width: 430px;
      background: var(--card-bg);
      border-radius: 24px 24px 0 0;
      padding: 20px 28px 40px;
      z-index: 101;
      animation: slideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1);
      max-height: 70vh;
      overflow-y: auto;
    }

    .sheet-handle {
      width: 36px;
      height: 4px;
      border-radius: 4px;
      background: var(--text-muted);
      margin: 0 auto 24px;
      opacity: 0.4;
    }

    .sheet-label {
      font-family: var(--serif);
      font-size: 18px;
      font-weight: 500;
      color: var(--text);
      margin-bottom: 16px;
    }

    .sheet-body {
      font-size: 15.5px;
      font-weight: 300;
      line-height: 1.75;
      color: var(--text);
      margin-bottom: 20px;
    }

    .sheet-footer {
      font-size: 12.5px;
      font-weight: 400;
      color: var(--text-muted);
      font-style: italic;
    }

    /* ── hamburger + history panel ── */
    .hamburger {
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 60;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      border: none;
      background: rgba(255,255,255,0.7);
      backdrop-filter: blur(12px);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: all 0.2s ease;
    }

    .hamburger span {
      width: 18px;
      height: 1.5px;
      background: var(--text);
      border-radius: 2px;
      transition: all 0.3s ease;
    }

    .hamburger.open span:nth-child(1) { transform: rotate(45deg) translate(4.5px, 4.5px); }
    .hamburger.open span:nth-child(2) { opacity: 0; }
    .hamburger.open span:nth-child(3) { transform: rotate(-45deg) translate(4.5px, -4.5px); }

    .history-overlay {
      position: fixed;
      inset: 0;
      background: rgba(44,40,37,0.2);
      z-index: 55;
      animation: fadeIn 0.2s ease;
    }

    .history-panel {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: min(340px, 85vw);
      max-width: 430px;
      background: var(--bg);
      z-index: 58;
      animation: slideInLeft 0.35s cubic-bezier(0.22, 1, 0.36, 1);
      overflow-y: auto;
      padding: 80px 20px 40px;
    }

    .history-title {
      font-family: var(--serif);
      font-size: 24px;
      font-weight: 500;
      color: var(--text);
      margin-bottom: 8px;
    }

    .history-subtitle {
      font-size: 13px;
      color: var(--text-muted);
      font-weight: 300;
      margin-bottom: 28px;
    }

    .history-item {
      background: var(--card-bg);
      border-radius: 16px;
      padding: 18px;
      margin-bottom: 10px;
      box-shadow: 0 1px 8px rgba(44,40,37,0.04);
      position: relative;
    }

    .history-item.resolved {
      opacity: 0.6;
    }

    .history-text {
      font-size: 14px;
      font-weight: 400;
      color: var(--text);
      line-height: 1.55;
      margin-bottom: 10px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .history-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .history-date {
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 400;
    }

    .resolve-btn {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: 1.5px solid var(--text-muted);
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      color: var(--text-muted);
      transition: all 0.2s ease;
    }

    .resolve-btn:hover { border-color: var(--accent); color: var(--accent); }

    .resolve-btn.done {
      background: var(--resolve-green);
      border-color: var(--resolve-green);
      color: white;
    }

    .resolve-btn.pulsing {
      animation: pulseResolve 2s ease-in-out infinite;
      border-color: var(--accent);
      color: var(--accent);
    }

    .resolve-input {
      margin-top: 12px;
      animation: floatUp 0.3s ease;
    }

    .resolve-input textarea {
      width: 100%;
      min-height: 80px;
      border: 1px solid var(--highlight-border);
      border-radius: 12px;
      padding: 14px;
      font-family: var(--sans);
      font-size: 14px;
      font-weight: 300;
      line-height: 1.6;
      color: var(--text);
      background: var(--highlight);
      resize: none;
      outline: none;
    }

    .resolve-input textarea:focus { border-color: var(--accent); }

    .resolve-submit {
      margin-top: 8px;
      padding: 8px 18px;
      border-radius: 20px;
      border: none;
      background: var(--accent);
      color: white;
      font-family: var(--sans);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .resolve-submit:hover { transform: scale(1.03); }

    .helped-preview {
      margin-top: 10px;
      padding: 10px 14px;
      background: var(--highlight);
      border-radius: 10px;
      font-size: 13px;
      color: var(--text-soft);
      line-height: 1.5;
      font-style: italic;
    }

    /* ── nav tabs at bottom ── */
    .nav-home {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 40;
    }

    .nav-home button {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      background: var(--card-bg);
      box-shadow: 0 4px 20px rgba(44,40,37,0.1);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .nav-home button:hover { transform: scale(1.06); }

    .nav-home svg { width: 22px; height: 22px; color: var(--accent); }

    /* ── onboarding ── */
    .onboarding-screen {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 32px;
      text-align: center;
    }

    .onboarding-card {
      animation: floatUp 0.5s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .onboarding-title {
      font-family: var(--serif);
      font-size: 32px;
      font-weight: 500;
      color: var(--text);
      line-height: 1.25;
      margin-bottom: 20px;
      white-space: pre-line;
    }

    .onboarding-desc {
      font-size: 16px;
      font-weight: 300;
      color: var(--text-soft);
      line-height: 1.7;
      max-width: 320px;
      margin: 0 auto;
    }

    .onboarding-dots {
      display: flex;
      gap: 8px;
      margin-top: 48px;
    }

    .onboarding-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-muted);
      opacity: 0.3;
      transition: all 0.3s ease;
    }

    .onboarding-dot.active {
      opacity: 1;
      background: var(--accent);
      width: 24px;
      border-radius: 4px;
    }

    .onboarding-actions {
      display: flex;
      gap: 16px;
      margin-top: 40px;
    }

    .btn-primary {
      padding: 14px 36px;
      border-radius: 28px;
      border: none;
      background: var(--accent);
      color: white;
      font-family: var(--sans);
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      letter-spacing: 0.3px;
    }

    .btn-primary:hover { transform: scale(1.03); box-shadow: 0 4px 16px rgba(200,133,108,0.3); }

    .btn-ghost {
      padding: 14px 24px;
      border-radius: 28px;
      border: none;
      background: transparent;
      color: var(--text-soft);
      font-family: var(--sans);
      font-size: 15px;
      font-weight: 400;
      cursor: pointer;
      transition: color 0.2s ease;
    }

    .btn-ghost:hover { color: var(--text); }

    /* ── auth screen ── */
    .auth-screen {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 32px;
    }

    .auth-logo {
      font-family: var(--serif);
      font-size: 36px;
      font-weight: 300;
      color: var(--text);
      letter-spacing: 6px;
      text-transform: lowercase;
      margin-bottom: 48px;
    }

    .auth-form {
      width: 100%;
      max-width: 340px;
    }

    .auth-field {
      margin-bottom: 16px;
    }

    .auth-field input {
      width: 100%;
      padding: 16px 20px;
      border: 1px solid #E0D8D0;
      border-radius: 14px;
      font-family: var(--sans);
      font-size: 15px;
      font-weight: 300;
      color: var(--text);
      background: var(--card-bg);
      outline: none;
      transition: border-color 0.2s ease;
    }

    .auth-field input:focus { border-color: var(--accent); }
    .auth-field input::placeholder { color: var(--text-muted); }

    .auth-submit {
      width: 100%;
      padding: 16px;
      border-radius: 14px;
      border: none;
      background: var(--accent);
      color: white;
      font-family: var(--sans);
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      margin-top: 8px;
      transition: all 0.2s ease;
      letter-spacing: 0.3px;
    }

    .auth-submit:hover { transform: scale(1.01); box-shadow: 0 4px 16px rgba(200,133,108,0.3); }

    .auth-switch {
      margin-top: 24px;
      font-size: 14px;
      color: var(--text-muted);
      text-align: center;
    }

    .auth-switch button {
      border: none;
      background: none;
      color: var(--accent);
      font-family: var(--sans);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    .privacy-note {
      margin-top: 32px;
      padding: 16px;
      background: var(--highlight);
      border-radius: 12px;
      text-align: center;
    }

    .privacy-note p {
      font-size: 12.5px;
      color: var(--text-soft);
      line-height: 1.55;
      font-weight: 300;
    }

    .privacy-note .lock-icon {
      font-size: 16px;
      margin-bottom: 6px;
      display: block;
    }

    /* ── settings ── */
    .settings-link {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 32px;
      padding: 14px 18px;
      background: var(--card-bg);
      border-radius: 14px;
      border: none;
      cursor: pointer;
      font-family: var(--sans);
      font-size: 14px;
      color: var(--text-soft);
      width: 100%;
      text-align: left;
      transition: background 0.2s ease;
    }

    .settings-link:hover { background: var(--bg-warm); }

    /* ── results back button ── */
    .back-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 60;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      border: none;
      background: rgba(255,255,255,0.7);
      backdrop-filter: blur(12px);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      color: var(--text-soft);
      transition: all 0.2s ease;
    }

    .back-btn:hover { background: rgba(255,255,255,0.9); }

    /* ── gentle ambient gradient at top ── */
    .ambient-top {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 200px;
      background: linear-gradient(180deg, rgba(232,196,180,0.08) 0%, transparent 100%);
      pointer-events: none;
      z-index: 0;
    }
  `;

  /* ─── RENDER ─── */

  // Onboarding
  if (screen === "onboarding") {
    return (
      <div className="echo-root">
        <style>{css}</style>
        <div className="ambient-top" />
        <div className="onboarding-screen">
          <div className="onboarding-card" key={onboardIdx}>
            {/* decorative element */}
            <div style={{ marginBottom: 40 }}>
              <div className="logo-container" style={{ margin: "0 auto", width: 100, height: 100 }}>
                <div className="logo-core" style={{ width: 64, height: 64, cursor: "default" }}>
                  <span className="logo-text" style={{ fontSize: 16, letterSpacing: 3 }}>e</span>
                </div>
                <div className="logo-ring" style={{ width: 64, height: 64 }} />
              </div>
            </div>
            <h1 className="onboarding-title">{ONBOARDING[onboardIdx].title}</h1>
            <p className="onboarding-desc">{ONBOARDING[onboardIdx].desc}</p>
          </div>

          <div className="onboarding-dots">
            {ONBOARDING.map((_, i) => (
              <div key={i} className={`onboarding-dot ${i === onboardIdx ? "active" : ""}`} />
            ))}
          </div>

          <div className="onboarding-actions">
            {onboardIdx < ONBOARDING.length - 1 ? (
              <>
                <button className="btn-ghost" onClick={() => setScreen("auth")}>Skip</button>
                <button className="btn-primary" onClick={() => setOnboardIdx((i) => i + 1)}>Next</button>
              </>
            ) : (
              <button className="btn-primary" onClick={() => setScreen("auth")}>Get started</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Auth
  if (screen === "auth") {
    return (
      <div className="echo-root">
        <style>{css}</style>
        <div className="ambient-top" />
        <div className="auth-screen">
          <div className="auth-logo">echo</div>
          <div className="auth-form">
            <div className="auth-field">
              <input type="email" placeholder="Email" />
            </div>
            <div className="auth-field">
              <input type="password" placeholder="Password" />
            </div>
            <button className="auth-submit" onClick={() => setScreen("home")}>
              {authMode === "login" ? "Sign in" : "Create account"}
            </button>
            <div className="auth-switch">
              {authMode === "login" ? (
                <span>No account? <button onClick={() => setAuthMode("signup")}>Sign up</button></span>
              ) : (
                <span>Already have one? <button onClick={() => setAuthMode("login")}>Sign in</button></span>
              )}
            </div>
            <div className="privacy-note">
              <p>
                <span className="lock-icon">🔒</span>
                No names. No profiles. Just an email so you can come back.<br />
                Your thoughts never leave your device.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Home / Processing / Results
  return (
    <div className="echo-root">
      <style>{css}</style>
      <div className="ambient-top" />

      {/* hamburger */}
      {(screen === "home" || screen === "results") && (
        <button className={`hamburger ${historyOpen ? "open" : ""}`} onClick={() => setHistoryOpen(!historyOpen)}>
          <span /><span /><span />
        </button>
      )}

      {/* back to home from results */}
      {screen === "results" && !historyOpen && (
        <button className="back-btn" onClick={() => { setScreen("home"); setThoughtText(""); setInputOpen(false); }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8M8 12h8" style={{ transform: "rotate(45deg)", transformOrigin: "center" }} />
          </svg>
        </button>
      )}

      {/* history panel */}
      {historyOpen && (
        <>
          <div className="history-overlay" onClick={() => setHistoryOpen(false)} />
          <div className="history-panel">
            <h2 className="history-title">Your thoughts</h2>
            <p className="history-subtitle">Stored only on this device</p>
            {HISTORY_ITEMS.map((item) => (
              <div key={item.id} className={`history-item ${item.resolved ? "resolved" : ""}`}>
                <div className="history-text">{item.text}</div>
                <div className="history-meta">
                  <span className="history-date">{item.date}</span>
                  <button
                    className={`resolve-btn ${item.resolved ? "done" : ""} ${!item.resolved && item.theme === "professional_worth" ? "pulsing" : ""}`}
                    onClick={() => !item.resolved && handleResolve(item.id)}
                    title={item.resolved ? "Resolved" : "Mark as resolved"}
                  >
                    ✓
                  </button>
                </div>
                {item.resolved && item.whatHelped && (
                  <div className="helped-preview">"{item.whatHelped}"</div>
                )}
                {resolveId === item.id && !item.resolved && (
                  <div className="resolve-input">
                    <textarea
                      value={resolveText}
                      onChange={(e) => setResolveText(e.target.value)}
                      placeholder="What helped you with this? Others who feel the same would love to know..."
                    />
                    <button className="resolve-submit" onClick={() => setResolveId(null)}>Share what helped</button>
                  </div>
                )}
              </div>
            ))}
            <button className="settings-link" onClick={() => setSettingsOpen(!settingsOpen)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
              Settings
            </button>
            {settingsOpen && (
              <div style={{ marginTop: 12, padding: 16, background: "var(--card-bg)", borderRadius: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 400, marginBottom: 14, color: "var(--text)" }}>Account</div>
                <div style={{ fontSize: 13, color: "var(--text-soft)", marginBottom: 8 }}>user@example.com</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--highlight-border)" }}>
                  <span style={{ fontSize: 13, color: "var(--text-soft)" }}>Delayed prompts</span>
                  <div style={{ width: 40, height: 22, borderRadius: 11, background: "var(--accent)", position: "relative", cursor: "pointer" }}>
                    <div style={{ width: 18, height: 18, borderRadius: 9, background: "white", position: "absolute", top: 2, right: 2, transition: "0.2s ease" }} />
                  </div>
                </div>
                <button style={{ marginTop: 12, padding: "10px 0", width: "100%", border: "none", background: "none", color: "#C75050", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "var(--sans)" }}>
                  Delete account
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* home screen */}
      {screen === "home" && (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <div className="logo-container" onClick={() => setInputOpen(true)}>
            <div className="logo-ring-outer" />
            <div className="logo-ring" />
            <div className="logo-core">
              <span className="logo-text">echo</span>
            </div>
          </div>
          <p style={{ marginTop: 32, fontSize: 14, fontWeight: 300, color: "var(--text-muted)", letterSpacing: 0.5, animation: "fadeIn 1s ease 0.5s both" }}>
            tap to share what's on your mind
          </p>
        </div>
      )}

      {/* processing screen */}
      {screen === "processing" && (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div className="logo-container">
            <div className="logo-ring-outer" />
            <div className="logo-ring" />
            <div className="logo-core">
              <span className="logo-text">echo</span>
            </div>
          </div>
          <div className="processing-text">
            <span key={processingText}>{processingPhrases[processingText]}</span>
          </div>
        </div>
      )}

      {/* results screen */}
      {screen === "results" && (
        <div style={{ paddingTop: 80 }}>
          <div className="count-section">
            <div className="count-number">{matchCount.toLocaleString()}</div>
            <div className="count-label">people have felt something like this</div>
          </div>
          <div className="cards-container">
            {SIMILAR_THOUGHTS.map((t, i) => (
              <div
                key={t.id}
                className={`thought-card ${t.hasResolution ? "highlighted" : ""} ${i < cardsVisible ? "visible" : ""}`}
                onClick={() => t.hasResolution && setBottomSheet(t)}
              >
                <p className="card-text">{t.text}</p>
                {t.hasResolution && (
                  <div className="card-badge">someone found a way through</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* input overlay */}
      {inputOpen && screen === "home" && (
        <div className="input-overlay">
          <button className="close-input" onClick={() => setInputOpen(false)}>×</button>
          <div className="input-bubble">
            <textarea
              autoFocus
              value={thoughtText}
              onChange={(e) => setThoughtText(e.target.value.slice(0, 280))}
              placeholder="What's weighing on you right now?"
            />
            <div className="input-meta">
              <span className="char-count" style={{ color: thoughtText.length > 250 ? "var(--accent)" : undefined }}>
                {thoughtText.length}/280
              </span>
              <button
                className="send-btn"
                disabled={!thoughtText.trim()}
                onClick={handleSubmit}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* bottom sheet */}
      {bottomSheet && (
        <>
          <div className="sheet-overlay" onClick={() => setBottomSheet(null)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-label">What helped</div>
            <div className="sheet-body">{bottomSheet.resolution}</div>
            <div className="sheet-footer">Written by someone who's been there.</div>
          </div>
        </>
      )}

      {/* floating home button on results */}
      {screen === "results" && (
        <div className="nav-home">
          <button onClick={() => { setScreen("home"); setThoughtText(""); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="8" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}