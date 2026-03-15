"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";

import type { ThoughtResponse } from "@/lib/types";
import { getMatchStrengthLabel } from "@/lib/constants";
import { AVATARS, COLORS, getDeterministicPersona, getSafePersona } from "@/lib/persona";

interface ThoughtCardProps {
  thought: ThoughtResponse;
  index: number;
  isVisible: boolean;
  isNew?: boolean;
  onTap?: (thought: ThoughtResponse) => void;
}

const STAGGER_DELAY = 0.08;



export function ThoughtCard({
  thought,
  index,
  isVisible,
  isNew,
  onTap,
}: ThoughtCardProps) {
  const hasResolution = thought.has_resolution;
  const matchStrength = getMatchStrengthLabel(thought.similarity_score);
  
  const persona = getSafePersona(thought.persona || getDeterministicPersona(thought.message_id));
  const avatar = AVATARS[persona.face] || AVATARS[0];
  const color = COLORS.find(c => c.hex === persona.color) || COLORS[0];

  return (
    <motion.div
      layout
      className={`mb-2.5 rounded-[18px] p-4 shadow-[0_1px_12px_rgba(44,40,37,0.05)] dark:shadow-[0_1px_12px_rgba(0,0,0,0.2)] sm:p-5 touch-manipulation ${
        hasResolution
          ? "cursor-pointer border border-echo-highlight-border bg-echo-highlight active:scale-[0.985] min-h-[44px]"
          : "bg-echo-card"
      }${isNew ? " ring-1 ring-echo-accent/20" : ""}`}
      initial={isNew ? { opacity: 0, y: -20, scale: 0.97 } : { opacity: 0, y: 14 }}
      animate={
        isVisible
          ? { opacity: 1, y: 0, scale: 1 }
          : isNew ? { opacity: 0, y: -20, scale: 0.97 } : { opacity: 0, y: 14 }
      }
      transition={
        isNew
          ? { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
          : { duration: 0.4, delay: index * STAGGER_DELAY, ease: [0.22, 1, 0.36, 1] }
      }
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
        <span className="mb-2 inline-flex rounded-full bg-echo-highlight px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.18em] text-echo-text-muted">
          {matchStrength}
        </span>
      )}
      
      <div className="flex items-start gap-4">
        <motion.div 
          className="h-14 w-14 shrink-0 rounded-full flex items-center justify-center bg-echo-bg-warm"
          style={{
            boxShadow: `0 2px 10px ${color.hex}40`
          }}
        >
          <img 
            src={avatar.src} 
            alt={avatar.label} 
            className="h-9 w-9 object-contain"
            style={{ filter: color.filter }}
          />
        </motion.div>

        <div className="flex-1">
          <p className="text-[14px] font-light leading-[1.7] text-echo-text sm:text-[14.5px]">
            {thought.humanised_text}
          </p>
          {hasResolution && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-echo-accent-glow px-3 py-1 text-[11.5px] font-medium text-echo-accent">
              ✦ someone found a way through
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface ThoughtCardListProps {
  thoughts: ThoughtResponse[];
  visibleCount: number;
  newThoughtIds?: Set<string>;
  onCardTap: (thought: ThoughtResponse) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export function ThoughtCardList({
  thoughts,
  visibleCount,
  newThoughtIds,
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
          isNew={newThoughtIds?.has(thought.message_id)}
          onTap={onCardTap}
        />
      ))}

      {onLoadMore && (
        <>
          {isLoadingMore && (
            <div className="flex justify-center py-6" aria-busy="true" aria-live="polite">
              <span className="sr-only">Loading more thoughts</span>
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
