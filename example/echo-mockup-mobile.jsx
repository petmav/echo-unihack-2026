import { useState, useEffect, useRef, useCallback } from "react";

/* ─────────────────────────── SEED DATA ─────────────────────────── */
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
  { title: "Your words\nstay yours", desc: "Your thoughts never leave your device. We only ever see the emotion, never the details." },
  { title: "Sometimes it\nhelps to know", desc: "When others find their way through, they share what helped — in their own words, for people just like you." },
];

const MENU_ITEMS = [
  { id: "thoughts", label: "Past thoughts", icon: "thoughts" },
  { id: "trends", label: "Trends", icon: "trends" },
  { id: "account", label: "Account", icon: "account" },
  { id: "about", label: "About Echo", icon: "about" },
];

/* ─────────────────────────── SVG LOGO ─────────────────────────── */
const EchoLogo = ({ size = 100, animate = true }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="92" stroke="#C8856C" strokeWidth="1" opacity="0.12"
      style={animate ? { animation: "logoRipple3 7s ease-in-out infinite", transformOrigin: "center" } : {}} />
    <circle cx="100" cy="100" r="78" stroke="#C8856C" strokeWidth="1.2" opacity="0.2"
      style={animate ? { animation: "logoRipple2 7s ease-in-out infinite", transformOrigin: "center" } : {}} />
    <circle cx="100" cy="100" r="62" stroke="#C8856C" strokeWidth="1.5" opacity="0.3"
      style={animate ? { animation: "logoRipple1 7s ease-in-out infinite", transformOrigin: "center" } : {}} />
    <defs>
      <radialGradient id="ecg" cx="0.38" cy="0.35" r="0.65">
        <stop offset="0%" stopColor="#D49A82" />
        <stop offset="100%" stopColor="#A06B55" />
      </radialGradient>
      <radialGradient id="ecgw" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#C8856C" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#C8856C" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="100" cy="100" r="56" fill="url(#ecgw)"
      style={animate ? { animation: "logoBreathe 7s ease-in-out infinite", transformOrigin: "center" } : {}} />
    <circle cx="100" cy="100" r="44" fill="url(#ecg)"
      style={animate ? { animation: "logoBreathe 7s ease-in-out infinite", transformOrigin: "center" } : {}} />
    <ellipse cx="88" cy="88" rx="18" ry="14" fill="white" opacity="0.12" transform="rotate(-20 88 88)" />
    <text x="100" y="108" textAnchor="middle" fontFamily="'Fraunces', Georgia, serif"
      fontSize="28" fontWeight="300" fill="white" letterSpacing="5" opacity="0.95">echo</text>
  </svg>
);

const EchoLogoSmall = () => (
  <svg width="28" height="28" viewBox="0 0 200 200" fill="none">
    <circle cx="100" cy="100" r="78" stroke="#C8856C" strokeWidth="4" opacity="0.2" />
    <defs><radialGradient id="ecsm" cx="0.38" cy="0.35" r="0.65"><stop offset="0%" stopColor="#D49A82" /><stop offset="100%" stopColor="#A06B55" /></radialGradient></defs>
    <circle cx="100" cy="100" r="56" fill="url(#ecsm)" />
    <ellipse cx="88" cy="88" rx="18" ry="14" fill="white" opacity="0.12" transform="rotate(-20 88 88)" />
  </svg>
);

/* ─────────────────────────── ICONS ─────────────────────────── */
const Icons = {
  thoughts: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  trends: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  account: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  about: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>,
  back: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>,
  send: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  close: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  home: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg>,
  shield: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  trash: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>,
};

/* ─────────────────────────── HELPERS ─────────────────────────── */
const lerp = (a, b, t) => a + (b - a) * t;

const TREND_DATA = [
  { week: "W1", self_worth: 3, professional: 1, relationships: 2 },
  { week: "W2", self_worth: 2, professional: 2, relationships: 1 },
  { week: "W3", self_worth: 4, professional: 1, relationships: 3 },
  { week: "W4", self_worth: 2, professional: 3, relationships: 1 },
  { week: "W5", self_worth: 1, professional: 2, relationships: 2 },
  { week: "W6", self_worth: 3, professional: 1, relationships: 1 },
  { week: "W7", self_worth: 1, professional: 2, relationships: 0 },
  { week: "W8", self_worth: 2, professional: 1, relationships: 1 },
];

/* ════════════════════════════ MAIN ════════════════════════════ */
export default function EchoApp() {
  const [screen, setScreen] = useState("onboarding");
  const [authMode, setAuthMode] = useState("login");
  const [onboardIdx, setOnboardIdx] = useState(0);
  const [inputOpen, setInputOpen] = useState(false);
  const [thoughtText, setThoughtText] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [countAnimDone, setCountAnimDone] = useState(false);
  const [processingText, setProcessingText] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bottomSheet, setBottomSheet] = useState(null);
  const [resolveId, setResolveId] = useState(null);
  const [resolveText, setResolveText] = useState("");
  const [cardsVisible, setCardsVisible] = useState(0);
  const [animDir, setAnimDir] = useState(""); // "forward" | "back" | ""
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [screenStack, setScreenStack] = useState(["onboarding"]);

  const TARGET_COUNT = 847;
  const processingPhrases = ["finding your people...", "you're not alone in this...", "others have been here too..."];

  const goTo = useCallback((next) => {
    setAnimDir("forward");
    setScreenStack(s => [...s, next]);
    setTimeout(() => { setScreen(next); setTimeout(() => setAnimDir(""), 400); }, 10);
  }, []);

  const goBack = useCallback(() => {
    setAnimDir("back");
    setTimeout(() => {
      setScreen("home");
      setScreenStack(s => { const n = [...s]; n.pop(); return n; });
      setTimeout(() => setAnimDir(""), 400);
    }, 10);
  }, []);

  useEffect(() => {
    if (screen !== "results") return;
    setMatchCount(0); setCountAnimDone(false); setCardsVisible(0);
    let start = null;
    const duration = 1800;
    const animate = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setMatchCount(Math.round(lerp(0, TARGET_COUNT, 1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(animate);
      else { setCountAnimDone(true); for (let i = 0; i < SIMILAR_THOUGHTS.length; i++) setTimeout(() => setCardsVisible(v => v + 1), 100 * i); }
    };
    const t = setTimeout(() => requestAnimationFrame(animate), 400);
    return () => clearTimeout(t);
  }, [screen]);

  useEffect(() => {
    if (screen !== "processing") return;
    setProcessingText(0);
    const iv = setInterval(() => setProcessingText(p => (p + 1) % 3), 1200);
    const to = setTimeout(() => { clearInterval(iv); setScreen("results"); }, 3600);
    return () => { clearInterval(iv); clearTimeout(to); };
  }, [screen]);

  const handleSubmit = () => { if (!thoughtText.trim()) return; setInputOpen(false); setScreen("processing"); };

  const isSubScreen = ["thoughts", "trends", "account", "about"].includes(screen);
  const subAnimClass = animDir === "forward" ? "anim-slide-in" : animDir === "back" ? "anim-slide-out" : "";

  /* ════════════════════════════ CSS ════════════════════════════ */
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;1,9..144,300&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&display=swap');
    :root{--bg:#FAF7F2;--bg-warm:#F3EBE1;--text:#2C2825;--text-soft:#7A706A;--text-muted:#B5ADA6;--accent:#C8856C;--accent-dark:#A06B55;--accent-soft:#E8C4B4;--accent-glow:rgba(200,133,108,0.12);--card:#FFFFFF;--card-sh:0 1px 12px rgba(44,40,37,0.05);--hl:#FFF8F0;--hl-bdr:#EEDCC8;--green:#7BAE7F;--green-s:#E8F5E9;--red:#C75050;--serif:'Fraunces',Georgia,serif;--sans:'DM Sans',system-ui,sans-serif;--safe-t:50px;--safe-b:34px}
    *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    .phone-wrapper{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#E8E3DD;background-image:radial-gradient(ellipse at 30% 20%,rgba(200,133,108,0.06) 0%,transparent 60%),radial-gradient(ellipse at 70% 80%,rgba(200,133,108,0.04) 0%,transparent 50%);font-family:var(--sans);padding:20px}
    .phone-frame{width:375px;height:812px;background:#1A1A1A;border-radius:52px;padding:12px;box-shadow:0 0 0 1px rgba(255,255,255,0.08),0 24px 80px rgba(0,0,0,0.25),0 8px 24px rgba(0,0,0,0.15),inset 0 0 0 1px rgba(255,255,255,0.04);position:relative}
    .phone-screen{width:100%;height:100%;background:var(--bg);border-radius:42px;overflow:hidden;position:relative}
    .status-bar{position:absolute;top:0;left:0;right:0;height:var(--safe-t);display:flex;align-items:flex-end;justify-content:space-between;padding:0 28px 6px;font-size:12px;font-weight:600;color:var(--text);z-index:200;pointer-events:none}
    .status-bar .indicators{display:flex;gap:5px;align-items:center}
    .status-bar .indicators svg{width:15px;height:15px}
    .dynamic-island{position:absolute;top:12px;left:50%;transform:translateX(-50%);width:120px;height:34px;background:#1A1A1A;border-radius:20px;z-index:300}
    .home-indicator{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:134px;height:5px;background:var(--text);border-radius:3px;opacity:0.18;z-index:200}
    .scr{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch}
    .scr::-webkit-scrollbar{display:none}
    .grain{position:absolute;inset:0;border-radius:42px;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E");pointer-events:none;z-index:150}

    @keyframes logoBreathe{0%,100%{transform:scale(1)}35%{transform:scale(1.08)}50%{transform:scale(1.06)}65%{transform:scale(1.08)}}
    @keyframes logoRipple1{0%,100%{transform:scale(1);opacity:0.3}35%,65%{transform:scale(1.15);opacity:0.15}}
    @keyframes logoRipple2{0%,100%{transform:scale(1);opacity:0.2}35%,65%{transform:scale(1.25);opacity:0.08}}
    @keyframes logoRipple3{0%,100%{transform:scale(1);opacity:0.12}35%,65%{transform:scale(1.4);opacity:0.04}}
    @keyframes floatUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
    @keyframes textCycle{0%,15%{opacity:0;transform:translateY(10px)}25%,75%{opacity:1;transform:translateY(0)}85%,100%{opacity:0;transform:translateY(-10px)}}
    @keyframes countPop{0%{transform:scale(0.85);opacity:0}60%{transform:scale(1.03)}100%{transform:scale(1);opacity:1}}
    @keyframes pulseResolve{0%,100%{box-shadow:0 0 0 0 rgba(200,133,108,0.35)}50%{box-shadow:0 0 0 8px rgba(200,133,108,0)}}
    @keyframes menuItemIn{from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:translateX(0)}}
    @keyframes slideInRight{from{opacity:0.5;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}}
    @keyframes slideOutRight{from{opacity:1;transform:translateX(0)}to{opacity:0.5;transform:translateX(60px)}}

    .anim-slide-in{animation:slideInRight 0.38s cubic-bezier(0.22,1,0.36,1) both}
    .anim-slide-out{animation:slideOutRight 0.25s ease both}

    /* nav header */
    .nav-hd{display:flex;align-items:center;gap:12px;padding:calc(var(--safe-t)+8px) 20px 16px;position:sticky;top:0;background:rgba(250,247,242,0.88);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);z-index:50}
    .nav-bk{width:38px;height:38px;border-radius:50%;border:none;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text);transition:background 0.15s}
    .nav-bk:active{background:rgba(0,0,0,0.04)}
    .nav-tt{font-family:var(--serif);font-size:20px;font-weight:400;color:var(--text);letter-spacing:-0.3px}

    /* hamburger */
    .hmb{position:absolute;top:calc(var(--safe-t)+6px);left:16px;z-index:90;width:42px;height:42px;border-radius:50%;border:none;background:rgba(255,255,255,0.65);backdrop-filter:blur(12px);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4.5px;transition:all 0.2s}
    .hmb:active{transform:scale(0.92)}
    .hmb span{width:17px;height:1.5px;background:var(--text);border-radius:2px;transition:all 0.35s cubic-bezier(0.22,1,0.36,1);display:block}
    .hmb.open span:nth-child(1){transform:rotate(45deg) translate(4px,4px)}
    .hmb.open span:nth-child(2){opacity:0;transform:scaleX(0)}
    .hmb.open span:nth-child(3){transform:rotate(-45deg) translate(4px,-4px)}

    /* menu */
    .menu-scr{position:absolute;inset:0;background:var(--bg);z-index:80;display:flex;flex-direction:column;padding:calc(var(--safe-t)+56px) 24px var(--safe-b);animation:fadeIn 0.25s ease}
    .menu-list{flex:1;display:flex;flex-direction:column;gap:4px;margin-top:20px}
    .menu-item{display:flex;align-items:center;gap:16px;padding:18px 20px;border:none;background:transparent;border-radius:16px;cursor:pointer;font-family:var(--sans);font-size:17px;font-weight:400;color:var(--text);text-align:left;transition:background 0.15s;width:100%}
    .menu-item:active{background:var(--bg-warm)}
    .menu-item .iw{width:44px;height:44px;border-radius:14px;background:var(--card);display:flex;align-items:center;justify-content:center;color:var(--accent);box-shadow:0 1px 4px rgba(44,40,37,0.06)}
    .menu-item .arr{margin-left:auto;color:var(--text-muted);font-size:20px}
    .menu-ft{padding:16px 0;display:flex;align-items:center;gap:10px}
    .menu-ft-txt{font-size:12px;color:var(--text-muted);font-weight:300;line-height:1.4}

    /* input */
    .inp-ov{position:absolute;inset:0;background:rgba(250,247,242,0.95);backdrop-filter:blur(24px);z-index:70;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;animation:fadeIn 0.25s}
    .inp-w{width:100%;animation:floatUp 0.35s cubic-bezier(0.22,1,0.36,1)}
    .inp-w textarea{width:100%;min-height:150px;border:none;border-radius:22px;padding:22px;font-family:var(--sans);font-size:16px;font-weight:300;line-height:1.65;color:var(--text);background:var(--card);box-shadow:0 6px 32px rgba(44,40,37,0.07);resize:none;outline:none}
    .inp-w textarea::placeholder{color:var(--text-muted);font-style:italic}
    .inp-act{display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding:0 4px}
    .chr-ct{font-size:12.5px;color:var(--text-muted);font-weight:400;font-variant-numeric:tabular-nums}
    .snd-btn{width:50px;height:50px;border-radius:50%;border:none;background:var(--accent);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;box-shadow:0 4px 16px rgba(200,133,108,0.3)}
    .snd-btn:active{transform:scale(0.93)}
    .snd-btn:disabled{opacity:0.35}
    .cls-btn{position:absolute;top:calc(var(--safe-t)+8px);right:16px;width:40px;height:40px;border-radius:50%;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-soft)}

    /* processing */
    .proc-msg{font-size:15px;font-weight:300;color:var(--text-soft);letter-spacing:0.3px;margin-top:36px;height:24px;text-align:center}
    .proc-msg span{animation:textCycle 1.2s ease-in-out;display:inline-block}

    /* count */
    .cnt-sec{text-align:center;padding:calc(var(--safe-t)+60px) 24px 24px;animation:countPop 0.6s cubic-bezier(0.22,1,0.36,1)}
    .cnt-num{font-family:var(--serif);font-size:68px;font-weight:600;color:var(--text);line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-2px}
    .cnt-lbl{font-size:16px;font-weight:300;color:var(--text-soft);margin-top:10px;line-height:1.5}

    /* cards */
    .crd-list{padding:20px 16px calc(var(--safe-b)+60px)}
    .tc{background:var(--card);border-radius:18px;padding:20px;margin-bottom:10px;box-shadow:var(--card-sh);opacity:0;transform:translateY(14px);transition:opacity 0.4s ease,transform 0.4s cubic-bezier(0.22,1,0.36,1)}
    .tc.vis{opacity:1;transform:translateY(0)}
    .tc.hl{background:var(--hl);border:1px solid var(--hl-bdr);cursor:pointer}
    .tc.hl:active{transform:scale(0.985)}
    .tc-txt{font-size:14.5px;font-weight:300;line-height:1.7;color:var(--text)}
    .tc-badge{display:inline-flex;align-items:center;gap:5px;margin-top:12px;padding:5px 12px;border-radius:20px;background:var(--accent-glow);font-size:11.5px;font-weight:500;color:var(--accent)}

    /* sheet */
    .sh-bg{position:absolute;inset:0;background:rgba(44,40,37,0.25);z-index:100;animation:fadeIn 0.2s}
    .sh{position:absolute;bottom:0;left:0;right:0;background:var(--card);border-radius:24px 24px 0 0;padding:16px 24px calc(var(--safe-b)+16px);z-index:101;animation:slideUp 0.35s cubic-bezier(0.22,1,0.36,1);max-height:65%;overflow-y:auto}
    .sh-handle{width:36px;height:4px;border-radius:3px;background:var(--text-muted);margin:0 auto 20px;opacity:0.35}
    .sh-tt{font-family:var(--serif);font-size:17px;font-weight:400;color:var(--text);margin-bottom:14px}
    .sh-body{font-size:14.5px;font-weight:300;line-height:1.75;color:var(--text);margin-bottom:18px}
    .sh-note{font-size:12px;color:var(--text-muted);font-style:italic}

    /* fab */
    .fab{position:absolute;bottom:calc(var(--safe-b)+8px);left:50%;transform:translateX(-50%);z-index:60}
    .fab button{width:52px;height:52px;border-radius:50%;border:none;background:var(--card);box-shadow:0 3px 16px rgba(44,40,37,0.1);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--accent)}
    .fab button:active{transform:scale(0.92)}

    /* onboarding */
    .ob-scr{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 28px;text-align:center}
    .ob-card{animation:floatUp 0.45s cubic-bezier(0.22,1,0.36,1)}
    .ob-tt{font-family:var(--serif);font-size:30px;font-weight:400;color:var(--text);line-height:1.2;margin-top:24px;margin-bottom:18px;white-space:pre-line;letter-spacing:-0.5px}
    .ob-desc{font-size:15px;font-weight:300;color:var(--text-soft);line-height:1.7;max-width:290px;margin:0 auto}
    .ob-dots{display:flex;gap:7px;margin-top:40px}
    .ob-dot{width:7px;height:7px;border-radius:50%;background:var(--text-muted);opacity:0.25;transition:all 0.3s}
    .ob-dot.active{opacity:1;background:var(--accent);width:22px;border-radius:4px}
    .ob-act{display:flex;gap:14px;margin-top:36px}
    .btn-p{padding:14px 34px;border-radius:26px;border:none;background:var(--accent);color:white;font-family:var(--sans);font-size:15px;font-weight:500;cursor:pointer;letter-spacing:0.2px}
    .btn-p:active{transform:scale(0.96)}
    .btn-g{padding:14px 20px;border-radius:26px;border:none;background:transparent;color:var(--text-soft);font-family:var(--sans);font-size:15px;font-weight:400;cursor:pointer}

    /* auth */
    .auth-scr{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 28px}
    .auth-ltx{font-family:var(--serif);font-size:14px;font-weight:300;color:var(--text-muted);letter-spacing:4px;text-transform:uppercase;margin-top:12px;margin-bottom:40px}
    .auth-fm{width:100%}
    .auth-fd{margin-bottom:12px}
    .auth-fd input{width:100%;padding:15px 18px;border:1px solid #E0D8D0;border-radius:14px;font-family:var(--sans);font-size:15px;font-weight:300;color:var(--text);background:var(--card);outline:none;transition:border-color 0.2s}
    .auth-fd input:focus{border-color:var(--accent)}
    .auth-fd input::placeholder{color:var(--text-muted)}
    .auth-sub{width:100%;padding:15px;border-radius:14px;border:none;background:var(--accent);color:white;font-family:var(--sans);font-size:15px;font-weight:500;cursor:pointer;margin-top:8px}
    .auth-sub:active{transform:scale(0.98)}
    .auth-sw{margin-top:20px;font-size:13.5px;color:var(--text-muted);text-align:center}
    .auth-sw button{border:none;background:none;color:var(--accent);font-family:var(--sans);font-size:13.5px;font-weight:500;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
    .prv-pill{margin-top:28px;padding:14px 18px;background:var(--hl);border-radius:14px;text-align:center}
    .prv-pill p{font-size:12px;color:var(--text-soft);line-height:1.6;font-weight:300}

    /* panels */
    .pnl-body{padding:0 16px calc(var(--safe-b)+16px)}
    .hi{background:var(--card);border-radius:16px;padding:16px;margin-bottom:8px;box-shadow:0 1px 6px rgba(44,40,37,0.04)}
    .hi.res{opacity:0.55}
    .hi-txt{font-size:14px;font-weight:400;color:var(--text);line-height:1.5;margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .hi-meta{display:flex;align-items:center;justify-content:space-between}
    .hi-date{font-size:12px;color:var(--text-muted)}
    .hi-res{width:32px;height:32px;border-radius:50%;border:1.5px solid var(--text-muted);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-muted);transition:all 0.2s}
    .hi-res:active{transform:scale(0.9)}
    .hi-res.done{background:var(--green);border-color:var(--green);color:white}
    .hi-res.pulse{animation:pulseResolve 2s ease-in-out infinite;border-color:var(--accent);color:var(--accent)}
    .hi-exp{margin-top:12px;animation:floatUp 0.25s}
    .hi-exp textarea{width:100%;min-height:72px;border:1px solid var(--hl-bdr);border-radius:12px;padding:12px;font-family:var(--sans);font-size:13.5px;font-weight:300;line-height:1.6;color:var(--text);background:var(--hl);resize:none;outline:none}
    .hi-exp textarea:focus{border-color:var(--accent)}
    .hi-sub{margin-top:8px;padding:8px 18px;border-radius:20px;border:none;background:var(--accent);color:white;font-family:var(--sans);font-size:12.5px;font-weight:500;cursor:pointer}
    .hi-helped{margin-top:10px;padding:10px 12px;background:var(--green-s);border-radius:10px;font-size:12.5px;color:var(--text-soft);line-height:1.5;font-style:italic}
    .prv-ban{margin:16px 0 8px;padding:12px 14px;background:var(--hl);border-radius:12px;display:flex;align-items:center;gap:10px;color:var(--text-soft)}
    .prv-ban p{font-size:11.5px;line-height:1.45;font-weight:300}

    /* account */
    .acc-sec{padding:0 16px}
    .acc-card{background:var(--card);border-radius:16px;overflow:hidden;box-shadow:var(--card-sh);margin-bottom:12px}
    .acc-row{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(0,0,0,0.04);font-size:14px;color:var(--text)}
    .acc-row:last-child{border-bottom:none}
    .acc-row .lbl{font-weight:400}
    .acc-row .val{font-weight:300;color:var(--text-soft);font-size:13.5px}
    .tgl{width:44px;height:26px;border-radius:13px;border:none;cursor:pointer;position:relative;transition:background 0.2s}
    .tgl.on{background:var(--accent)}
    .tgl.off{background:#D0CBC5}
    .tgl .knob{position:absolute;top:3px;width:20px;height:20px;border-radius:50%;background:white;box-shadow:0 1px 4px rgba(0,0,0,0.12);transition:left 0.2s}
    .tgl.on .knob{left:21px}
    .tgl.off .knob{left:3px}
    .dgr-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:15px;border:none;background:var(--card);border-radius:16px;font-family:var(--sans);font-size:14px;font-weight:500;color:var(--red);cursor:pointer;box-shadow:var(--card-sh);margin-top:4px}
    .dgr-btn:active{opacity:0.7}

    /* trends */
    .trn-sec{padding:0 16px}
    .trn-card{background:var(--card);border-radius:16px;padding:20px;box-shadow:var(--card-sh);margin-bottom:12px}
    .trn-ct{font-size:13px;font-weight:500;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:14px}
    .trn-stat{font-family:var(--serif);font-size:36px;font-weight:600;color:var(--text);line-height:1}
    .trn-sl{font-size:13px;color:var(--text-muted);margin-top:4px;font-weight:300}
    .mini-chart{display:flex;align-items:flex-end;gap:6px;height:72px;margin-top:8px}
    .mini-bar-grp{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;height:100%;justify-content:flex-end}
    .mini-bar-stk{width:100%;display:flex;flex-direction:column;gap:1px;align-items:center}
    .mini-bar{width:100%;border-radius:3px 3px 0 0;min-height:2px}
    .mini-bar.sw{background:var(--accent)}.mini-bar.pr{background:var(--accent-soft)}.mini-bar.rl{background:#B5ADA6}
    .mini-lbl{font-size:9px;color:var(--text-muted);margin-top:4px}
    .legend{display:flex;gap:14px;margin-top:12px}
    .legend-i{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-soft)}
    .legend-d{width:8px;height:8px;border-radius:2px}

    /* about */
    .abt-sec{padding:0 16px calc(var(--safe-b)+16px)}
    .abt-hero{text-align:center;padding:20px 0 28px}
    .abt-tag{font-family:var(--serif);font-size:22px;font-weight:300;color:var(--text);line-height:1.4;margin-top:16px;font-style:italic}
    .abt-blk{background:var(--card);border-radius:16px;padding:20px;margin-bottom:12px;box-shadow:var(--card-sh)}
    .abt-bt{font-size:14px;font-weight:500;color:var(--text);margin-bottom:8px}
    .abt-blk p{font-size:13.5px;font-weight:300;color:var(--text-soft);line-height:1.65}

    .tap-hint{font-size:13.5px;font-weight:300;color:var(--text-muted);letter-spacing:0.3px;margin-top:28px;animation:fadeIn 1s ease 0.6s both}
  `;

  /* ═══════════════════════ SUB-SCREENS ═══════════════════════ */
  const PastThoughts = () => (
    <div className={`scr ${subAnimClass}`}>
      <div className="nav-hd">
        <button className="nav-bk" onClick={goBack}>{Icons.back}</button>
        <div className="nav-tt">Past thoughts</div>
      </div>
      <div className="pnl-body">
        <div className="prv-ban">{Icons.shield}<p>This data lives only on your device and is never uploaded.</p></div>
        {HISTORY_ITEMS.map(item => (
          <div key={item.id} className={`hi ${item.resolved ? "res" : ""}`}>
            <div className="hi-txt">{item.text}</div>
            <div className="hi-meta">
              <span className="hi-date">{item.date}</span>
              <button className={`hi-res ${item.resolved?"done":""} ${!item.resolved&&item.theme==="professional_worth"?"pulse":""}`}
                onClick={() => { if(!item.resolved){setResolveId(resolveId===item.id?null:item.id);setResolveText("");}}}>{Icons.check}</button>
            </div>
            {item.resolved && item.whatHelped && <div className="hi-helped">"{item.whatHelped}"</div>}
            {resolveId===item.id && !item.resolved && (
              <div className="hi-exp">
                <textarea value={resolveText} onChange={e=>setResolveText(e.target.value)} placeholder="What helped you with this?" />
                <button className="hi-sub" onClick={()=>setResolveId(null)}>Share what helped</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const Trends = () => (
    <div className={`scr ${subAnimClass}`}>
      <div className="nav-hd">
        <button className="nav-bk" onClick={goBack}>{Icons.back}</button>
        <div className="nav-tt">Trends</div>
      </div>
      <div className="trn-sec">
        <div className="prv-ban" style={{marginTop:0}}>{Icons.shield}<p>All computed locally on your device.</p></div>
        <div className="trn-card">
          <div className="trn-ct">Resolution rate</div>
          <div className="trn-stat">40%</div>
          <div className="trn-sl">2 of 5 thoughts resolved</div>
        </div>
        <div className="trn-card">
          <div className="trn-ct">Themes over 8 weeks</div>
          <div className="mini-chart">
            {TREND_DATA.map((w,i) => (
              <div className="mini-bar-grp" key={i}>
                <div className="mini-bar-stk">
                  <div className="mini-bar rl" style={{height:`${(w.relationships/5)*56}px`}} />
                  <div className="mini-bar pr" style={{height:`${(w.professional/5)*56}px`}} />
                  <div className="mini-bar sw" style={{height:`${(w.self_worth/5)*56}px`}} />
                </div>
                <span className="mini-lbl">{w.week}</span>
              </div>
            ))}
          </div>
          <div className="legend">
            <div className="legend-i"><div className="legend-d" style={{background:"var(--accent)"}} />Self-worth</div>
            <div className="legend-i"><div className="legend-d" style={{background:"var(--accent-soft)"}} />Work</div>
            <div className="legend-i"><div className="legend-d" style={{background:"#B5ADA6"}} />Relationships</div>
          </div>
        </div>
        <div className="trn-card">
          <div className="trn-ct">Most frequent</div>
          <div style={{fontFamily:"var(--serif)",fontSize:22,fontWeight:400,color:"var(--text)"}}>Self-worth</div>
          <div className="trn-sl" style={{marginTop:6}}>Appears in 60% of entries</div>
        </div>
      </div>
    </div>
  );

  const Account = () => (
    <div className={`scr ${subAnimClass}`}>
      <div className="nav-hd">
        <button className="nav-bk" onClick={goBack}>{Icons.back}</button>
        <div className="nav-tt">Account</div>
      </div>
      <div className="acc-sec">
        <div className="acc-card">
          <div className="acc-row"><span className="lbl">Email</span><span className="val">user@example.com</span></div>
          <div className="acc-row"><span className="lbl">Delayed prompts</span><button className={`tgl ${notifEnabled?"on":"off"}`} onClick={()=>setNotifEnabled(!notifEnabled)}><div className="knob"/></button></div>
          <div className="acc-row"><span className="lbl">Password</span><span className="val" style={{color:"var(--accent)",fontWeight:400,cursor:"pointer"}}>Change</span></div>
        </div>
        <div className="prv-ban" style={{marginTop:20,marginBottom:20}}>{Icons.shield}<p>Echo stores only your email. Your thoughts live exclusively on this device.</p></div>
        <button className="dgr-btn">{Icons.trash} Delete account</button>
      </div>
    </div>
  );

  const AboutPanel = () => (
    <div className={`scr ${subAnimClass}`}>
      <div className="nav-hd">
        <button className="nav-bk" onClick={goBack}>{Icons.back}</button>
        <div className="nav-tt">About</div>
      </div>
      <div className="abt-sec">
        <div className="abt-hero">
          <EchoLogo size={80} animate={false} />
          <div className="abt-tag">You are not alone.</div>
        </div>
        <div className="abt-blk"><div className="abt-bt">How Echo works</div><p>You share a thought. Echo anonymises it, then finds others who have felt the same way. You see how many people share your experience — and what helped them through it.</p></div>
        <div className="abt-blk"><div className="abt-bt">Privacy by design</div><p>Your raw words never leave your device. The server only sees anonymised emotions — no names, no details, no trace.</p></div>
        <div className="abt-blk"><div className="abt-bt">Built for UNIHACK 2026</div><p>Echo was built in 48 hours by a team that believes mental health support shouldn't require clinical gatekeeping or surrendering your privacy.</p></div>
      </div>
    </div>
  );

  const renderSub = () => {
    if(screen==="thoughts") return <PastThoughts/>;
    if(screen==="trends") return <Trends/>;
    if(screen==="account") return <Account/>;
    if(screen==="about") return <AboutPanel/>;
    return null;
  };

  /* ═══════════════════════ RENDER ═══════════════════════ */
  return (
    <div className="phone-wrapper">
      <style>{css}</style>
      <div className="phone-frame">
        <div className="phone-screen">
          <div className="dynamic-island"/>
          <div className="status-bar">
            <span className="time">9:41</span>
            <span className="indicators">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 0 0-6 0zm-4-4l2 2a7.074 7.074 0 0 1 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/></svg>
            </span>
          </div>
          <div className="grain"/>
          <div className="home-indicator"/>

          {/* onboarding */}
          {screen==="onboarding" && (
            <div className="scr"><div className="ob-scr">
              <div className="ob-card" key={onboardIdx}>
                <EchoLogo size={90} animate={onboardIdx===0} />
                <h1 className="ob-tt">{ONBOARDING[onboardIdx].title}</h1>
                <p className="ob-desc">{ONBOARDING[onboardIdx].desc}</p>
              </div>
              <div className="ob-dots">{ONBOARDING.map((_,i)=><div key={i} className={`ob-dot ${i===onboardIdx?"active":""}`}/>)}</div>
              <div className="ob-act">
                {onboardIdx<ONBOARDING.length-1?(
                  <><button className="btn-g" onClick={()=>setScreen("auth")}>Skip</button><button className="btn-p" onClick={()=>setOnboardIdx(i=>i+1)}>Next</button></>
                ):(<button className="btn-p" onClick={()=>setScreen("auth")}>Get started</button>)}
              </div>
            </div></div>
          )}

          {/* auth */}
          {screen==="auth" && (
            <div className="scr"><div className="auth-scr">
              <EchoLogo size={72} animate={false} />
              <div className="auth-ltx">echo</div>
              <div className="auth-fm">
                <div className="auth-fd"><input type="email" placeholder="Email"/></div>
                <div className="auth-fd"><input type="password" placeholder="Password"/></div>
                <button className="auth-sub" onClick={()=>setScreen("home")}>{authMode==="login"?"Sign in":"Create account"}</button>
                <div className="auth-sw">
                  {authMode==="login"?<span>No account? <button onClick={()=>setAuthMode("signup")}>Sign up</button></span>
                  :<span>Already have one? <button onClick={()=>setAuthMode("login")}>Sign in</button></span>}
                </div>
                <div className="prv-pill"><p>No names. No profiles. Just an email.<br/>Your thoughts never leave your device.</p></div>
              </div>
            </div></div>
          )}

          {/* home */}
          {screen==="home" && (
            <div className="scr"><div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
              <div onClick={()=>setInputOpen(true)} style={{cursor:"pointer"}}><EchoLogo size={150} animate={true}/></div>
              <p className="tap-hint">tap to share what's on your mind</p>
            </div></div>
          )}

          {/* processing */}
          {screen==="processing" && (
            <div className="scr"><div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
              <EchoLogo size={140} animate={true}/>
              <div className="proc-msg"><span key={processingText}>{processingPhrases[processingText]}</span></div>
            </div></div>
          )}

          {/* results */}
          {screen==="results" && (
            <div className="scr">
              <div className="cnt-sec">
                <div className="cnt-num">{matchCount.toLocaleString()}</div>
                <div className="cnt-lbl">people have felt something like this</div>
              </div>
              <div className="crd-list">
                {SIMILAR_THOUGHTS.map((t,i) => (
                  <div key={t.id} className={`tc ${t.hasResolution?"hl":""} ${i<cardsVisible?"vis":""}`}
                    onClick={()=>t.hasResolution&&setBottomSheet(t)}>
                    <p className="tc-txt">{t.text}</p>
                    {t.hasResolution && <div className="tc-badge">✦ someone found a way through</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* sub-screens */}
          {isSubScreen && renderSub()}

          {/* hamburger */}
          {(screen==="home"||screen==="results")&&!menuOpen && (
            <button className="hmb" onClick={()=>setMenuOpen(true)}><span/><span/><span/></button>
          )}

          {/* menu */}
          {menuOpen && (
            <div className="menu-scr">
              <button className="hmb open" style={{zIndex:91}} onClick={()=>setMenuOpen(false)}><span/><span/><span/></button>
              <div className="menu-list">
                {MENU_ITEMS.map((item,i)=>(
                  <button key={item.id} className="menu-item" style={{animation:`menuItemIn 0.35s cubic-bezier(0.22,1,0.36,1) ${80*i}ms both`}}
                    onClick={()=>{setMenuOpen(false);goTo(item.id);}}>
                    <div className="iw">{Icons[item.icon]}</div>
                    {item.label}
                    <span className="arr">›</span>
                  </button>
                ))}
              </div>
              <div className="menu-ft">
                <EchoLogoSmall/>
                <span className="menu-ft-txt">Echo · Built at UNIHACK 2026<br/>Your thoughts. Your device. Always.</span>
              </div>
            </div>
          )}

          {/* input */}
          {inputOpen&&screen==="home" && (
            <div className="inp-ov">
              <button className="cls-btn" onClick={()=>setInputOpen(false)}>{Icons.close}</button>
              <div className="inp-w">
                <textarea autoFocus value={thoughtText} onChange={e=>setThoughtText(e.target.value.slice(0,280))} placeholder="What's weighing on you right now?"/>
                <div className="inp-act">
                  <span className="chr-ct" style={{color:thoughtText.length>250?"var(--accent)":undefined}}>{thoughtText.length}/280</span>
                  <button className="snd-btn" disabled={!thoughtText.trim()} onClick={handleSubmit}>{Icons.send}</button>
                </div>
              </div>
            </div>
          )}

          {/* sheet */}
          {bottomSheet && (
            <>
              <div className="sh-bg" onClick={()=>setBottomSheet(null)}/>
              <div className="sh">
                <div className="sh-handle"/>
                <div className="sh-tt">What helped</div>
                <div className="sh-body">{bottomSheet.resolution}</div>
                <div className="sh-note">Written by someone who's been there.</div>
              </div>
            </>
          )}

          {/* fab */}
          {screen==="results"&&!menuOpen && (
            <div className="fab"><button onClick={()=>{setScreen("home");setThoughtText("");}}>{Icons.home}</button></div>
          )}
        </div>
      </div>
    </div>
  );
}