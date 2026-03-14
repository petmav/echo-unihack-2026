"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Target } from "lucide-react";

import type { ThemeCountSummary } from "@/lib/api";
import type {
  AppScreen,
  ThoughtResponse,
  PresenceLevel,
  FutureLetter,
  LocalThought,
  SavedAnchor,
} from "@/lib/types";
import {
  PROCESSING_MIN_DURATION_MS,
  CARD_STAGGER_DELAY_MS,
  DEMO_FUTURE_LETTER,
  inferThemeFromText,
  RISK_THEMES,
} from "@/lib/constants";
import {
  saveThought,
  getThoughtHistory,
  resolveThought as resolveThoughtLocal,
  saveJwt,
  getJwt,
  clearAllData,
  hasCompletedOnboarding,
  markOnboardingComplete,
  saveFutureLetter,
  getFutureLettersForTheme,
  saveAnchor,
  getSavedAnchorsForTheme,
  getAllSavedAnchors,
  getMostRecentTheme,
  presenceLevelFromCount,
  getNotificationOptIn,
  setNotificationOptIn,
  getNextPromptCandidate,
  setLastPromptDate,
  saveAdminStatus,
  getAdminStatus,
} from "@/lib/storage";
import { initializeKey, clearKey } from "@/lib/crypto";
import {
  submitThought,
  getSimilarThoughts,
  getSeedForTheme,
  getThoughtsByTheme,
  submitResolution,
  getResolution,
  login,
  register,
  deleteAccount,
  getThemeAggregates,
  getThemeCount,
  ApiError,
} from "@/lib/api";
import { THEME_DISPLAY_LABELS } from "@/lib/constants";
import { useDeviceType } from "@/lib/hooks";
import { findQuietWin, type QuietWin } from "@/lib/quietWins";
import {
  findRecurrencePattern,
  type RecurrencePattern,
} from "@/lib/recurrencePattern";

import { EchoLogo } from "@/components/echo/EchoLogo";
import { ThoughtInput } from "@/components/echo/ThoughtInput";
import { ProcessingScreen } from "@/components/echo/ProcessingScreen";
import { CountReveal } from "@/components/echo/CountReveal";
import { ThoughtCardList } from "@/components/echo/ThoughtCard";
import { BottomSheet } from "@/components/echo/BottomSheet";
import { HistoryPanel } from "@/components/echo/HistoryPanel";
import { TrendsPanel } from "@/components/echo/TrendsPanel";
import { AccountPanel } from "@/components/echo/AccountPanel";
import { AboutPanel } from "@/components/echo/AboutPanel";
import { PrivacyPanel } from "@/components/echo/PrivacyPanel";
import { AdminPanel } from "@/components/echo/AdminPanel";
import { MenuOverlay } from "@/components/echo/MenuOverlay";
import { HamburgerButton } from "@/components/echo/HamburgerButton";
import { OnboardingScreen } from "@/components/echo/OnboardingScreen";
import { AuthScreen } from "@/components/echo/AuthScreen";
import { SafetyBanner } from "@/components/echo/SafetyBanner";
import { FutureYouBanner } from "@/components/echo/FutureYouBanner";
import { QuietWinBanner } from "@/components/echo/QuietWinBanner";
import { RecurrencePatternBanner } from "@/components/echo/RecurrencePatternBanner";
import { SavedAnchorsBanner } from "@/components/echo/SavedAnchorsBanner";
import { ThemeResolutionAggregateBanner } from "@/components/echo/ThemeResolutionAggregateBanner";
import { DataModeBadge } from "@/components/echo/DataModeBadge";
import { DelayedPromptSheet } from "@/components/echo/DelayedPromptSheet";
import { SurroundingTopics } from "@/components/echo/SurroundingTopics";

/* ── Demo seed data for when backend is unavailable ── */
const SEED_THOUGHTS: ThoughtResponse[] = [
  { message_id: "t1", humanised_text: "There's this constant feeling that I'm falling behind while everyone around me seems to be moving forward effortlessly. I compare myself to others and wonder if I'll ever measure up to where I should be.", theme_category: "comparison", has_resolution: true, resolution_text: "I started writing down three things I did well each week, no matter how small. After a couple of months, I realised I was comparing my beginning to everyone else's middle. The comparison didn't stop completely but it lost its teeth.", similarity_score: 0.94 },
  { message_id: "t2", humanised_text: "I feel invisible at work. I contribute ideas and effort but it's like nobody notices. The recognition always goes to someone louder, someone more confident, and I'm left wondering if my work even matters.", theme_category: "professional_worth", has_resolution: false, similarity_score: 0.82 },
  { message_id: "t3", humanised_text: "Sometimes I lie awake replaying every awkward thing I've ever said in a conversation. The shame hits me physically and I convince myself everyone remembers those moments as vividly as I do.", theme_category: "self_worth", has_resolution: true, resolution_text: "Honestly what helped was asking a close friend if they remembered a specific moment I'd been agonizing over for years. They had absolutely no idea what I was talking about. That one conversation did more than months of overthinking.", similarity_score: 0.91 },
  { message_id: "t4", humanised_text: "I moved to a new city for an opportunity that felt right at the time but now I'm surrounded by strangers and the loneliness is heavier than I expected. I smile through the day and fall apart at night.", theme_category: "relationship_loss", has_resolution: false, similarity_score: 0.78 },
  { message_id: "t5", humanised_text: "My family expects me to follow a path I never chose. Every conversation turns into pressure about careers, relationships, timelines. I love them but I feel like I'm disappearing into their version of who I should be.", theme_category: "family_pressure", has_resolution: true, resolution_text: "I wrote a letter to my parents. Not to send — just for me. It helped me separate what I actually wanted from what I thought I was supposed to want. Then I had one honest conversation. Just one. It didn't fix everything but it cracked the door open.", similarity_score: 0.88 },
  { message_id: "t6", humanised_text: "I keep starting things with so much energy and then abandoning them halfway through. Projects, hobbies, relationships. I'm terrified that I'm fundamentally incapable of following through on anything that matters.", theme_category: "self_worth", has_resolution: false, similarity_score: 0.65 },
  { message_id: "t7", humanised_text: "There's a person in my life who makes me feel small in ways that are hard to explain to anyone else. It's not dramatic or obvious — it's subtle, constant, and I'm starting to believe the things they imply about me.", theme_category: "relationship_loss", has_resolution: true, resolution_text: "I started keeping a note on my phone of every time they said something that made me feel bad. Reading it back after a month made the pattern undeniable. It's easier to trust your own perception when you have the receipts.", similarity_score: 0.79 },
  { message_id: "t8", humanised_text: "I graduated months ago and still don't know what I'm doing. Everyone posts about their new jobs and achievements and I'm here applying to things I don't even want, wondering if the version of me that had ambitions still exists somewhere.", theme_category: "professional_worth", has_resolution: false, similarity_score: 0.72 },
  { message_id: "t9", humanised_text: "I catch myself performing happiness around people because the alternative — being honest about how I feel — sounds exhausting and risky. I'm tired of being the person who's always fine.", theme_category: "self_worth", has_resolution: false, similarity_score: 0.58 },
  { message_id: "t10", humanised_text: "I helped someone through the hardest time of their life and when I needed the same they weren't there. The imbalance in who I am for others versus who they are for me is a loneliness I can't articulate.", theme_category: "relationship_loss", has_resolution: true, resolution_text: "I had to grieve the friendship I thought I had separately from the person. Once I stopped expecting reciprocity from that specific person, I could actually see the people who do show up for me. They were there all along.", similarity_score: 0.85 },
  { message_id: "t11", humanised_text: "I look at old photos of myself and feel a deep sadness for how harshly I judged that person. I was so much kinder to everyone else than I was to myself, and I'm still doing it.", theme_category: "self_worth", has_resolution: false, similarity_score: 0.62 },
  { message_id: "t12", humanised_text: "I've been told I'm too sensitive my whole life and I've started to believe it. But what if I'm not too much — what if the people around me are just not enough?", theme_category: "self_worth", has_resolution: true, resolution_text: "Finding one person who appreciated my sensitivity instead of tolerating it changed everything. You don't need everyone to understand you. You need the right ones.", similarity_score: 0.93 },
];
const SEED_MATCH_COUNT = 847;

const DEMO_THEME_RESOLUTION_SUMMARIES: Record<string, ThemeCountSummary> = {
  work_stress: { theme: "work_stress", count: 847, resolution_count: 186, resolution_rate: 22 },
  anxiety: { theme: "anxiety", count: 634, resolution_count: 120, resolution_rate: 19 },
  loneliness: { theme: "loneliness", count: 521, resolution_count: 99, resolution_rate: 19 },
  relationship_conflict: {
    theme: "relationship_conflict",
    count: 478,
    resolution_count: 101,
    resolution_rate: 21,
  },
  relationship_loss: {
    theme: "relationship_loss",
    count: 478,
    resolution_count: 101,
    resolution_rate: 21,
  },
  self_worth: { theme: "self_worth", count: 392, resolution_count: 94, resolution_rate: 24 },
  grief: { theme: "grief", count: 287, resolution_count: 49, resolution_rate: 17 },
  family_pressure: {
    theme: "family_pressure",
    count: 253,
    resolution_count: 56,
    resolution_rate: 22,
  },
  burnout: { theme: "burnout", count: 219, resolution_count: 39, resolution_rate: 18 },
  fear_of_failure: {
    theme: "fear_of_failure",
    count: 184,
    resolution_count: 35,
    resolution_rate: 19,
  },
  social_anxiety: {
    theme: "social_anxiety",
    count: 161,
    resolution_count: 37,
    resolution_rate: 23,
  },
  comparison: { theme: "comparison", count: 184, resolution_count: 35, resolution_rate: 19 },
  professional_worth: {
    theme: "professional_worth",
    count: 847,
    resolution_count: 186,
    resolution_rate: 22,
  },
};

function getDemoThemeResolutionSummary(theme: string): ThemeCountSummary {
  return (
    DEMO_THEME_RESOLUTION_SUMMARIES[theme] ?? {
      theme,
      count: SEED_MATCH_COUNT,
      resolution_count: 186,
      resolution_rate: 22,
    }
  );
}

/** Extra thoughts cycled in during live demo when the backend is unavailable. */
const LIVE_DEMO_POOL: ThoughtResponse[] = [
  { message_id: "live-1", humanised_text: "I keep waiting to feel ready for the next step and I'm starting to wonder if that feeling ever actually comes, or if readiness is something you decide rather than something that arrives.", theme_category: "self_worth", has_resolution: false },
  { message_id: "live-2", humanised_text: "Every time I try to explain how I'm feeling to someone close to me, the words come out wrong and I end up reassuring them instead of the other way around.", theme_category: "relationship_loss", has_resolution: true, resolution_text: "I started writing it down first. Not to send — just to get the words right. When I finally said it out loud, I actually meant it." },
  { message_id: "live-3", humanised_text: "I've been carrying something heavy for so long that I've started to mistake the weight for just being who I am. I don't know what I'd feel like without it.", theme_category: "self_worth", has_resolution: false },
  { message_id: "live-4", humanised_text: "There are whole parts of my day that I perform for other people — how I look, how I sound, how okay I seem. I'm exhausted by the performance and I can't figure out how to stop.", theme_category: "self_worth", has_resolution: true, resolution_text: "Therapy helped me name it. Once I could see the performance clearly, I started choosing one small moment each day to just… not perform. It gets easier." },
  { message_id: "live-5", humanised_text: "I said yes to something I didn't want to do and now I'm trapped in a version of my life that belongs to someone else's expectations.", theme_category: "family_pressure", has_resolution: false },
];

/** Demo thoughts per theme when API returns no data (e.g. unseeded Elasticsearch). */
const DEMO_TOPIC_THOUGHTS: Record<string, ThoughtResponse[]> = {
  loneliness: [
    { message_id: "d-l1", humanised_text: "I moved to a new city and I'm surrounded by strangers. The loneliness is heavier than I expected. I smile through the day and fall apart at night.", theme_category: "loneliness", has_resolution: false, similarity_score: 0.81 },
    { message_id: "d-l2", humanised_text: "I helped someone through the hardest time of their life and when I needed the same they weren't there. The imbalance in who I am for others versus who they are for me is a loneliness I can't articulate.", theme_category: "loneliness", has_resolution: true, resolution_text: "I had to grieve the friendship I thought I had. Once I stopped expecting reciprocity from that person, I could see the people who do show up for me.", similarity_score: 0.87 },
    { message_id: "d-l3", humanised_text: "I've been feeling disconnected from everyone around me. Like I'm watching life through a window.", theme_category: "loneliness", has_resolution: false, similarity_score: 0.64 },
  ],
  work_stress: [
    { message_id: "d-w1", humanised_text: "I feel invisible at work. I contribute ideas and effort but nobody notices. The recognition always goes to someone louder.", theme_category: "work_stress", has_resolution: false, similarity_score: 0.76 },
    { message_id: "d-w2", humanised_text: "I'm exhausted before the day even starts. The pressure to perform is constant.", theme_category: "work_stress", has_resolution: false, similarity_score: 0.59 },
  ],
  anxiety: SEED_THOUGHTS.filter((t) => t.theme_category === "self_worth").slice(0, 4),
  self_worth: SEED_THOUGHTS.filter((t) => t.theme_category === "self_worth"),
  relationship_loss: SEED_THOUGHTS.filter((t) => t.theme_category === "relationship_loss"),
  family_pressure: SEED_THOUGHTS.filter((t) => t.theme_category === "family_pressure"),
  comparison: SEED_THOUGHTS.filter((t) => t.theme_category === "comparison"),
  grief: [
    { message_id: "d-g1", humanised_text: "I'm still carrying a loss that nobody talks about anymore. It feels like everyone has moved on except me.", theme_category: "grief", has_resolution: false, similarity_score: 0.68 },
  ],
  burnout: [
    { message_id: "d-b1", humanised_text: "I used to love what I do. Now I'm running on empty and can't remember the last time I felt rested.", theme_category: "burnout", has_resolution: false, similarity_score: 0.71 },
  ],
  fear_of_failure: [
    { message_id: "d-f1", humanised_text: "I'm terrified of not measuring up. Every decision feels like it could be the wrong one.", theme_category: "fear_of_failure", has_resolution: false, similarity_score: 0.74 },
  ],
  social_anxiety: [
    { message_id: "d-s1", humanised_text: "I lie awake replaying every awkward thing I've said. I convince myself everyone remembers those moments as vividly as I do.", theme_category: "social_anxiety", has_resolution: true, resolution_text: "Asking a friend if they remembered a moment I'd been agonizing over for years — they had no idea what I was talking about. That did more than months of overthinking.", similarity_score: 0.89 },
  ],
  relationship_conflict: SEED_THOUGHTS.filter((t) => t.theme_category === "relationship_loss"),
  professional_worth: SEED_THOUGHTS.filter((t) => t.theme_category === "professional_worth"),
};

/**
 * Ensures the demo Future You seed letter exists in localStorage.
 * Only writes if no letter for the seed theme already exists,
 * so user-written letters are never overwritten.
 */
async function seedDemoFutureLetter() {
  const existing = await getFutureLettersForTheme(DEMO_FUTURE_LETTER.theme_category);
  if (existing.length === 0) {
    await saveFutureLetter(
      DEMO_FUTURE_LETTER.message_id,
      DEMO_FUTURE_LETTER.theme_category,
      DEMO_FUTURE_LETTER.letter_text
    );
  }
}

async function hapticTap() {
  if (Capacitor.isNativePlatform()) {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  }
}

export default function EchoApp() {
  const deviceType = useDeviceType();
  const isDesktop = deviceType === "desktop";

  const [screen, setScreen] = useState<AppScreen>("onboarding");
  const [inputOpen, setInputOpen] = useState(false);
  const [thoughtText, setThoughtText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [bottomSheetThought, setBottomSheetThought] =
    useState<ThoughtResponse | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => getNotificationOptIn());
  const [promptThought, setPromptThought] = useState<LocalThought | null>(null);

  const [matchCount, setMatchCount] = useState(0);
  const [liveMatchCount, setLiveMatchCount] = useState(0);
  const [similarThoughts, setSimilarThoughts] = useState<ThoughtResponse[]>([]);
  const [newThoughtIds, setNewThoughtIds] = useState<Set<string>>(new Set());
  const [cardsVisible, setCardsVisible] = useState(0);
  const [countAnimDone, setCountAnimDone] = useState(false);

  const seenThoughtIdsRef = useRef<Set<string>>(new Set());
  const demoLivePoolRef = useRef<ThoughtResponse[]>([...LIVE_DEMO_POOL]);
  const resultsScrollRef = useRef<HTMLDivElement>(null);

  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  const [searchAfterCursor, setSearchAfterCursor] = useState<string[] | undefined>(undefined);
  const [hasMoreThoughts, setHasMoreThoughts] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("user@example.com");
  const [isAdmin, setIsAdmin] = useState(false);

  const [thoughtHistory, setThoughtHistory] = useState<LocalThought[]>([]);
  const [presenceLevel, setPresenceLevel] = useState<PresenceLevel>(0);
  const [presenceCount, setPresenceCount] = useState(0);
  const [presenceDataMode, setPresenceDataMode] = useState<"live" | "demo">("live");
  const [currentThemeCategory, setCurrentThemeCategory] = useState<string | null>(null);
  const [futureLetterMatch, setFutureLetterMatch] = useState<FutureLetter | null>(null);
  const [quietWin, setQuietWin] = useState<QuietWin | null>(null);
  const [recurrencePattern, setRecurrencePattern] =
    useState<RecurrencePattern | null>(null);
  const [themeResolutionStats, setThemeResolutionStats] =
    useState<ThemeCountSummary | null>(null);
  const [resultsDataMode, setResultsDataMode] = useState<"live" | "demo" | null>(null);
  const [savedAnchors, setSavedAnchors] = useState<SavedAnchor[]>([]);
  const [savedAnchorIds, setSavedAnchorIds] = useState<Set<string>>(new Set());

  const [topicTheme, setTopicTheme] = useState<{ themeKey: string; label: string } | null>(null);
  const [topicSeedMessageId, setTopicSeedMessageId] = useState<string | null>(null);
  const [topicThoughts, setTopicThoughts] = useState<ThoughtResponse[]>([]);
  const [topicTotal, setTopicTotal] = useState(0);
  const [topicSearchAfter, setTopicSearchAfter] = useState<string[] | undefined>(undefined);
  const [topicHasMore, setTopicHasMore] = useState(false);
  const [topicLoading, setTopicLoading] = useState(false);
  const [topicDataMode, setTopicDataMode] = useState<"live" | "demo">("live");
  const [topicCardsVisible, setTopicCardsVisible] = useState(0);
  const [adviceFirstOnly, setAdviceFirstOnly] = useState(false);

  const refreshSavedAnchorIds = useCallback(() => {
    getAllSavedAnchors().then((anchors) => {
      setSavedAnchorIds(new Set(anchors.map((anchor) => anchor.message_id)));
    });
  }, []);

  useEffect(() => {
    const hasOnboarded = hasCompletedOnboarding();
    const hasToken = getJwt();

    if (!hasOnboarded) {
      setScreen("onboarding");
    } else if (!hasToken) {
      setScreen("auth");
    } else {
      setIsAdmin(getAdminStatus());
      setScreen("home");
    }

    getThoughtHistory().then(setThoughtHistory);
    refreshSavedAnchorIds();
  }, [refreshSavedAnchorIds]);

  /* Capacitor native platform setup (Android back button, status bar) */
  const screenRef = useRef(screen);
  screenRef.current = screen;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanup: (() => void) | undefined;

    (async () => {
      const { App: CapApp } = await import("@capacitor/app");
      const { StatusBar, Style } = await import("@capacitor/status-bar");

      StatusBar.setStyle({ style: Style.Light });
      StatusBar.setBackgroundColor({ color: "#FAF7F2" });

      const listener = await CapApp.addListener("backButton", () => {
        if (screenRef.current !== "home") {
          setScreen("home");
        } else {
          CapApp.minimizeApp();
        }
      });

      cleanup = () => listener.remove();
    })();

    return () => cleanup?.();
  }, []);

  /* Fetch aggregate theme counts for "Breathing With Others" */
  useEffect(() => {
    if (screen !== "home") return;

    async function fetchPresence() {
      const recentTheme = await getMostRecentTheme();
      try {
        const aggregateResult = await getThemeAggregates();
        const aggregates = aggregateResult.items;
        setPresenceDataMode(aggregateResult.isDemo ? "demo" : "live");
        const match = recentTheme
          ? aggregates.find((a) => a.theme === recentTheme)
          : aggregates[0];
        if (match) {
          setPresenceCount(match.count);
          setPresenceLevel(presenceLevelFromCount(match.count));
        }
      } catch {
        /* Demo fallback: simulate presence based on seed data */
        const demoCount = 127 + Math.floor(Math.random() * 400);
        setPresenceDataMode("demo");
        setPresenceCount(demoCount);
        setPresenceLevel(presenceLevelFromCount(demoCount));
      }
    }

    fetchPresence();
  }, [screen]);

  /* Check for delayed prompt candidates when the home screen loads */
  useEffect(() => {
    if (screen !== "home") return;
    if (!notificationsEnabled) return;

    getNextPromptCandidate().then((candidate) => {
      if (candidate) {
        setPromptThought(candidate);
        setLastPromptDate(Date.now());
      }
    });
  }, [screen, notificationsEnabled]);

  /* Poll for live count + new cards while the results screen is open */
  useEffect(() => {
    if (screen !== "results" || !currentThemeCategory) return;

    /** Prepend unseen thoughts to the card list. Returns true if any were added. */
    const injectNewCards = (incoming: ThoughtResponse[]): boolean => {
      const fresh = incoming.filter(
        (t) => !seenThoughtIdsRef.current.has(t.message_id)
      );
      if (fresh.length === 0) return false;
      fresh.forEach((t) => seenThoughtIdsRef.current.add(t.message_id));
      const freshIds = new Set(fresh.map((t) => t.message_id));
      setSimilarThoughts((prev: ThoughtResponse[]) => [...fresh, ...prev]);
      setCardsVisible((prev: number) => prev + fresh.length);
      setNewThoughtIds(freshIds);
      setTimeout(() => setNewThoughtIds(new Set()), 5000);
      return true;
    };

    const injectFromDemoPool = () => {
      const next = demoLivePoolRef.current.shift();
      if (next) injectNewCards([next]);
    };

    const poll = async () => {
      // 1. Update live count — always increment so the demo always feels live
      try {
        const result = await getThemeCount(currentThemeCategory);
        setThemeResolutionStats(result);
        setResultsDataMode(result.isDemo ? "demo" : "live");
        setLiveMatchCount((prev: number) =>
          result.count > prev ? result.count : prev + Math.floor(Math.random() * 3) + 1
        );
      } catch {
        setThemeResolutionStats((prev) =>
          prev ?? getDemoThemeResolutionSummary(currentThemeCategory)
        );
        setResultsDataMode("demo");
        setLiveMatchCount((prev: number) => prev + Math.floor(Math.random() * 3) + 1);
      }

      // 2. Fetch new cards from API; if nothing new, fall back to demo pool
      if (currentMessageId) {
        try {
          const result = await getSimilarThoughts(currentMessageId);
          const added = injectNewCards(result.thoughts);
          if (!added) injectFromDemoPool();
        } catch {
          injectFromDemoPool();
        }
      } else {
        injectFromDemoPool();
      }
    };

    const id = setInterval(poll, 15_000);
    return () => clearInterval(id);
  }, [screen, currentThemeCategory, currentMessageId]);

  const refreshHistory = useCallback(() => {
    getThoughtHistory().then(setThoughtHistory);
  }, []);

  useEffect(() => {
    if (!countAnimDone || similarThoughts.length === 0) return;

    const timers: NodeJS.Timeout[] = [];
    for (let i = 0; i < similarThoughts.length; i++) {
      timers.push(
        setTimeout(
          () => setCardsVisible((v) => v + 1),
          CARD_STAGGER_DELAY_MS * i
        )
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [countAnimDone, similarThoughts.length]);

  const handleUnauthorized = useCallback(() => {
    clearKey();
    clearAllData();
    setRecurrencePattern(null);
    setThemeResolutionStats(null);
    setResultsDataMode(null);
    setSavedAnchors([]);
    setSavedAnchorIds(new Set());
    setAuthError("Your session has expired. Please sign in again.");
    setScreen("auth");
  }, []);

  const handleSubmitThought = useCallback(async () => {
    if (!thoughtText.trim()) return;

    hapticTap();
    const rawText = thoughtText;
    setInputOpen(false);
    setScreen("processing");

    const processingStart = Date.now();
    const priorThoughts = thoughtHistory.map(({ theme_category, timestamp }) => ({
      theme_category,
      timestamp,
    }));

    const showResults = async (
      themeCategory: string,
      initialCount: number,
      initialThoughts: ThoughtResponse[],
      initialMode: "live" | "demo"
    ) => {
      setCurrentThemeCategory(themeCategory);
      setQuietWin(findQuietWin(priorThoughts, themeCategory));
      setRecurrencePattern(findRecurrencePattern(priorThoughts, themeCategory));
      setLiveMatchCount(initialCount);
      setResultsDataMode(initialMode);
      setNewThoughtIds(new Set());
      seenThoughtIdsRef.current = new Set(initialThoughts.map((t) => t.message_id));
      demoLivePoolRef.current = [...LIVE_DEMO_POOL];

      const [lettersResult, anchorsResult, statsResult] = await Promise.allSettled([
        getFutureLettersForTheme(themeCategory),
        getSavedAnchorsForTheme(themeCategory),
        getThemeCount(themeCategory),
      ]);
      setFutureLetterMatch(
        lettersResult.status === "fulfilled" && lettersResult.value.length > 0
          ? lettersResult.value[0]
          : null
      );
      setSavedAnchors(
        anchorsResult.status === "fulfilled" ? anchorsResult.value : []
      );
      if (statsResult.status === "fulfilled") {
        setThemeResolutionStats(statsResult.value);
        setResultsDataMode(statsResult.value.isDemo ? "demo" : initialMode);
      } else {
        setThemeResolutionStats(getDemoThemeResolutionSummary(themeCategory));
        setResultsDataMode("demo");
      }
      refreshSavedAnchorIds();

      setCardsVisible(0);
      setCountAnimDone(false);
      setScreen("results");
    };

    try {
      const result = await submitThought(rawText);
      await saveThought(result.message_id, rawText, result.theme_category, result.match_count);
      setMatchCount(result.match_count);
      setSimilarThoughts(result.similar_thoughts);
      setCurrentMessageId(result.message_id);
      setSearchAfterCursor(result.search_after);
      setHasMoreThoughts(result.search_after != null);

      const elapsed = Date.now() - processingStart;
      const remainingDelay = Math.max(0, PROCESSING_MIN_DURATION_MS - elapsed);

      setTimeout(() => showResults(result.theme_category, result.match_count, result.similar_thoughts, "live"), remainingDelay);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleUnauthorized();
        return;
      }
      if (err instanceof ApiError && err.status === 422) {
        setScreen("home");
        setInputOpen(true);
        return;
      }
      // Server/network errors — fall back to demo data so the demo still works
      const demoId = "demo-" + Date.now();
      const demoTheme = inferThemeFromText(rawText, "self_worth");
      await saveThought(demoId, rawText, demoTheme, SEED_MATCH_COUNT);
      setMatchCount(SEED_MATCH_COUNT);
      setSimilarThoughts(SEED_THOUGHTS);
      setCurrentMessageId(demoId);
      setSearchAfterCursor(undefined);
      setHasMoreThoughts(false);

      await seedDemoFutureLetter();

      const elapsed = Date.now() - processingStart;
      const remainingDelay = Math.max(0, PROCESSING_MIN_DURATION_MS - elapsed);

      setTimeout(() => showResults(demoTheme, SEED_MATCH_COUNT, SEED_THOUGHTS, "demo"), remainingDelay);
    }

    setThoughtText("");
    refreshHistory();
  }, [thoughtText, thoughtHistory, refreshHistory, handleUnauthorized, refreshSavedAnchorIds]);

  const loadMoreThoughts = useCallback(async () => {
    if (!currentMessageId || isLoadingMore || !hasMoreThoughts) return;

    setIsLoadingMore(true);
    try {
      const result = await getSimilarThoughts(currentMessageId, searchAfterCursor);
      setSimilarThoughts((prev) => [...prev, ...result.thoughts]);
      setSearchAfterCursor(result.search_after);
      setHasMoreThoughts(result.search_after != null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleUnauthorized();
      }
      /* Keep existing thoughts on other errors */
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentMessageId, isLoadingMore, hasMoreThoughts, searchAfterCursor, handleUnauthorized]);

  const handleCardTap = useCallback(async (thought: ThoughtResponse) => {
    if (thought.has_resolution && !thought.resolution_text) {
      try {
        const resolution = await getResolution(thought.message_id);
        setBottomSheetThought({ ...thought, resolution_text: resolution?.resolution_text });
      } catch {
        setBottomSheetThought(thought);
      }
    } else {
      setBottomSheetThought(thought);
    }
  }, []);

  const handleSaveAnchor = useCallback(
    async (thought: ThoughtResponse) => {
      if (!thought.resolution_text) return;

      await saveAnchor({
        message_id: thought.message_id,
        theme_category: thought.theme_category,
        humanised_text: thought.humanised_text,
        resolution_text: thought.resolution_text,
      });

      refreshSavedAnchorIds();

      if (thought.theme_category === currentThemeCategory) {
        const anchors = await getSavedAnchorsForTheme(thought.theme_category);
        setSavedAnchors(anchors);
      }
    },
    [currentThemeCategory, refreshSavedAnchorIds]
  );

  const handleAuth = useCallback(
    async (email: string, password: string, mode: "login" | "signup") => {
      setAuthLoading(true);
      setAuthError(null);

      try {
        const authFn = mode === "login" ? login : register;
        const result = await authFn({ email, password });
        saveJwt(result.access_token);
        await initializeKey(password, email);
        setUserEmail(email);
        const admin = result.is_admin ?? false;
        saveAdminStatus(admin);
        setIsAdmin(admin);
        refreshHistory();
        refreshSavedAnchorIds();
        setScreen("home");
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 422) {
            setAuthError("Please check your email and password format.");
          } else if (err.status === 401 || err.status === 400) {
            setAuthError("Invalid email or password.");
          } else if (err.status === 409) {
            setAuthError("An account with this email already exists.");
          } else {
            setAuthError("Something went wrong. Please try again.");
          }
        } else {
          setAuthError("Could not connect to the server. Please try again.");
        }
      } finally {
        setAuthLoading(false);
      }
    },
    [refreshHistory, refreshSavedAnchorIds]
  );

  const handleOnboardingComplete = useCallback(() => {
    markOnboardingComplete();
    setScreen("auth");
  }, []);

  const handleResolve = useCallback(
    async (messageId: string, resolutionText: string) => {
      await resolveThoughtLocal(messageId, resolutionText);
      try {
        await submitResolution({
          message_id: messageId,
          resolution_text: resolutionText,
        });
      } catch {
        /* saved locally */
      }
      refreshHistory();
    },
    [refreshHistory]
  );

  const handleSaveFutureLetter = useCallback(
    async (messageId: string, themeCategory: string, text: string) => {
      await saveFutureLetter(messageId, themeCategory, text);
      refreshHistory();
    },
    [refreshHistory]
  );

  const handleDeleteAccount = useCallback(async () => {
    try {
      await deleteAccount();
    } catch {
      /* clear local regardless */
    }
    clearKey();
    clearAllData();
    setRecurrencePattern(null);
    setThemeResolutionStats(null);
    setResultsDataMode(null);
    setSavedAnchors([]);
    setSavedAnchorIds(new Set());
    setScreen("auth");
  }, []);

  const handleNavigate = useCallback((target: AppScreen) => {
    setScreen(target);
  }, []);

  const handleBackToHome = useCallback(() => {
    setScreen("home");
  }, []);

  const loadTopicThoughts = useCallback(
    async (themeKey: string, seedMessageId: string | null, searchAfter?: string[]) => {
      setTopicLoading(true);
      try {
        let messageId = seedMessageId;
        if (!messageId && !searchAfter) {
          const seed = await getSeedForTheme(themeKey);
          if (!seed) {
            try {
              const byTheme = await getThoughtsByTheme(themeKey);
              if (byTheme.thoughts.length > 0) {
                setTopicDataMode("live");
                setTopicThoughts(byTheme.thoughts);
                setTopicTotal(byTheme.total);
                setTopicSearchAfter(byTheme.search_after ?? undefined);
                setTopicHasMore(byTheme.search_after != null);
                setTopicCardsVisible(byTheme.thoughts.length);
                return;
              }
            } catch {
              /* fall through to demo */
            }
            const demo = DEMO_TOPIC_THOUGHTS[themeKey] ?? [];
            setTopicDataMode("demo");
            setTopicThoughts(demo);
            setTopicTotal(demo.length);
            setTopicHasMore(false);
            setTopicCardsVisible(demo.length);
            return;
          }
          messageId = seed.message_id;
          setTopicSeedMessageId(messageId);
        }
        if (!messageId) {
          setTopicThoughts([]);
          setTopicTotal(0);
          setTopicHasMore(false);
          return;
        }
        const result = await getSimilarThoughts(messageId, searchAfter);
        if (result.thoughts.length === 0 && !searchAfter) {
          try {
            const byTheme = await getThoughtsByTheme(themeKey);
            if (byTheme.thoughts.length > 0) {
              setTopicDataMode("live");
              setTopicThoughts(byTheme.thoughts);
              setTopicTotal(byTheme.total);
              setTopicSearchAfter(byTheme.search_after ?? undefined);
              setTopicHasMore(byTheme.search_after != null);
              setTopicCardsVisible(byTheme.thoughts.length);
              return;
            }
          } catch {
            /* fall through to demo */
          }
          const demo = DEMO_TOPIC_THOUGHTS[themeKey] ?? [];
          setTopicDataMode("demo");
          setTopicThoughts(demo);
          setTopicTotal(demo.length);
          setTopicHasMore(false);
          setTopicCardsVisible(demo.length);
          return;
        }
        setTopicDataMode("live");
        setTopicThoughts((prev) =>
          searchAfter ? [...prev, ...result.thoughts] : result.thoughts
        );
        setTopicTotal(result.total);
        setTopicSearchAfter(result.search_after ?? undefined);
        setTopicHasMore(result.search_after != null);
        setTopicCardsVisible((prev) =>
          searchAfter ? prev + result.thoughts.length : result.thoughts.length
        );
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          handleUnauthorized();
          return;
        }
        const demo = DEMO_TOPIC_THOUGHTS[themeKey] ?? [];
        setTopicDataMode("demo");
        setTopicThoughts(demo);
        setTopicTotal(demo.length);
        setTopicHasMore(false);
        setTopicCardsVisible(demo.length);
      } finally {
        setTopicLoading(false);
      }
    },
    [handleUnauthorized]
  );

  const handleTopicOpen = useCallback(
    (themeKey: string) => {
      hapticTap();
      const label = THEME_DISPLAY_LABELS[themeKey] ?? themeKey.replace(/_/g, " ");
      setTopicTheme({ themeKey, label });
      setTopicSeedMessageId(null);
      setTopicThoughts([]);
      setTopicTotal(0);
      setTopicSearchAfter(undefined);
      setTopicHasMore(false);
      setTopicDataMode("live");
      setTopicCardsVisible(0);
      setScreen("topic");
      loadTopicThoughts(themeKey, null);
    },
    [loadTopicThoughts]
  );

  const handlePromptDismiss = useCallback(() => {
    setPromptThought(null);
  }, []);

  const handlePromptResolve = useCallback(
    (messageId: string, resolutionText: string) => {
      setPromptThought(null);
      handleResolve(messageId, resolutionText);
    },
    [handleResolve]
  );

  const visibleResultThoughts = adviceFirstOnly
    ? similarThoughts.filter((thought) => thought.has_resolution)
    : similarThoughts;

  const hasSupportSection =
    countAnimDone &&
    ((currentThemeCategory != null && RISK_THEMES.has(currentThemeCategory)) ||
      (themeResolutionStats?.resolution_count ?? 0) > 0 ||
      quietWin != null ||
      recurrencePattern != null ||
      savedAnchors.length > 0 ||
      futureLetterMatch != null);

  const isMainScreen = screen === "home" || screen === "results" || screen === "topic";
  const PANEL_SCREENS: AppScreen[] = ["thoughts", "trends", "account", "about", "privacy", "admin"];
  const isPanel = PANEL_SCREENS.includes(screen);

  const PANEL_TRANSITION = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };
  const PANEL_VARIANTS = {
    initial: { x: "100%" },
    animate: { x: 0 },
    exit: { x: "100%" },
  };

  /* ── Shared content renderer ── */
  const renderContent = () => (
    <>
      {/* ── Full-screen non-panel flows ── */}
      {screen === "onboarding" && (
        <OnboardingScreen
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingComplete}
        />
      )}

      {screen === "auth" && (
        <AuthScreen
          onAuth={handleAuth}
          isLoading={authLoading}
          error={authError}
        />
      )}

      {screen === "processing" && <ProcessingScreen />}

      {screen === "topic" && topicTheme && (
        <div className="echo-scroll-area flex-1 flex min-h-0 flex-col overflow-y-auto overflow-x-hidden">
          <div
            className="mx-auto w-full max-w-xl flex-1 px-4 min-h-0"
            style={{ paddingBottom: "max(2rem, calc(env(safe-area-inset-bottom) + 1.5rem))" }}
          >
            <div
              className="flex items-center gap-3 pt-2 pb-4"
              style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
            >
              <button
                onClick={handleBackToHome}
                className="flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-echo-text-soft transition-colors hover:bg-black/5 active:bg-black/10 touch-manipulation -ml-1"
                aria-label="Back to home"
              >
                <ChevronLeft size={22} />
              </button>
              <h1 className="text-base font-light tracking-wide text-echo-text sm:text-lg">
                Others on {topicTheme.label}
              </h1>
            </div>
            <div className="mb-3">
              <DataModeBadge
                mode={topicDataMode}
                liveLabel="Live topic"
                demoLabel="Demo topic"
                testId="topic-data-mode"
              />
            </div>
            {topicTotal > 0 && (
              <p className="mb-4 text-[13px] font-light text-echo-text-muted">
                {topicTotal} {topicTotal === 1 ? "thought" : "thoughts"} in this space
              </p>
            )}
            {!topicLoading && topicThoughts.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-[14px] font-light text-echo-text-soft">
                  No thoughts in this space yet.
                </p>
              </div>
            )}
            <ThoughtCardList
              thoughts={topicThoughts}
              visibleCount={topicCardsVisible}
              onCardTap={handleCardTap}
              onLoadMore={() =>
                topicTheme &&
                loadTopicThoughts(
                  topicTheme.themeKey,
                  topicSeedMessageId,
                  topicSearchAfter
                )
              }
              hasMore={topicHasMore}
              isLoadingMore={topicLoading}
            />
          </div>
        </div>
      )}

      {screen === "results" && (
        <div className="echo-scroll-area flex-1 overflow-y-auto overflow-x-hidden" ref={resultsScrollRef}>
          {/* New-thoughts toast — sticky at top, slides in when live cards arrive */}
          <AnimatePresence>
            {newThoughtIds.size > 0 && (
              <motion.div
                className="sticky top-3 z-20 flex justify-center px-4 pointer-events-none"
                initial={{ y: -48, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -48, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <button
                  className="pointer-events-auto flex items-center gap-2 rounded-full bg-echo-text px-4 py-2.5 shadow-[0_4px_20px_rgba(44,40,37,0.18)] active:scale-[0.96]"
                  onClick={() => resultsScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-echo-accent animate-pulse" />
                  <span className="text-[13px] font-light text-echo-bg">
                    {newThoughtIds.size === 1
                      ? "1 new person just shared this feeling"
                      : `${newThoughtIds.size} new people just shared this feeling`}
                  </span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mx-auto max-w-xl">
            <CountReveal
              targetCount={matchCount}
              liveCount={liveMatchCount}
              onAnimationComplete={() => setCountAnimDone(true)}
            />

            {countAnimDone && resultsDataMode && (
              <div className="mb-3 px-4">
                <DataModeBadge
                  mode={resultsDataMode}
                  liveLabel="Live results"
                  demoLabel="Demo results"
                  testId="results-data-mode"
                />
              </div>
            )}

            {hasSupportSection && (
              <div className="mb-3 px-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-echo-text-muted">
                  For you right now
                </p>
              </div>
            )}

            {/* Guardrails of Care — safety resources for risk themes */}
            {countAnimDone && currentThemeCategory && (
              <SafetyBanner themeCategory={currentThemeCategory} />
            )}

            {countAnimDone &&
              currentThemeCategory &&
              themeResolutionStats &&
              themeResolutionStats.resolution_count > 0 && (
                <ThemeResolutionAggregateBanner
                  stats={themeResolutionStats}
                  themeLabel={
                    THEME_DISPLAY_LABELS[currentThemeCategory] ??
                    currentThemeCategory.replace(/_/g, " ")
                  }
                />
              )}

            {/* Quiet wins — local reflection when a recurring theme stayed quiet for a while */}
            {countAnimDone && quietWin && (
              <QuietWinBanner quietWin={quietWin} />
            )}

            {/* Recurrence pattern — local signal when the same theme keeps returning recently */}
            {countAnimDone && recurrencePattern && (
              <RecurrencePatternBanner pattern={recurrencePattern} />
            )}

            {/* Saved anchors — advice lines the user chose to keep for this theme */}
            {countAnimDone && currentThemeCategory && savedAnchors.length > 0 && (
              <SavedAnchorsBanner
                anchors={savedAnchors}
                themeLabel={
                  THEME_DISPLAY_LABELS[currentThemeCategory] ??
                  currentThemeCategory.replace(/_/g, " ")
                }
              />
            )}

            {/* Future You — letter from past self on matching theme */}
            {countAnimDone && futureLetterMatch && (
              <FutureYouBanner letter={futureLetterMatch} />
            )}

            {/* Advice-first toggle — filter to cards with resolutions */}
            {countAnimDone && (
              <div className="mb-3 px-4">
                <div className="rounded-[18px] bg-white p-4 shadow-[0_1px_12px_rgba(44,40,37,0.05)]">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[14px] font-normal text-echo-text">
                      Show only what helped
                    </span>
                    <button
                      onClick={() => setAdviceFirstOnly((v) => !v)}
                      className={`relative h-[28px] w-[52px] shrink-0 rounded-full border-0 transition-colors duration-200 ease-out touch-manipulation ${
                        adviceFirstOnly
                          ? "bg-echo-accent shadow-[0_0_0_2px_rgba(200,133,108,0.25)]"
                          : "bg-echo-text-muted/30"
                      }`}
                      role="switch"
                      aria-checked={adviceFirstOnly}
                      aria-label="Show only cards with what helped"
                    >
                      <span
                        className={`absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_6px_rgba(44,40,37,0.15)] transition-all duration-200 ease-out ${
                          adviceFirstOnly ? "left-[22px]" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {countAnimDone && adviceFirstOnly && visibleResultThoughts.length === 0 && (
              <div className="mb-4 px-4">
                <div className="rounded-[18px] bg-white p-4 shadow-[0_1px_12px_rgba(44,40,37,0.05)]">
                  <p className="text-[14px] font-normal text-echo-text">
                    No one in this space has shared what helped yet.
                  </p>
                  <p className="mt-1.5 text-[12.5px] font-light leading-relaxed text-echo-text-muted">
                    You can switch the filter off to read nearby thoughts, or keep checking back as more people share.
                  </p>
                </div>
              </div>
            )}

            {countAnimDone && visibleResultThoughts.length > 0 && (
              <ThoughtCardList
                thoughts={visibleResultThoughts}
                visibleCount={cardsVisible}
                newThoughtIds={newThoughtIds}
                onCardTap={handleCardTap}
                onLoadMore={loadMoreThoughts}
                hasMore={hasMoreThoughts}
                isLoadingMore={isLoadingMore}
              />
            )}
            {countAnimDone && (() => {
              const displayedThoughts = adviceFirstOnly ? similarThoughts.filter((t) => t.has_resolution) : similarThoughts;
              return (
                <>
                  {displayedThoughts.length === 0 && (
                    <div className="px-4 py-10 text-center">
                      <p className="text-[14px] font-light text-echo-text-soft">
                        {adviceFirstOnly
                          ? "No one has shared what helped yet in this set. Turn off the filter to see all thoughts."
                          : "No similar thoughts yet."}
                      </p>
                    </div>
                  )}
                  <ThoughtCardList
                    thoughts={displayedThoughts}
                    visibleCount={cardsVisible}
                    newThoughtIds={newThoughtIds}
                    onCardTap={handleCardTap}
                    onLoadMore={loadMoreThoughts}
                    hasMore={hasMoreThoughts}
                    isLoadingMore={isLoadingMore}
                  />
                </>
              );
            })()}
          </div>

          {/* FAB to return home */}
          <div className="pointer-events-none sticky bottom-6 z-60 flex justify-center">
            <button
              onClick={() => {
                setScreen("home");
                setThoughtText("");
              }}
              className="pointer-events-auto flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white text-echo-accent shadow-[0_3px_16px_rgba(44,40,37,0.1)] active:scale-[0.92]"
              aria-label="Return home"
            >
              <Target size={22} />
            </button>
          </div>
        </div>
      )}

      {/* ── Home — stays rendered behind panel overlays so it's visible on slide-back ── */}
      {(screen === "home" || isPanel) && (
        <motion.div
          className="relative flex flex-1 flex-col items-center justify-center"
          animate={{ scale: isPanel ? 0.97 : 1, opacity: isPanel ? 0.65 : 1 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          <SurroundingTopics animate onTopicClick={handleTopicOpen} />
          <EchoLogo
            size={isDesktop ? 200 : 150}
            animate
            presenceLevel={presenceLevel}
            onClick={() => { hapticTap(); setInputOpen(true); }}
          />
          <p className="mt-7 animate-[fadeIn_1s_ease_0.6s_both] text-[13.5px] font-light tracking-wide text-echo-text-muted">
            tap to share what&apos;s on your mind
          </p>
          {presenceCount > 0 && (
            <>
              <p
                className="mt-2.5 animate-[fadeIn_1.5s_ease_1.2s_both] text-[11.5px] font-light tracking-wide text-echo-text-muted/60"
                data-testid="presence-indicator"
              >
                {presenceCount} others breathing in this space this week
              </p>
              <div className="mt-2 animate-[fadeIn_1.8s_ease_1.35s_both]">
                <DataModeBadge
                  mode={presenceDataMode}
                  liveLabel="Live presence"
                  demoLabel="Demo estimate"
                  testId="presence-data-mode"
                />
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* ── Panel overlays — slide in from right over home ── */}
      <AnimatePresence>
        {screen === "thoughts" && (
          <motion.div
            key="thoughts"
            className="absolute inset-0 z-40 flex flex-col bg-echo-bg"
            variants={PANEL_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={PANEL_TRANSITION}
          >
            <HistoryPanel
              thoughts={thoughtHistory}
              onBack={handleBackToHome}
              onResolve={handleResolve}
              onSaveFutureLetter={handleSaveFutureLetter}
            />
          </motion.div>
        )}

        {screen === "trends" && (
          <motion.div
            key="trends"
            className="absolute inset-0 z-40 flex flex-col bg-echo-bg"
            variants={PANEL_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={PANEL_TRANSITION}
          >
            <TrendsPanel thoughts={thoughtHistory} onBack={handleBackToHome} />
          </motion.div>
        )}

        {screen === "account" && (
          <motion.div
            key="account"
            className="absolute inset-0 z-40 flex flex-col bg-echo-bg"
            variants={PANEL_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={PANEL_TRANSITION}
          >
            <AccountPanel
              email={userEmail}
              onBack={handleBackToHome}
              onDeleteAccount={handleDeleteAccount}
              onToggleNotifications={(enabled) => {
                setNotificationsEnabled(enabled);
                setNotificationOptIn(enabled);
              }}
              notificationsEnabled={notificationsEnabled}
            />
          </motion.div>
        )}

        {screen === "about" && (
          <motion.div
            key="about"
            className="absolute inset-0 z-40 flex flex-col bg-echo-bg"
            variants={PANEL_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={PANEL_TRANSITION}
          >
            <AboutPanel onBack={handleBackToHome} onNavigate={handleNavigate} />
          </motion.div>
        )}

        {screen === "privacy" && (
          <motion.div
            key="privacy"
            className="absolute inset-0 z-40 flex flex-col bg-echo-bg"
            variants={PANEL_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={PANEL_TRANSITION}
          >
            <PrivacyPanel onBack={() => handleNavigate("about")} />
          </motion.div>
        )}

        {screen === "admin" && (
          <motion.div
            key="admin"
            className="absolute inset-0 z-40 flex flex-col bg-echo-bg"
            variants={PANEL_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={PANEL_TRANSITION}
          >
            <AdminPanel onBack={handleBackToHome} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  /* ══════════════════════════════════════════════════
     Desktop layout — full width, sidebar menu
     ══════════════════════════════════════════════════ */
  if (isDesktop) {
    return (
      <div className="flex h-[100dvh] flex-col bg-echo-bg font-sans">
        {/* Top bar — full width. Always in DOM when home/panel to prevent layout shift. */}
        {(isMainScreen || isPanel) && (
          <div className={`flex items-center px-6 pt-4 pb-1 transition-opacity duration-300${isPanel ? " invisible pointer-events-none" : ""}`}>
            <HamburgerButton
              isOpen={false}
              onClick={() => setMenuOpen(true)}
            />
            <span className="mx-auto font-serif text-sm font-light tracking-[3px] text-echo-text-muted opacity-60">
              echo
            </span>
            <div className="w-10 flex justify-end" aria-hidden={!isAdmin}>
              {isAdmin && (
                <span className="rounded-full bg-echo-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-echo-accent">
                  admin
                </span>
              )}
            </div>
          </div>
        )}

        {/* Content area — full width, centered where needed */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {renderContent()}

          {/* Thought input */}
          <ThoughtInput
            isOpen={inputOpen && screen === "home"}
            value={thoughtText}
            onChange={setThoughtText}
            onSubmit={handleSubmitThought}
            onClose={() => setInputOpen(false)}
            onTopicClick={(themeKey) => {
              setInputOpen(false);
              handleTopicOpen(themeKey);
            }}
          />

          {/* Bottom sheet */}
          <BottomSheet
            thought={bottomSheetThought}
            onClose={() => setBottomSheetThought(null)}
            onSaveAnchor={handleSaveAnchor}
            isAnchorSaved={
              bottomSheetThought
                ? savedAnchorIds.has(bottomSheetThought.message_id)
                : false
            }
          />

          {/* Delayed opt-in prompt */}
          <DelayedPromptSheet
            thought={promptThought}
            onDismiss={handlePromptDismiss}
            onResolve={handlePromptResolve}
          />
        </div>

        {/* Sidebar menu — slides from left, has its own close button */}
        <AnimatePresence>
          {menuOpen && (
            <MenuOverlay
              mode="sidebar"
              isAdmin={isAdmin}
              onNavigate={(target) => {
                setMenuOpen(false);
                handleNavigate(target);
              }}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════
     Mobile layout
     ══════════════════════════════════════════════════ */
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-echo-bg font-sans">
      <div className="relative flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-echo-bg">
        {/* Grain texture */}
        <div
          className="pointer-events-none absolute inset-0 z-[150]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Top bar — always in DOM when home or panel to prevent layout shift on transition */}
        {(isMainScreen || isPanel) && (
          <div className={`flex items-center px-4 pt-3 pb-1 transition-opacity duration-300${isPanel ? " invisible pointer-events-none" : ""}`}>
            <HamburgerButton
              isOpen={menuOpen}
              onClick={() => setMenuOpen((prev) => !prev)}
            />
            <div className="flex-1" />
            {isAdmin && (
              <span className="rounded-full bg-echo-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-echo-accent">
                admin
              </span>
            )}
          </div>
        )}

        {/* Mobile fullscreen menu */}
        <AnimatePresence>
          {menuOpen && (
            <MenuOverlay
              mode="fullscreen"
              isAdmin={isAdmin}
              onNavigate={(target) => {
                setMenuOpen(false);
                handleNavigate(target);
              }}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Content */}
        {renderContent()}

        {/* Thought input */}
        <ThoughtInput
          isOpen={inputOpen && screen === "home"}
          value={thoughtText}
          onChange={setThoughtText}
          onSubmit={handleSubmitThought}
          onClose={() => setInputOpen(false)}
          onTopicClick={(themeKey) => {
            setInputOpen(false);
            handleTopicOpen(themeKey);
          }}
        />

        {/* Bottom sheet */}
        <BottomSheet
          thought={bottomSheetThought}
          onClose={() => setBottomSheetThought(null)}
          onSaveAnchor={handleSaveAnchor}
          isAnchorSaved={
            bottomSheetThought
              ? savedAnchorIds.has(bottomSheetThought.message_id)
              : false
          }
        />

        {/* Delayed opt-in prompt */}
        <DelayedPromptSheet
          thought={promptThought}
          onDismiss={handlePromptDismiss}
          onResolve={handlePromptResolve}
        />
      </div>
    </div>
  );
}
