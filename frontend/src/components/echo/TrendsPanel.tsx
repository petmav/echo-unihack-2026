"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, CircleHelp, Clock3, Shield, TrendingUp } from "lucide-react";

import type { LocalThought } from "@/lib/types";
import {
  buildResolutionTimeline,
  buildTrendSnapshot,
  type TrendRange,
  type TrendThemeSummary,
} from "@/lib/trends";

interface TrendsPanelProps {
  thoughts: LocalThought[];
  onBack: () => void;
}

const RANGE_OPTIONS: { value: TrendRange; label: string }[] = [
  { value: "weekly", label: "Week" },
  { value: "monthly", label: "Month" },
  { value: "yearly", label: "Year" },
];

const THEME_COLORS: Record<string, string> = {
  self_worth: "#C8856C",
  professional_worth: "#D79E7D",
  work_stress: "#D79E7D",
  burnout: "#B77A63",
  relationship_loss: "#A49C96",
  loneliness: "#8D9BA8",
  comparison: "#D4A173",
  family_pressure: "#8E5F4D",
  anxiety: "#C2A488",
  grief: "#8F837B",
  self_harm: "#B95E5E",
  suicidal_ideation: "#A34C4C",
  crisis: "#B7645D",
  substance_abuse: "#A58268",
  eating_disorder: "#947D73",
  abuse: "#8C5F5F",
  domestic_violence: "#7B5353",
  other: "#D7D0C9",
};

const THEME_LABELS: Record<string, string> = {
  self_worth: "Self-worth",
  professional_worth: "Professional worth",
  work_stress: "Work stress",
  burnout: "Burnout",
  relationship_loss: "Relationship loss",
  loneliness: "Loneliness",
  comparison: "Comparison",
  family_pressure: "Family pressure",
  anxiety: "Anxiety",
  grief: "Grief",
  self_harm: "Self-harm",
  suicidal_ideation: "Suicidal ideation",
  crisis: "Crisis",
  substance_abuse: "Substance abuse",
  eating_disorder: "Eating disorder",
  abuse: "Abuse",
  domestic_violence: "Domestic violence",
  other: "Other",
};

function formatThemeName(theme: string): string {
  return THEME_LABELS[theme] ?? theme.replace(/_/g, " ");
}

function getThemeColor(theme: string): string {
  if (THEME_COLORS[theme]) {
    return THEME_COLORS[theme];
  }

  let hash = 0;
  for (let index = 0; index < theme.length; index += 1) {
    hash = theme.charCodeAt(index) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 38% 68%)`;
}

function formatMomentum(theme: TrendThemeSummary | null, range: TrendRange): string {
  if (!theme) {
    return "Nothing to compare yet.";
  }

  const comparisonLabel =
    range === "weekly" ? "last week" : range === "monthly" ? "last month" : "last year";

  if (theme.delta > 0) {
    return `Up ${theme.delta} from ${comparisonLabel}`;
  }

  if (theme.delta < 0) {
    return `Down ${Math.abs(theme.delta)} from ${comparisonLabel}`;
  }

  return `Same as ${comparisonLabel}`;
}

function formatEntryCount(count: number): string {
  return `${count} ${count === 1 ? "entry" : "entries"}`;
}

function formatResolutionDuration(elapsedMs: number): string {
  const elapsedDays = Math.max(0, Math.round(elapsedMs / (1000 * 60 * 60 * 24)));

  if (elapsedDays === 0) {
    return "the same day";
  }

  if (elapsedDays === 1) {
    return "1 day later";
  }

  if (elapsedDays < 7) {
    return `${elapsedDays} days later`;
  }

  if (elapsedDays < 30) {
    const weeks = Math.round(elapsedDays / 7);
    return `${weeks} ${weeks === 1 ? "week" : "weeks"} later`;
  }

  const months = Math.round(elapsedDays / 30);
  return `${months} ${months === 1 ? "month" : "months"} later`;
}

function formatResolutionDurationCompact(elapsedMs: number): string {
  const elapsedDays = Math.max(0, Math.round(elapsedMs / (1000 * 60 * 60 * 24)));

  if (elapsedDays === 0) {
    return "same day";
  }

  if (elapsedDays < 7) {
    return `${elapsedDays}d`;
  }

  if (elapsedDays < 30) {
    return `${Math.round(elapsedDays / 7)}w`;
  }

  return `${Math.round(elapsedDays / 30)}mo`;
}

function formatTimelineDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
}

function getFlowUnitLabel(range: TrendRange): string {
  if (range === "weekly") {
    return "day";
  }

  if (range === "monthly") {
    return "week slice";
  }

  return "month";
}

export function TrendsPanel({ thoughts, onBack }: TrendsPanelProps) {
  const [range, setRange] = useState<TrendRange>("weekly");
  const [showFlowHelp, setShowFlowHelp] = useState(false);
  const flowHelpButtonRef = useRef<HTMLButtonElement>(null);

  const trendThoughts = useMemo(
    () =>
      thoughts.map(({ theme_category, timestamp, is_resolved }) => ({
        theme_category,
        timestamp,
        is_resolved,
      })),
    [thoughts]
  );

  const snapshot = useMemo(
    () => buildTrendSnapshot(trendThoughts, range),
    [trendThoughts, range]
  );

  const overallThemes = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const thought of trendThoughts) {
      counts[thought.theme_category] = (counts[thought.theme_category] ?? 0) + 1;
    }

    return Object.entries(counts)
      .sort((left, right) => right[1] - left[1])
      .map(([theme]) => theme);
  }, [trendThoughts]);

  const overallResolutionRate = useMemo(() => {
    if (thoughts.length === 0) {
      return 0;
    }

    const resolvedCount = thoughts.filter((thought) => thought.is_resolved).length;
    return Math.round((resolvedCount / thoughts.length) * 100);
  }, [thoughts]);

  const displayedThemes = useMemo(() => {
    const selectedThemes = snapshot.topThemes.slice(0, 3).map((theme) => theme.theme);
    if (selectedThemes.length > 0) {
      return selectedThemes;
    }

    return overallThemes.slice(0, 3);
  }, [snapshot.topThemes, overallThemes]);

  const hasOtherThemes =
    snapshot.topThemes.length > displayedThemes.length &&
    snapshot.buckets.some((bucket) => {
      const visibleTotal = displayedThemes.reduce(
        (sum, theme) => sum + (bucket.counts[theme] ?? 0),
        0
      );
      return bucket.total > visibleTotal;
    });

  const chartThemes = hasOtherThemes ? [...displayedThemes, "other"] : displayedThemes;
  const maxBucketTotal = Math.max(1, ...snapshot.buckets.map((bucket) => bucket.total));
  const dominantTheme = snapshot.dominantTheme;
  const risingTheme = snapshot.risingTheme;
  const resolutionTimeline = useMemo(
    () =>
      buildResolutionTimeline(
        thoughts.map(
          ({
            message_id,
            theme_category,
            timestamp,
            is_resolved,
            resolution_timestamp,
          }) => ({
            message_id,
            theme_category,
            timestamp,
            is_resolved,
            resolution_timestamp,
          })
        )
      ),
    [thoughts]
  );
  const flowUnitLabel = getFlowUnitLabel(range);
  const peakBucket = useMemo(() => {
    return snapshot.buckets.reduce<(typeof snapshot.buckets)[number] | null>(
      (currentPeak, bucket) => {
        if (!currentPeak || bucket.total > currentPeak.total) {
          return bucket;
        }
        return currentPeak;
      },
      null
    );
  }, [snapshot]);

  useEffect(() => {
    if (!showFlowHelp) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!flowHelpButtonRef.current?.contains(target)) {
        setShowFlowHelp(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowFlowHelp(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showFlowHelp]);

  return (
    <div className="echo-scroll-area flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
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
          Trends
        </h2>
      </div>

      <div className="mx-auto w-full max-w-xl px-4 pb-12">
        <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-echo-highlight p-3 text-echo-text-soft">
          <Shield size={18} className="shrink-0" />
          <p className="text-[11.5px] font-light leading-snug">
            All emotion trends are computed from anonymised data only.
          </p>
        </div>

        {thoughts.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-sm font-light text-echo-text-muted">
              Share some thoughts first to see your trends.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex rounded-full bg-echo-card p-1 shadow-[0_1px_12px_rgba(44,40,37,0.05)] dark:shadow-[0_1px_12px_rgba(0,0,0,0.2)]">
              {RANGE_OPTIONS.map((option) => {
                const isActive = option.value === range;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRange(option.value)}
                    className={`flex-1 rounded-full px-3 py-2 text-[13px] font-medium transition-colors ${
                      isActive
                        ? "bg-echo-accent text-white"
                        : "text-echo-text-soft"
                    }`}
                    aria-pressed={isActive}
                    data-testid={`trend-range-${option.value}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-echo-card p-5 shadow-[0_1px_12px_rgba(44,40,37,0.05)] dark:shadow-[0_1px_12px_rgba(0,0,0,0.2)]">
                <p
                  className="text-[13px] font-medium uppercase tracking-wider text-echo-text-soft"
                  data-testid="trend-period-label"
                >
                  {snapshot.periodLabel}
                </p>
                <p className="mt-1 font-serif text-4xl font-semibold leading-none text-echo-text">
                  {snapshot.totalCount}
                </p>
                <p className="mt-1 text-[13px] font-light text-echo-text-muted">
                  {snapshot.subtitle}
                </p>
              </div>

              <div className="rounded-2xl bg-echo-card p-5 shadow-[0_1px_12px_rgba(44,40,37,0.05)] dark:shadow-[0_1px_12px_rgba(0,0,0,0.2)]">
                <p className="text-[13px] font-medium uppercase tracking-wider text-echo-text-soft">
                  Resolved
                </p>
                <p className="mt-1 font-serif text-4xl font-semibold leading-none text-echo-text">
                  {snapshot.resolutionRate}%
                </p>
                <p className="mt-1 text-[13px] font-light text-echo-text-muted">
                  {snapshot.totalCount > 0
                    ? `${snapshot.resolvedCount} of ${snapshot.totalCount} entries`
                    : `${overallResolutionRate}% overall`}
                </p>
              </div>
            </div>

            <div
              className="mb-3 rounded-2xl bg-echo-card p-5 shadow-[0_1px_12px_rgba(44,40,37,0.05)] dark:shadow-[0_1px_12px_rgba(0,0,0,0.2)]"
              data-testid="resolution-timeline"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium uppercase tracking-wider text-echo-text-soft">
                    Resolution timeline
                  </p>
                  <p className="mt-1 text-[13px] font-light text-echo-text-muted">
                    Recent shifts across your local history.
                  </p>
                </div>

                <div className="rounded-full bg-echo-highlight p-2.5 text-echo-accent">
                  <Clock3 size={18} />
                </div>
              </div>

              {resolutionTimeline.trackedResolvedCount > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-echo-highlight px-3.5 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-echo-text-soft">
                      Average shift
                    </p>
                    <p className="mt-1 text-[15px] font-normal text-echo-text">
                      {formatResolutionDuration(
                        resolutionTimeline.averageResolutionMs ?? 0
                      )}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-echo-highlight px-3.5 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-echo-text-soft">
                      Tracked
                    </p>
                    <p className="mt-1 text-[15px] font-normal text-echo-text">
                      {resolutionTimeline.trackedResolvedCount}{" "}
                      {resolutionTimeline.trackedResolvedCount === 1
                        ? "resolution"
                        : "resolutions"}
                    </p>
                  </div>
                </div>
              )}

              {resolutionTimeline.items.length === 0 ? (
                <p className="mt-4 text-[13px] font-light leading-relaxed text-echo-text-muted">
                  Resolve a thought to start tracking how long it takes for something to shift.
                </p>
              ) : (
                <div className="mt-5 space-y-4">
                  {resolutionTimeline.items.map((item, index) => (
                    <div
                      key={item.messageId}
                      className="relative pl-5"
                      data-testid="resolution-timeline-item"
                    >
                      <span className="absolute left-0 top-2.5 h-2.5 w-2.5 rounded-full bg-echo-accent" />
                      {index < resolutionTimeline.items.length - 1 && (
                        <span className="absolute left-[4px] top-5 h-[calc(100%-0.25rem)] w-px bg-echo-highlight-border" />
                      )}

                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[13.5px] font-normal text-echo-text">
                            {formatThemeName(item.theme)}
                          </p>
                          <p className="mt-1 text-[12.5px] font-light leading-relaxed text-echo-text-muted">
                            Shared what helped {formatResolutionDuration(item.elapsedMs)}.
                          </p>
                          <p className="mt-1 text-[11.5px] font-light text-echo-text-muted">
                            Wrote {formatTimelineDate(item.submittedAt)} • Resolved{" "}
                            {formatTimelineDate(item.resolvedAt)}
                          </p>
                        </div>

                        <span className="rounded-full bg-echo-highlight px-2.5 py-1 text-[11.5px] font-medium text-echo-accent">
                          {formatResolutionDurationCompact(item.elapsedMs)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {resolutionTimeline.legacyResolvedCount > 0 && (
                <p className="mt-4 text-[11.5px] font-light leading-relaxed text-echo-text-muted">
                  {resolutionTimeline.legacyResolvedCount} older{" "}
                  {resolutionTimeline.legacyResolvedCount === 1
                    ? "resolved entry was"
                    : "resolved entries were"}{" "}
                  saved before timeline tracking started on this device.
                </p>
              )}
            </div>

            <div className="mb-3 rounded-2xl bg-echo-card p-5 shadow-[0_1px_12px_rgba(44,40,37,0.05)] dark:shadow-[0_1px_12px_rgba(0,0,0,0.2)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium uppercase tracking-wider text-echo-text-soft">
                    Most present
                  </p>
                  <p
                    className="mt-1 font-serif text-[24px] font-normal leading-tight text-echo-text"
                    data-testid="trend-dominant-theme"
                  >
                    {dominantTheme ? formatThemeName(dominantTheme.theme) : "No entries yet"}
                  </p>
                  <p className="mt-1.5 text-[13px] font-light text-echo-text-muted">
                    {dominantTheme
                      ? `${Math.round(dominantTheme.share * 100)}% of this period`
                      : "Switch ranges or keep sharing to build a pattern."}
                  </p>
                </div>

                <div className="rounded-full bg-echo-highlight p-2.5 text-echo-accent">
                  <TrendingUp size={18} />
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-echo-highlight px-3.5 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-echo-text-soft">
                  Changing most
                </p>
                <p className="mt-1 text-[14px] font-normal text-echo-text">
                  {risingTheme ? formatThemeName(risingTheme.theme) : "No movement yet"}
                </p>
                <p className="mt-1 text-[12px] font-light text-echo-text-muted">
                  {formatMomentum(risingTheme, range)}
                </p>
              </div>
            </div>

            <div
              className="mb-3 rounded-2xl bg-echo-card p-5 shadow-[0_1px_12px_rgba(44,40,37,0.05)] dark:shadow-[0_1px_12px_rgba(0,0,0,0.2)]"
              data-testid="trend-chart"
            >
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium uppercase tracking-wider text-echo-text-soft">
                    Emotion flow
                  </p>
                  <p className="mt-1 text-[13px] font-light text-echo-text-muted">
                    {snapshot.subtitle}
                  </p>
                  <p className="mt-1.5 text-[12px] font-light text-echo-text-muted">
                    {peakBucket && peakBucket.total > 0
                      ? `Most active ${flowUnitLabel}: ${peakBucket.label}`
                      : "Tap the help icon to see how this pattern is read."}
                  </p>
                </div>

                <button
                  ref={flowHelpButtonRef}
                  type="button"
                  onClick={() => setShowFlowHelp((current) => !current)}
                  className={`inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full text-echo-accent transition-all duration-200 active:scale-[0.94] ${
                    showFlowHelp
                      ? "bg-echo-highlight-border/70 shadow-[0_4px_14px_rgba(44,40,37,0.08)]"
                      : "bg-echo-highlight"
                  }`}
                  aria-expanded={showFlowHelp}
                  aria-label="Explain emotion flow chart"
                  data-testid="trend-flow-help-toggle"
                >
                  <motion.span
                    animate={{ rotate: showFlowHelp ? 18 : 0, scale: showFlowHelp ? 1.06 : 1 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    <CircleHelp size={16} />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {showFlowHelp && (
                    <motion.div
                      className="absolute right-0 top-11 z-10 w-[min(18rem,calc(100vw-3.75rem))]"
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      data-testid="trend-flow-help"
                    >
                      <div className="absolute right-4 top-0 h-3 w-3 -translate-y-1/2 rotate-45 bg-echo-highlight shadow-[0_2px_8px_rgba(44,40,37,0.06)]" />
                      <div className="rounded-2xl bg-echo-highlight px-3.5 py-3 shadow-[0_10px_28px_rgba(44,40,37,0.08)]">
                        <p className="text-[12.5px] font-light leading-relaxed text-echo-text-soft">
                          In {range === "weekly" ? "week" : range === "monthly" ? "month" : "year"} view,
                          each column groups thoughts into one {flowUnitLabel}. Stacks grow taller when more
                          thoughts land in that slice, and the colours show which themes made up that total.
                        </p>
                        {peakBucket && peakBucket.total > 0 && (
                          <p className="mt-2 text-[12px] font-light leading-relaxed text-echo-text-muted">
                            Most active {flowUnitLabel}: {peakBucket.label} with {formatEntryCount(peakBucket.total)}.
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="mt-5 flex h-[124px] items-end gap-2">
                {snapshot.buckets.map((bucket) => {
                  const visibleTotal = displayedThemes.reduce(
                    (sum, theme) => sum + (bucket.counts[theme] ?? 0),
                    0
                  );
                  const otherCount = Math.max(0, bucket.total - visibleTotal);
                  const segments = chartThemes.map((theme) => ({
                    theme,
                    count: theme === "other" ? otherCount : bucket.counts[theme] ?? 0,
                  }));

                  return (
                    <div key={bucket.key} className="flex flex-1 flex-col items-center">
                      <div className="flex h-[96px] w-full items-end justify-center">
                        <div className="flex h-full w-full max-w-[44px] flex-col justify-end overflow-hidden rounded-[14px] bg-echo-highlight">
                          {segments.map((segment) => {
                            if (segment.count === 0) {
                              return null;
                            }

                            const height = (segment.count / maxBucketTotal) * 96;

                            return (
                              <div
                                key={`${bucket.key}-${segment.theme}`}
                                className="w-full"
                                style={{
                                  height: `${Math.max(6, height)}px`,
                                  background: getThemeColor(segment.theme),
                                }}
                                title={`${formatThemeName(segment.theme)}: ${segment.count}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                      <span className="mt-2 text-[10px] font-light text-echo-text-muted">
                        {bucket.shortLabel}
                      </span>
                    </div>
                  );
                })}
              </div>

              {chartThemes.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                  {chartThemes.map((theme) => (
                    <div
                      key={theme}
                      className="flex items-center gap-1.5 text-[11px] text-echo-text-soft"
                    >
                      <div
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ background: getThemeColor(theme) }}
                      />
                      {formatThemeName(theme)}
                    </div>
                  ))}
                </div>
              )}

              {snapshot.totalCount === 0 && (
                <p className="mt-4 text-[12.5px] font-light leading-relaxed text-echo-text-muted">
                  Nothing landed in this {range === "weekly" ? "week" : range === "monthly" ? "month" : "year"} yet.
                </p>
              )}
            </div>

            <div className="rounded-2xl bg-echo-card p-5 shadow-[0_1px_12px_rgba(44,40,37,0.05)] dark:shadow-[0_1px_12px_rgba(0,0,0,0.2)]">
              <p className="text-[13px] font-medium uppercase tracking-wider text-echo-text-soft">
                Emotion mix
              </p>
              <p className="mt-1 text-[13px] font-light text-echo-text-muted">
                Share of total entries in this period.
              </p>

              {snapshot.topThemes.length === 0 ? (
                <p className="mt-3 text-[13px] font-light text-echo-text-muted">
                  No emotion mix yet for this period.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {snapshot.topThemes.slice(0, 4).map((theme) => (
                    <div key={theme.theme}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-sm"
                            style={{ background: getThemeColor(theme.theme) }}
                          />
                          <span className="text-[13.5px] font-normal text-echo-text">
                            {formatThemeName(theme.theme)}
                          </span>
                        </div>
                        <div className="text-right text-[12px] font-light text-echo-text-muted">
                          {theme.count} entries
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-echo-highlight">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(8, Math.round(theme.share * 100))}%`,
                            background: getThemeColor(theme.theme),
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
