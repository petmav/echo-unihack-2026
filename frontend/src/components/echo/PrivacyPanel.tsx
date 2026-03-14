"use client";

import { ChevronLeft, Smartphone, Server, Wand2, Database, ArrowDown, ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react";

interface PrivacyPanelProps {
  onBack: () => void;
}

const PIPELINE_STAGES = [
  {
    icon: Smartphone,
    label: "Your device",
    color: "bg-echo-privacy-green-bg",
    iconColor: "text-echo-privacy-green",
    enters: "Your exact words",
    exits: "Sent securely to our server",
    note: "Your raw thought is typed on your device and sent over an encrypted connection. It is never saved on your device or anywhere else — it exists only long enough to be anonymised.",
  },
  {
    icon: Server,
    label: "Our server",
    color: "bg-echo-privacy-blue-bg",
    iconColor: "text-echo-privacy-blue",
    enters: "Your words (in transit only)",
    exits: "Sent straight to the anonymiser",
    note: "Your thought travels to our server over an encrypted connection. It is never written to disk, never logged, and handled only in memory.",
  },
  {
    icon: Wand2,
    label: "Anonymiser",
    color: "bg-echo-privacy-pink-bg",
    iconColor: "text-echo-privacy-pink",
    enters: "Your original words",
    exits: "Scrubbed emotion — no details",
    note: "A small AI running on our server strips out any identifying details — names, places, relationships — while keeping the emotional core. Your original words are then discarded immediately and permanently.",
  },
  {
    icon: Wand2,
    label: "Claude AI",
    color: "bg-echo-privacy-purple-bg",
    iconColor: "text-echo-privacy-purple",
    enters: "Anonymised emotion only",
    exits: "Natural, humanised phrasing",
    note: "Claude never sees your original words. It only receives the scrubbed emotional core, which it rewrites into a natural-sounding sentence so it can be matched with others who felt the same way.",
  },
  {
    icon: Database,
    label: "Search index",
    color: "bg-echo-privacy-orange-bg",
    iconColor: "text-echo-privacy-orange",
    enters: "Humanised, anonymous thought",
    exits: "Similar thoughts from others",
    note: "The search index holds no names, no accounts, no device info — only anonymised emotional patterns. Nothing stored here can be traced back to you or anyone else.",
  },
] as const;

const BREACH_SCENARIOS = [
  {
    icon: ShieldAlert,
    title: "If our server was hacked",
    impact: "Low",
    impactColor: "text-echo-privacy-amber",
    impactBg: "bg-echo-privacy-orange-bg",
    description:
      "An attacker would find your email address and a list of emotional themes — for example, 'work stress' or 'loneliness'. They would not find any of your actual words, thoughts, or anything you typed.",
  },
  {
    icon: ShieldOff,
    title: "If the search index was hacked",
    impact: "Very low",
    impactColor: "text-echo-privacy-green",
    impactBg: "bg-echo-privacy-green-bg",
    description:
      "An attacker would find humanised, anonymous thoughts with zero user linkage. There are no names, no accounts, no way to connect a thought to a real person. It would read like an anonymous psychology dataset.",
  },
  {
    icon: ShieldCheck,
    title: "If your phone was hacked",
    impact: "Your data only",
    impactColor: "text-echo-privacy-blue",
    impactBg: "bg-echo-privacy-blue-bg",
    description:
      "No thoughts are stored on your device, so there is nothing sensitive to find. Your login credentials are the only local data — and your password is never stored in plain text.",
  },
] as const;

const COMPETITOR_INCIDENTS = [
  {
    name: "BetterHelp",
    year: "2023",
    incident: "Shared users' private therapy data — including mental health diagnoses — with Facebook and Snapchat for advertising. Fined $7.8 million by the FTC.",
    badge: "$7.8M FTC fine",
    badgeColor: "text-echo-privacy-red",
    badgeBg: "bg-echo-privacy-red-bg",
  },
  {
    name: "Whisper",
    year: "2020",
    incident: "900 million 'anonymous' posts were found to be linked to user location, age, and other identifying data — stored permanently and exposed in a leak.",
    badge: "900M records exposed",
    badgeColor: "text-echo-privacy-red",
    badgeBg: "bg-echo-privacy-red-bg",
  },
] as const;

export function PrivacyPanel({ onBack }: PrivacyPanelProps) {
  return (
    <div className="echo-scroll-area flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
      {/* Header */}
      <div
        className="sticky top-0 z-50 flex items-center gap-3 px-5 pb-4 pt-4 backdrop-blur-2xl"
        style={{ background: "var(--echo-header-blur)" }}
      >
        <button
          onClick={onBack}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-echo-text transition-colors active:bg-black/5"
          aria-label="Go back"
        >
          <ChevronLeft size={22} />
        </button>
        <h2 className="font-serif text-xl font-normal tracking-tight text-echo-text">
          Your privacy
        </h2>
      </div>

      <div className="mx-auto w-full max-w-xl px-4 pb-12">
        {/* Intro */}
        <div className="mb-5 rounded-2xl bg-echo-card p-5 shadow-[0_1px_12px_rgba(44,40,37,0.05)]">
          <h3 className="mb-2 text-sm font-medium text-echo-text">
            Your words are never stored
          </h3>
          <p className="text-[13.5px] font-light leading-relaxed text-echo-text-soft">
            Echo was designed from the ground up so that your raw words are
            never saved anywhere. They are anonymised in real time and
            immediately discarded. The pipeline below shows exactly what
            happens at each step — no hidden steps, no surprises.
          </p>
        </div>

        {/* Pipeline */}
        <h3 className="mb-3 px-1 text-xs font-medium uppercase tracking-widest text-echo-text-soft">
          What happens to your thought
        </h3>

        <div className="mb-5 space-y-0">
          {PIPELINE_STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            return (
              <div key={stage.label}>
                <div className="rounded-2xl bg-echo-card p-4 shadow-[0_1px_12px_rgba(44,40,37,0.05)]">
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${stage.color}`}
                    >
                      <Icon size={17} className={stage.iconColor} />
                    </div>
                    <span className="text-sm font-medium text-echo-text">
                      {stage.label}
                    </span>
                  </div>
                  <div className="mb-2 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-echo-highlight px-3 py-2">
                      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-echo-text-soft">
                        Receives
                      </p>
                      <p className="text-[12px] font-light text-echo-text">
                        {stage.enters}
                      </p>
                    </div>
                    <div className="rounded-xl bg-echo-highlight px-3 py-2">
                      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-echo-text-soft">
                        Passes on
                      </p>
                      <p className="text-[12px] font-light text-echo-text">
                        {stage.exits}
                      </p>
                    </div>
                  </div>
                  <p className="text-[12px] font-light leading-relaxed text-echo-text-soft">
                    {stage.note}
                  </p>
                </div>
                {idx < PIPELINE_STAGES.length - 1 && (
                  <div className="flex justify-center py-1.5">
                    <ArrowDown size={16} className="text-echo-text-soft/40" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Breach impact */}
        <h3 className="mb-3 px-1 text-xs font-medium uppercase tracking-widest text-echo-text-soft">
          If something went wrong
        </h3>

        <div className="mb-5 space-y-3">
          {BREACH_SCENARIOS.map((scenario) => {
            const Icon = scenario.icon;
            return (
              <div
                key={scenario.title}
                className="rounded-2xl bg-echo-card p-4 shadow-[0_1px_12px_rgba(44,40,37,0.05)]"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Icon size={17} className={scenario.impactColor} />
                    <span className="text-sm font-medium text-echo-text">
                      {scenario.title}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${scenario.impactColor} ${scenario.impactBg}`}
                  >
                    {scenario.impact}
                  </span>
                </div>
                <p className="text-[13px] font-light leading-relaxed text-echo-text-soft">
                  {scenario.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Competitor comparison */}
        <h3 className="mb-3 px-1 text-xs font-medium uppercase tracking-widest text-echo-text-soft">
          Why this matters
        </h3>

        <div className="mb-5 rounded-2xl bg-echo-card p-5 shadow-[0_1px_12px_rgba(44,40,37,0.05)]">
          <p className="mb-4 text-[13.5px] font-light leading-relaxed text-echo-text-soft">
            Most mental health apps have been caught mishandling the very data
            you trust them with. Here is what happened to two of the biggest:
          </p>
          <div className="space-y-3">
            {COMPETITOR_INCIDENTS.map((item) => (
              <div
                key={item.name}
                className="rounded-xl border border-border p-3.5"
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-echo-text">
                    {item.name}{" "}
                    <span className="font-light text-echo-text-soft">
                      · {item.year}
                    </span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${item.badgeColor} ${item.badgeBg}`}
                  >
                    {item.badge}
                  </span>
                </div>
                <p className="text-[12.5px] font-light leading-relaxed text-echo-text-soft">
                  {item.incident}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Closing assurance */}
        <div className="rounded-2xl bg-echo-card p-5 shadow-[0_1px_12px_rgba(44,40,37,0.05)]">
          <h3 className="mb-2 text-sm font-medium text-echo-text">
            Our promise
          </h3>
          <p className="text-[13.5px] font-light leading-relaxed text-echo-text-soft">
            This page is entirely static. Viewing it creates no analytics event,
            no log entry, and no record of any kind. Privacy is not a setting —
            it is the architecture.
          </p>
        </div>
      </div>
    </div>
  );
}
