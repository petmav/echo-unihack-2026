"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";

import type { ThoughtResponse } from "@/lib/types";
import { getMatchStrengthLabel } from "@/lib/constants";

interface ThoughtCardProps {
  thought: ThoughtResponse;
  index: number;
  isVisible: boolean;
  onTap?: (thought: ThoughtResponse) => void;
}

const STAGGER_DELAY = 0.08;

export function ThoughtCard({
  thought,
  index,
  isVisible,
  onTap,
}: ThoughtCardProps) {
  const hasResolution = thought.has_resolution;
  const matchStrength = getMatchStrengthLabel(thought.similarity_score);

  return (
    <motion.div
      className={`mb-2.5 rounded-[18px] p-4 shadow-[0_1px_12px_rgba(44,40,37,0.05)] sm:p-5 touch-manipulation ${
        hasResolution
          ? "cursor-pointer border border-echo-highlight-border bg-echo-highlight active:scale-[0.985] min-h-[44px]"
          : "bg-white"
      }`}
      initial={{ opacity: 0, y: 14 }}
      animate={
        isVisible
          ? { opacity: 1, y: 0 }
          : { opacity: 0, y: 14 }
      }
      transition={{
        duration: 0.4,
        delay: index * STAGGER_DELAY,
        ease: [0.22, 1, 0.36, 1],
      }}
      onClick={() => hasResolution && onTap?.(thought)}
      onKeyDown={(e) => {
        if (hasResolution && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onTap?.(thought);
        }
      }}
      role={hasResolution ? "button" : undefined}
      tabIndex={hasResolution ? 0 : undefined}
      aria-label={
        hasResolution
          ? "Tap to see what helped this person"
          : undefined
      }
    >
      {matchStrength && (
        <span className="mb-2 inline-block text-[11px] font-medium uppercase tracking-wider text-echo-text-muted">
          {matchStrength}
        </span>
      )}
      <p className="text-[14px] font-light leading-[1.7] text-echo-text sm:text-[14.5px]">
        {thought.humanised_text}
      </p>
      {hasResolution && (
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-echo-accent-glow px-3 py-1 text-[11.5px] font-medium text-echo-accent">
          ✦ someone found a way through
        </span>
      )}
    </motion.div>
  );
}

interface ThoughtCardListProps {
  thoughts: ThoughtResponse[];
  visibleCount: number;
  onCardTap: (thought: ThoughtResponse) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export function ThoughtCardList({
  thoughts,
  visibleCount,
  onCardTap,
  onLoadMore,
  hasMore,
  isLoadingMore,
}: ThoughtCardListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onLoadMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !isLoadingMore) {
          onLoadMore();
        }
      },
      { rootMargin: "100px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, isLoadingMore]);

  return (
    <div
      className="px-4 pt-5"
      style={{ paddingBottom: "max(6rem, calc(env(safe-area-inset-bottom) + 5rem))" }}
    >
      {thoughts.map((thought, index) => (
        <ThoughtCard
          key={thought.message_id}
          thought={thought}
          index={index}
          isVisible={index < visibleCount}
          onTap={onCardTap}
        />
      ))}

      {onLoadMore && (
        <>
          {isLoadingMore && (
            <div className="flex justify-center py-6">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-echo-accent/40"
                    style={{ animationDelay: `${i * 200}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={sentinelRef} aria-hidden="true" className="h-1" />
        </>
      )}
    </div>
  );
}
