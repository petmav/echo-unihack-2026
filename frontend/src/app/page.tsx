"use client";

import { useState, useEffect, useCallback } from "react";

import { AnimatePresence } from "framer-motion";
import { Target } from "lucide-react";

import type { AppScreen, ThoughtResponse } from "@/lib/types";
import {
  PROCESSING_MIN_DURATION_MS,
  CARD_STAGGER_DELAY_MS,
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
} from "@/lib/storage";
import {
  submitThought,
  submitResolution,
  login,
  register,
  deleteAccount,
} from "@/lib/api";
import { useDeviceType } from "@/lib/hooks";

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
import { MenuOverlay } from "@/components/echo/MenuOverlay";
import { HamburgerButton } from "@/components/echo/HamburgerButton";
import { OnboardingScreen } from "@/components/echo/OnboardingScreen";
import { AuthScreen } from "@/components/echo/AuthScreen";

/* ── Demo seed data for when backend is unavailable ── */
const SEED_THOUGHTS: ThoughtResponse[] = [
  { message_id: "t1", humanised_text: "There's this constant feeling that I'm falling behind while everyone around me seems to be moving forward effortlessly. I compare myself to others and wonder if I'll ever measure up to where I should be.", theme_category: "comparison", has_resolution: true, resolution_text: "I started writing down three things I did well each week, no matter how small. After a couple of months, I realised I was comparing my beginning to everyone else's middle. The comparison didn't stop completely but it lost its teeth." },
  { message_id: "t2", humanised_text: "I feel invisible at work. I contribute ideas and effort but it's like nobody notices. The recognition always goes to someone louder, someone more confident, and I'm left wondering if my work even matters.", theme_category: "professional_worth", has_resolution: false },
  { message_id: "t3", humanised_text: "Sometimes I lie awake replaying every awkward thing I've ever said in a conversation. The shame hits me physically and I convince myself everyone remembers those moments as vividly as I do.", theme_category: "self_worth", has_resolution: true, resolution_text: "Honestly what helped was asking a close friend if they remembered a specific moment I'd been agonizing over for years. They had absolutely no idea what I was talking about. That one conversation did more than months of overthinking." },
  { message_id: "t4", humanised_text: "I moved to a new city for an opportunity that felt right at the time but now I'm surrounded by strangers and the loneliness is heavier than I expected. I smile through the day and fall apart at night.", theme_category: "relationship_loss", has_resolution: false },
  { message_id: "t5", humanised_text: "My family expects me to follow a path I never chose. Every conversation turns into pressure about careers, relationships, timelines. I love them but I feel like I'm disappearing into their version of who I should be.", theme_category: "family_pressure", has_resolution: true, resolution_text: "I wrote a letter to my parents. Not to send — just for me. It helped me separate what I actually wanted from what I thought I was supposed to want. Then I had one honest conversation. Just one. It didn't fix everything but it cracked the door open." },
  { message_id: "t6", humanised_text: "I keep starting things with so much energy and then abandoning them halfway through. Projects, hobbies, relationships. I'm terrified that I'm fundamentally incapable of following through on anything that matters.", theme_category: "self_worth", has_resolution: false },
  { message_id: "t7", humanised_text: "There's a person in my life who makes me feel small in ways that are hard to explain to anyone else. It's not dramatic or obvious — it's subtle, constant, and I'm starting to believe the things they imply about me.", theme_category: "relationship_loss", has_resolution: true, resolution_text: "I started keeping a note on my phone of every time they said something that made me feel bad. Reading it back after a month made the pattern undeniable. It's easier to trust your own perception when you have the receipts." },
  { message_id: "t8", humanised_text: "I graduated months ago and still don't know what I'm doing. Everyone posts about their new jobs and achievements and I'm here applying to things I don't even want, wondering if the version of me that had ambitions still exists somewhere.", theme_category: "professional_worth", has_resolution: false },
  { message_id: "t9", humanised_text: "I catch myself performing happiness around people because the alternative — being honest about how I feel — sounds exhausting and risky. I'm tired of being the person who's always fine.", theme_category: "self_worth", has_resolution: false },
  { message_id: "t10", humanised_text: "I helped someone through the hardest time of their life and when I needed the same they weren't there. The imbalance in who I am for others versus who they are for me is a loneliness I can't articulate.", theme_category: "relationship_loss", has_resolution: true, resolution_text: "I had to grieve the friendship I thought I had separately from the person. Once I stopped expecting reciprocity from that specific person, I could actually see the people who do show up for me. They were there all along." },
  { message_id: "t11", humanised_text: "I look at old photos of myself and feel a deep sadness for how harshly I judged that person. I was so much kinder to everyone else than I was to myself, and I'm still doing it.", theme_category: "self_worth", has_resolution: false },
  { message_id: "t12", humanised_text: "I've been told I'm too sensitive my whole life and I've started to believe it. But what if I'm not too much — what if the people around me are just not enough?", theme_category: "self_worth", has_resolution: true, resolution_text: "Finding one person who appreciated my sensitivity instead of tolerating it changed everything. You don't need everyone to understand you. You need the right ones." },
];
const SEED_MATCH_COUNT = 847;

export default function EchoApp() {
  const deviceType = useDeviceType();
  const isDesktop = deviceType === "desktop";

  const [screen, setScreen] = useState<AppScreen>("onboarding");
  const [inputOpen, setInputOpen] = useState(false);
  const [thoughtText, setThoughtText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [bottomSheetThought, setBottomSheetThought] =
    useState<ThoughtResponse | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [matchCount, setMatchCount] = useState(0);
  const [similarThoughts, setSimilarThoughts] = useState<ThoughtResponse[]>([]);
  const [cardsVisible, setCardsVisible] = useState(0);
  const [countAnimDone, setCountAnimDone] = useState(false);

  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("user@example.com");

  const [thoughtHistory, setThoughtHistory] = useState(getThoughtHistory());

  useEffect(() => {
    const hasOnboarded = hasCompletedOnboarding();
    const hasToken = getJwt();

    if (!hasOnboarded) {
      setScreen("onboarding");
    } else if (!hasToken) {
      setScreen("auth");
    } else {
      setScreen("home");
    }

    setThoughtHistory(getThoughtHistory());
  }, []);

  const refreshHistory = useCallback(() => {
    setThoughtHistory(getThoughtHistory());
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

  const handleSubmitThought = useCallback(async () => {
    if (!thoughtText.trim()) return;

    const rawText = thoughtText;
    setInputOpen(false);
    setScreen("processing");

    const processingStart = Date.now();

    try {
      const result = await submitThought(rawText);
      saveThought(result.message_id, rawText, result.theme_category);
      setMatchCount(result.match_count);
      setSimilarThoughts(result.similar_thoughts);

      const elapsed = Date.now() - processingStart;
      const remainingDelay = Math.max(0, PROCESSING_MIN_DURATION_MS - elapsed);

      setTimeout(() => {
        setCardsVisible(0);
        setCountAnimDone(false);
        setScreen("results");
      }, remainingDelay);
    } catch {
      saveThought("demo-" + Date.now(), rawText, "self_worth");
      setMatchCount(SEED_MATCH_COUNT);
      setSimilarThoughts(SEED_THOUGHTS);

      const elapsed = Date.now() - processingStart;
      const remainingDelay = Math.max(0, PROCESSING_MIN_DURATION_MS - elapsed);

      setTimeout(() => {
        setCardsVisible(0);
        setCountAnimDone(false);
        setScreen("results");
      }, remainingDelay);
    }

    setThoughtText("");
    refreshHistory();
  }, [thoughtText, refreshHistory]);

  const handleAuth = useCallback(
    async (email: string, password: string, mode: "login" | "signup") => {
      setAuthLoading(true);
      setAuthError(null);

      try {
        const authFn = mode === "login" ? login : register;
        const result = await authFn({ email, password });
        saveJwt(result.access_token);
        setUserEmail(email);
        setScreen("home");
      } catch {
        setUserEmail(email);
        saveJwt("demo-token");
        setScreen("home");
      } finally {
        setAuthLoading(false);
      }
    },
    []
  );

  const handleOnboardingComplete = useCallback(() => {
    markOnboardingComplete();
    setScreen("auth");
  }, []);

  const handleResolve = useCallback(
    async (messageId: string, resolutionText: string) => {
      resolveThoughtLocal(messageId, resolutionText);
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

  const handleDeleteAccount = useCallback(async () => {
    try {
      await deleteAccount();
    } catch {
      /* clear local regardless */
    }
    clearAllData();
    setScreen("auth");
  }, []);

  const handleNavigate = useCallback((target: AppScreen) => {
    setScreen(target);
  }, []);

  const handleBackToHome = useCallback(() => {
    setScreen("home");
  }, []);

  const isMainScreen = screen === "home" || screen === "results";

  /* ── Shared content renderer ── */
  const renderContent = () => (
    <>
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

      {screen === "home" && (
        <div className="flex flex-1 flex-col items-center justify-center">
          <EchoLogo
            size={isDesktop ? 200 : 150}
            animate
            onClick={() => setInputOpen(true)}
          />
          <p className="mt-7 animate-[fadeIn_1s_ease_0.6s_both] text-[13.5px] font-light tracking-wide text-echo-text-muted">
            tap to share what&apos;s on your mind
          </p>
        </div>
      )}

      {screen === "processing" && <ProcessingScreen />}

      {screen === "results" && (
        <div className="echo-scroll-area flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto max-w-xl">
            <CountReveal
              targetCount={matchCount}
              onAnimationComplete={() => setCountAnimDone(true)}
            />
            {countAnimDone && (
              <ThoughtCardList
                thoughts={similarThoughts}
                visibleCount={cardsVisible}
                onCardTap={setBottomSheetThought}
              />
            )}
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

      {screen === "thoughts" && (
        <HistoryPanel
          thoughts={thoughtHistory}
          onBack={handleBackToHome}
          onResolve={handleResolve}
        />
      )}

      {screen === "trends" && (
        <TrendsPanel thoughts={thoughtHistory} onBack={handleBackToHome} />
      )}

      {screen === "account" && (
        <AccountPanel
          email={userEmail}
          onBack={handleBackToHome}
          onDeleteAccount={handleDeleteAccount}
          onToggleNotifications={setNotificationsEnabled}
          notificationsEnabled={notificationsEnabled}
        />
      )}

      {screen === "about" && <AboutPanel onBack={handleBackToHome} />}
    </>
  );

  /* ══════════════════════════════════════════════════
     Desktop layout — full width, sidebar menu
     ══════════════════════════════════════════════════ */
  if (isDesktop) {
    return (
      <div className="flex h-[100dvh] flex-col bg-echo-bg font-sans">
        {/* Top bar — full width */}
        {isMainScreen && (
          <div className="flex items-center px-6 pt-4 pb-1">
            <HamburgerButton
              isOpen={false}
              onClick={() => setMenuOpen(true)}
            />
            <span className="mx-auto font-serif text-sm font-light tracking-[3px] text-echo-text-muted opacity-60">
              echo
            </span>
            <div className="w-10" aria-hidden="true" />
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
          />

          {/* Bottom sheet */}
          <BottomSheet
            thought={bottomSheetThought}
            onClose={() => setBottomSheetThought(null)}
          />
        </div>

        {/* Sidebar menu — slides from left, has its own close button */}
        <AnimatePresence>
          {menuOpen && (
            <MenuOverlay
              mode="sidebar"
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

        {/* Top bar */}
        {isMainScreen && (
          <div className="z-90 flex items-center px-4 pt-3 pb-1">
            <HamburgerButton
              isOpen={menuOpen}
              onClick={() => setMenuOpen((prev) => !prev)}
            />
            <div className="flex-1" />
          </div>
        )}

        {/* Mobile fullscreen menu */}
        <AnimatePresence>
          {menuOpen && (
            <MenuOverlay
              mode="fullscreen"
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
        />

        {/* Bottom sheet */}
        <BottomSheet
          thought={bottomSheetThought}
          onClose={() => setBottomSheetThought(null)}
        />
      </div>
    </div>
  );
}
