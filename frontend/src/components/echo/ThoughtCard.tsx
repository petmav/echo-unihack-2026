"use client";

import { motion } from "framer-motion";

import type { ThoughtResponse } from "@/lib/types";

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

  return (
    <motion.div
      className={`mb-2.5 rounded-[18px] p-5 shadow-[0_1px_12px_rgba(44,40,37,0.05)] ${
        hasResolution
          ? "cursor-pointer border border-echo-highlight-border bg-echo-highlight active:scale-[0.985]"
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
      role={hasResolution ? "button" : undefined}
      tabIndex={hasResolution ? 0 : undefined}
      aria-label={
        hasResolution
          ? "Tap to see what helped this person"
          : undefined
      }
    >
      <p className="text-[14.5px] font-light leading-[1.7] text-echo-text">
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
}

export function ThoughtCardList({
  thoughts,
  visibleCount,
  onCardTap,
}: ThoughtCardListProps) {
  return (
    <div className="px-4 pb-24 pt-5">
      {thoughts.map((thought, index) => (
        <ThoughtCard
          key={thought.message_id}
          thought={thought}
          index={index}
          isVisible={index < visibleCount}
          onTap={onCardTap}
        />
      ))}
    </div>
  );
}
