"use client";

import { useState, useCallback } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronLeft, Shield } from "lucide-react";

import type { LocalThought } from "@/lib/types";
import { MAX_RESOLUTION_LENGTH, RESOLUTION_PROMPT_WEEKS } from "@/lib/constants";

import { FutureLetterInput } from "./FutureLetterInput";

interface HistoryPanelProps {
  thoughts: LocalThought[];
  onBack: () => void;
  onResolve: (messageId: string, resolutionText: string) => void;
  onSaveFutureLetter: (messageId: string, theme: string, text: string) => void;
}

function isOlderThanThreshold(timestamp: number): boolean {
  const cutoff = Date.now() - RESOLUTION_PROMPT_WEEKS * 7 * 24 * 60 * 60 * 1000;
  return timestamp < cutoff;
}

function formatRelativeDate(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return "1 month ago";
  return `${Math.floor(diffDays / 30)} months ago`;
}

export function HistoryPanel({
  thoughts,
  onBack,
  onResolve,
  onSaveFutureLetter,
}: HistoryPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolveText, setResolveText] = useState("");
  const [optimisticResolved, setOptimisticResolved] = useState<
    Record<string, string>
  >({});

  const handleResolve = useCallback(
    (messageId: string) => {
      if (!resolveText.trim()) return;

      const text = resolveText;

      setOptimisticResolved((prev) => ({ ...prev, [messageId]: text }));
      setExpandedId(null);
      setResolveText("");

      onResolve(messageId, text);
    },
    [resolveText, onResolve]
  );

  const handleToggleExpand = (messageId: string) => {
    if (expandedId === messageId) {
      setExpandedId(null);
      setResolveText("");
    } else {
      setExpandedId(messageId);
      setResolveText("");
    }
  };

  return (
    <div className="echo-scroll-area flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
      {/* Header */}
      <div
        className="sticky top-0 z-50 flex items-center gap-3 px-5 pb-4 pt-4 backdrop-blur-2xl"
        style={{ background: "rgba(250, 247, 242, 0.88)" }}
      >
        <button
          onClick={onBack}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-echo-text transition-colors active:bg-black/5"
          aria-label="Go back"
        >
          <ChevronLeft size={22} />
        </button>
        <h2 className="font-serif text-xl font-normal tracking-tight text-echo-text">
          Past thoughts
        </h2>
      </div>

      <div className="mx-auto w-full max-w-xl px-4 pb-12">
        {/* Privacy banner */}
        <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-echo-highlight p-3 text-echo-text-soft">
          <Shield size={18} className="shrink-0" />
          <p className="text-[11.5px] font-light leading-snug">
            This data lives only on your device and is never uploaded.
          </p>
        </div>

        {thoughts.length === 0 && (
          <div className="mt-16 text-center">
            <p className="text-sm font-light text-echo-text-muted">
              No thoughts yet. Tap the logo to share one.
            </p>
          </div>
        )}

        {thoughts.map((item) => {
          const isOptimisticallyResolved =
            item.message_id in optimisticResolved;
          const isResolved = item.is_resolved || isOptimisticallyResolved;
          const resolutionDisplayText =
            optimisticResolved[item.message_id] ?? item.resolution_text;
          const shouldPulse =
            !isResolved && isOlderThanThreshold(item.timestamp);

          return (
            <motion.div
              key={item.message_id}
              layout
              className={`mb-2 rounded-2xl bg-white p-4 shadow-[0_1px_6px_rgba(44,40,37,0.04)]`}
              animate={{ opacity: isResolved ? 0.55 : 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              {/* Thought text (truncated) */}
              <p className="mb-2.5 line-clamp-2 text-sm font-normal leading-relaxed text-echo-text">
                {item.raw_text}
              </p>

              {/* Match count — shown when available */}
              {item.match_count != null && item.match_count > 0 && (
                <p className="mb-2.5 text-[11.5px] font-light text-echo-text-muted">
                  {item.match_count} {item.match_count === 1 ? "person has" : "people have"} felt something like this
                </p>
              )}

              {/* Meta row */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-echo-text-muted">
                  {formatRelativeDate(item.timestamp)}
                </span>

                <motion.button
                  onClick={() =>
                    !isResolved && handleToggleExpand(item.message_id)
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-full border-[1.5px]"
                  animate={{
                    borderColor: isResolved
                      ? "#7BAE7F"
                      : shouldPulse
                        ? "#C8856C"
                        : "#B5ADA6",
                    backgroundColor: isResolved ? "#7BAE7F" : "transparent",
                    color: isResolved
                      ? "#FFFFFF"
                      : shouldPulse
                        ? "#C8856C"
                        : "#B5ADA6",
                    scale: isOptimisticallyResolved ? [1, 1.2, 1] : 1,
                  }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  style={
                    shouldPulse
                      ? {
                          animation:
                            "echo-pulse-resolve 2s ease-in-out infinite",
                        }
                      : undefined
                  }
                  aria-label={isResolved ? "Resolved" : "Mark as resolved"}
                  disabled={isResolved}
                  whileTap={!isResolved ? { scale: 0.9 } : undefined}
                >
                  <Check size={16} />
                </motion.button>
              </div>

              {/* Resolution text — shows after optimistic resolve or from data */}
              <AnimatePresence>
                {isResolved && resolutionDisplayText && (
                  <motion.div
                    initial={
                      isOptimisticallyResolved
                        ? { opacity: 0, height: 0, marginTop: 0 }
                        : false
                    }
                    animate={{ opacity: 1, height: "auto", marginTop: 10 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="overflow-hidden rounded-[10px] bg-echo-green-soft p-2.5 text-[12.5px] font-light italic leading-relaxed text-echo-text-soft"
                  >
                    &quot;{resolutionDisplayText}&quot;
                  </motion.div>
                )}
              </AnimatePresence>

              {/* "Future You" letter — shown after resolving */}
              {isResolved && !item.future_letter && (
                <FutureLetterInput
                  messageId={item.message_id}
                  themeCategory={item.theme_category}
                  onSave={onSaveFutureLetter}
                />
              )}

              {/* Resolve input (expanded) */}
              <AnimatePresence>
                {expandedId === item.message_id && !isResolved && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="mt-3 overflow-hidden"
                  >
                    <textarea
                      value={resolveText}
                      onChange={(e) =>
                        setResolveText(
                          e.target.value.slice(0, MAX_RESOLUTION_LENGTH)
                        )
                      }
                      placeholder="What helped you with this?"
                      className="w-full min-h-[72px] rounded-xl border border-echo-highlight-border bg-echo-highlight p-3 font-sans text-[13.5px] font-light leading-relaxed text-echo-text outline-none resize-none focus:border-echo-accent"
                    />
                    <button
                      onClick={() => handleResolve(item.message_id)}
                      disabled={!resolveText.trim()}
                      className="mt-2 rounded-full bg-echo-accent px-4.5 py-2 text-[12.5px] font-medium text-white transition-opacity disabled:opacity-40"
                    >
                      Share what helped
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
