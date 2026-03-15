"use client";

/**
 * Week's themes panel — anonymous weekly theme aggregates with donut + column charts.
 * Fetches GET /api/v1/thoughts/aggregates, shows top 5 themes, tap to explore thoughts.
 */

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";

import type { ThemeAggregate } from "@/lib/api";
import { getThemeAggregates } from "@/lib/api";
import { THEME_DISPLAY_LABELS } from "@/lib/constants";
import { DataModeBadge } from "./DataModeBadge";

interface WeeklyThemesPanelProps {
  onBack: () => void;
  onThemeSelect: (themeKey: string) => void;
}

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

function formatThemeLabel(theme: string): string {
  return THEME_DISPLAY_LABELS[theme] ?? theme.replace(/_/g, " ");
}

function getThemeColor(theme: string): string {
  if (THEME_COLORS[theme]) return THEME_COLORS[theme];
  let hash = 0;
  for (let i = 0; i < theme.length; i++) hash = theme.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360} 38% 68%)`;
}

/** SVG arc path for donut segment. Angles in radians, radius normalized 0-1. */
function describeArc(
  startAngle: number,
  endAngle: number,
  innerR: number,
  outerR: number
): string {
  const x1 = Math.cos(startAngle) * outerR;
  const y1 = Math.sin(startAngle) * outerR;
  const x2 = Math.cos(endAngle) * outerR;
  const y2 = Math.sin(endAngle) * outerR;
  const x3 = Math.cos(endAngle) * innerR;
  const y3 = Math.sin(endAngle) * innerR;
  const x4 = Math.cos(startAngle) * innerR;
  const y4 = Math.sin(startAngle) * innerR;
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4} Z`;
}

export function WeeklyThemesPanel({
  onBack,
  onThemeSelect,
}: WeeklyThemesPanelProps) {
  const [aggregates, setAggregates] = useState<ThemeAggregate[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
    });

    getThemeAggregates()
      .then((result) => {
        if (cancelled) return;
        setAggregates(result.items);
        setIsDemo(result.isDemo);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load weekly themes.");
        setAggregates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const { total, segments, columnMaxCount } = useMemo(() => {
    const sorted = [...aggregates].sort((a, b) => b.count - a.count);
    const top5 = sorted.slice(0, 5);
    const totalCount = top5.reduce((s, a) => s + a.count, 0);
    const segments = top5.map((a) => ({
      ...a,
      share: totalCount > 0 ? a.count / totalCount : 0,
    }));
    const columnMaxCount = Math.max(1, ...top5.map((a) => a.count));
    return { total: totalCount, segments, columnMaxCount };
  }, [aggregates]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-echo-bg">
      <div
        className="flex shrink-0 items-center gap-3 px-4 py-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={onBack}
          className="flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-echo-text-soft transition-colors hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/5 dark:active:bg-white/10 touch-manipulation -ml-1"
          aria-label="Back"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-base font-light tracking-wide text-echo-text sm:text-lg">
          Week&apos;s themes
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <p className="mb-4 text-[13px] font-light text-echo-text-muted">
          Anonymous themes others shared this week. Tap one to see the thoughts.
        </p>

        {loading && (
          <div className="py-12 text-center">
            <p className="text-[14px] font-light text-echo-text-soft">Loading themes...</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-echo-card p-4">
            <p className="text-[14px] font-normal text-echo-text">{error}</p>
          </div>
        )}

        {!loading && !error && aggregates.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-[14px] font-light text-echo-text-soft">
              No themes this week yet.
            </p>
          </div>
        )}

        {!loading && !error && aggregates.length > 0 && (
          <>
            <div className="mb-3">
              <DataModeBadge
                mode={isDemo ? "demo" : "live"}
                liveLabel="Live data"
                demoLabel="Demo data"
                testId="weekly-themes-data-mode"
              />
            </div>

            {/* Circle (donut) chart */}
            <div className="mb-6 rounded-2xl bg-echo-card p-5 shadow-[0_1px_12px_rgba(44,40,37,0.05)] dark:shadow-[0_1px_12px_rgba(0,0,0,0.2)]">
              <p className="text-[13px] font-medium uppercase tracking-wider text-echo-text-muted">
                Theme share
              </p>
              <p className="mt-1 text-[12px] font-light text-echo-text-muted">
                Proportion of thoughts per theme
              </p>
              <div className="relative mx-auto mt-4 flex aspect-square w-[min(200px,60vw)] items-center justify-center">
                <svg
                  viewBox="-1.2 -1.2 2.4 2.4"
                  className="h-full w-full -rotate-90"
                  aria-label="Donut chart of theme proportions"
                >
                  {segments.reduce<{ angle: number; els: React.ReactNode[] }>(
                    (acc, seg, i) => {
                      const start = acc.angle;
                      const sweep = seg.share * Math.PI * 2;
                      const end = start + sweep;
                      const midAngle = start + sweep / 2;
                      const labelRadius = 0.775;
                      const labelX = Math.cos(midAngle) * labelRadius;
                      const labelY = Math.sin(midAngle) * labelRadius;
                      const pct = Math.round(seg.share * 100);
                      acc.els.push(
                        <g key={seg.theme}>
                          <motion.path
                            d={describeArc(start, end, 0.55, 1)}
                            fill={getThemeColor(seg.theme)}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                            className="cursor-pointer transition-opacity hover:opacity-90"
                            style={{ transformOrigin: "center" }}
                            onClick={() => onThemeSelect(seg.theme)}
                            aria-label={`${formatThemeLabel(seg.theme)}: ${pct}%`}
                          />
                          {seg.share >= 0.06 && (
                            <g
                              transform={`translate(${labelX}, ${labelY}) rotate(90)`}
                              className="pointer-events-none"
                            >
                              <text
                                x={0}
                                y={0}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontSize="0.12"
                                fill="white"
                                fontWeight="600"
                                style={{
                                  textShadow: "0 0 0.04px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)",
                                }}
                              >
                                {pct}%
                              </text>
                            </g>
                          )}
                        </g>
                      );
                      acc.angle = end;
                      return acc;
                    },
                    { angle: 0, els: [] }
                  ).els}
                  <circle
                    cx="0"
                    cy="0"
                    r="0.55"
                    fill="var(--echo-bg, #faf8f5)"
                    aria-hidden
                  />
                  {total > 0 && (
                    <text
                      x="0"
                      y="0"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="0.22"
                      fill="currentColor"
                      className="text-echo-text-muted font-light"
                      transform="rotate(90, 0, 0)"
                    >
                      {total}
                    </text>
                  )}
                </svg>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {segments.map((seg) => (
                  <button
                    key={seg.theme}
                    type="button"
                    onClick={() => onThemeSelect(seg.theme)}
                    className="flex items-center gap-1.5 text-[11px] text-echo-text-muted transition-colors hover:text-echo-text"
                  >
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ background: getThemeColor(seg.theme) }}
                    />
                    {formatThemeLabel(seg.theme)}
                  </button>
                ))}
              </div>
            </div>

            {/* Column chart - top 5 only, no others */}
            <div className="mb-6 rounded-2xl bg-echo-card p-5 shadow-[0_1px_12px_rgba(44,40,37,0.05)] dark:shadow-[0_1px_12px_rgba(0,0,0,0.2)]">
              <p className="text-[13px] font-medium uppercase tracking-wider text-echo-text-muted">
                Count by theme
              </p>
              <p className="mt-1 text-[12px] font-light text-echo-text-muted">
                Thoughts shared per theme this week
              </p>
              <div className="mt-4 flex h-[140px] items-end gap-1.5">
                {segments.map((seg, index) => (
                  <motion.button
                    key={seg.theme}
                    type="button"
                    onClick={() => onThemeSelect(seg.theme)}
                    className="flex flex-1 flex-col items-center gap-1"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ duration: 0.35, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div
                      className="w-full min-w-[14px] max-w-[40px] overflow-hidden rounded-t-md transition-opacity hover:opacity-90"
                      style={{
                        height: `${Math.max(6, (seg.count / columnMaxCount) * 110)}px`,
                        background: getThemeColor(seg.theme),
                      }}
                      title={`${formatThemeLabel(seg.theme)}: ${seg.count}`}
                    />
                    <span className="text-[9px] font-light text-echo-text-muted">
                      {seg.count}
                    </span>
                  </motion.button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {segments.map((seg) => (
                  <button
                    key={seg.theme}
                    type="button"
                    onClick={() => onThemeSelect(seg.theme)}
                    className="flex items-center gap-1.5 text-[11px] text-echo-text-muted transition-colors hover:text-echo-text"
                  >
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: getThemeColor(seg.theme) }}
                    />
                    <span className="truncate">{formatThemeLabel(seg.theme)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tappable list */}
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-echo-text-muted">
              Tap to explore thoughts
            </p>
            <ul className="flex flex-col gap-2">
              {aggregates.map((item, index) => (
                <motion.li
                  key={item.theme}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: 0.1 + index * 0.04,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onThemeSelect(item.theme)}
                    className="flex w-full items-center gap-4 rounded-2xl bg-echo-card p-4 text-left shadow-[0_1px_12px_rgba(44,40,37,0.05)] dark:shadow-[0_1px_12px_rgba(0,0,0,0.2)] transition-colors hover:bg-echo-bg-warm active:scale-[0.99] touch-manipulation"
                  >
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-echo-accent"
                      style={{ background: `${getThemeColor(item.theme)}30` }}
                    >
                      <Users size={22} style={{ color: getThemeColor(item.theme) }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-sans text-[15px] font-normal text-echo-text">
                        {formatThemeLabel(item.theme)}
                      </p>
                      <p className="mt-0.5 text-[12px] font-light text-echo-text-muted">
                        {item.count} {item.count === 1 ? "thought" : "thoughts"}
                        {item.resolution_count > 0 &&
                          ` · ${item.resolution_count} shared what helped`}
                      </p>
                    </div>
                    <ChevronRight size={20} className="shrink-0 text-echo-text-muted" />
                  </button>
                </motion.li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
