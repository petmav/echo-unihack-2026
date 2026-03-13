"use client";

import { ChevronLeft, Shield } from "lucide-react";

import type { LocalThought } from "@/lib/types";

interface TrendsPanelProps {
  thoughts: LocalThought[];
  onBack: () => void;
}

interface WeeklyData {
  label: string;
  counts: Record<string, number>;
}

function computeWeeklyData(thoughts: LocalThought[]): WeeklyData[] {
  const now = Date.now();
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const WEEKS_TO_SHOW = 8;
  const weeks: WeeklyData[] = [];

  for (let i = WEEKS_TO_SHOW - 1; i >= 0; i--) {
    const weekStart = now - (i + 1) * WEEK_MS;
    const weekEnd = now - i * WEEK_MS;
    const weekThoughts = thoughts.filter(
      (t) => t.timestamp >= weekStart && t.timestamp < weekEnd
    );

    const counts: Record<string, number> = {};
    for (const t of weekThoughts) {
      counts[t.theme_category] = (counts[t.theme_category] ?? 0) + 1;
    }

    weeks.push({
      label: `W${WEEKS_TO_SHOW - i}`,
      counts,
    });
  }

  return weeks;
}

function getTopThemes(thoughts: LocalThought[]): [string, number][] {
  const counts: Record<string, number> = {};
  for (const t of thoughts) {
    counts[t.theme_category] = (counts[t.theme_category] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

const THEME_COLORS: Record<string, string> = {
  self_worth: "#C8856C",
  professional_worth: "#E8C4B4",
  relationship_loss: "#B5ADA6",
  comparison: "#C8856C",
  family_pressure: "#A06B55",
};

const THEME_LABELS: Record<string, string> = {
  self_worth: "Self-worth",
  professional_worth: "Work",
  relationship_loss: "Relationships",
  comparison: "Comparison",
  family_pressure: "Family",
};

function formatThemeName(theme: string): string {
  return THEME_LABELS[theme] ?? theme.replace(/_/g, " ");
}

export function TrendsPanel({ thoughts, onBack }: TrendsPanelProps) {
  const resolvedCount = thoughts.filter((t) => t.is_resolved).length;
  const totalCount = thoughts.length;
  const resolutionRate =
    totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;

  const weeklyData = computeWeeklyData(thoughts);
  const topThemes = getTopThemes(thoughts);
  const mostFrequentTheme = topThemes[0];

  const maxWeekCount = Math.max(
    1,
    ...weeklyData.map((w) =>
      Object.values(w.counts).reduce((sum, c) => sum + c, 0)
    )
  );

  const activeThemeKeys = [
    ...new Set(thoughts.map((t) => t.theme_category)),
  ].slice(0, 3);

  return (
    <div className="echo-scroll-area flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-0 z-50 flex items-center gap-3 px-5 pb-4 pt-4 backdrop-blur-2xl" style={{ background: "rgba(250, 247, 242, 0.88)" }}>
        <button
          onClick={onBack}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-echo-text transition-colors active:bg-black/5"
          aria-label="Go back"
        >
          <ChevronLeft size={22} />
        </button>
        <h2 className="font-serif text-xl font-normal tracking-tight text-echo-text">
          Trends
        </h2>
      </div>

      <div className="mx-auto w-full max-w-xl px-4 pb-12">
        {/* Privacy banner */}
        <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-echo-highlight p-3 text-echo-text-soft">
          <Shield size={18} className="shrink-0" />
          <p className="text-[11.5px] font-light leading-snug">
            All computed locally on your device.
          </p>
        </div>

        {totalCount === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-sm font-light text-echo-text-muted">
              Share some thoughts first to see your trends.
            </p>
          </div>
        ) : (
          <>
            {/* Resolution rate */}
            <div className="mb-3 rounded-2xl bg-white p-5 shadow-[0_1px_12px_rgba(44,40,37,0.05)]">
              <p className="text-[13px] font-medium uppercase tracking-wider text-echo-text-soft">
                Resolution rate
              </p>
              <p className="mt-1 font-serif text-4xl font-semibold leading-none text-echo-text">
                {resolutionRate}%
              </p>
              <p className="mt-1 text-[13px] font-light text-echo-text-muted">
                {resolvedCount} of {totalCount} thoughts resolved
              </p>
            </div>

            {/* Weekly chart */}
            <div className="mb-3 rounded-2xl bg-white p-5 shadow-[0_1px_12px_rgba(44,40,37,0.05)]">
              <p className="mb-3.5 text-[13px] font-medium uppercase tracking-wider text-echo-text-soft">
                Themes over 8 weeks
              </p>

              <div className="flex h-[72px] items-end gap-1.5">
                {weeklyData.map((week, weekIndex) => (
                  <div
                    key={weekIndex}
                    className="flex flex-1 flex-col items-center justify-end"
                    style={{ height: "100%" }}
                  >
                    <div className="flex w-full flex-col items-center gap-px">
                      {activeThemeKeys.map((theme) => {
                        const count = week.counts[theme] ?? 0;
                        const height = (count / maxWeekCount) * 56;
                        return (
                          <div
                            key={theme}
                            className="w-full rounded-t-sm"
                            style={{
                              height: `${Math.max(count > 0 ? 2 : 0, height)}px`,
                              background:
                                THEME_COLORS[theme] ?? "#B5ADA6",
                            }}
                          />
                        );
                      })}
                    </div>
                    <span className="mt-1 text-[9px] text-echo-text-muted">
                      {week.label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-3.5">
                {activeThemeKeys.map((theme) => (
                  <div
                    key={theme}
                    className="flex items-center gap-1.5 text-[11px] text-echo-text-soft"
                  >
                    <div
                      className="h-2 w-2 rounded-sm"
                      style={{
                        background: THEME_COLORS[theme] ?? "#B5ADA6",
                      }}
                    />
                    {formatThemeName(theme)}
                  </div>
                ))}
              </div>
            </div>

            {/* Most frequent */}
            {mostFrequentTheme && (
              <div className="rounded-2xl bg-white p-5 shadow-[0_1px_12px_rgba(44,40,37,0.05)]">
                <p className="text-[13px] font-medium uppercase tracking-wider text-echo-text-soft">
                  Most frequent
                </p>
                <p className="mt-1 font-serif text-[22px] font-normal text-echo-text">
                  {formatThemeName(mostFrequentTheme[0])}
                </p>
                <p className="mt-1.5 text-[13px] font-light text-echo-text-muted">
                  Appears in{" "}
                  {totalCount > 0
                    ? Math.round((mostFrequentTheme[1] / totalCount) * 100)
                    : 0}
                  % of entries
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
