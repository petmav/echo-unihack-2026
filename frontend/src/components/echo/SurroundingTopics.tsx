"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { SURROUNDING_TOPICS } from "@/lib/constants";

/**
 * Positions for topic labels around the perimeter. Bubbles stay in corners
 * and edges only — never in the center zone (logo, "tap to share", "others
 * breathing" text). Each entry has position and transform so the label
 * stays on screen.
 */
const ORBIT_POSITIONS: {
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  transform: string;
}[] = [
  { top: "12%", left: "8%", transform: "translate(0, -50%)" },
  { top: "14%", left: "18%", transform: "translate(0, -50%)" },
  { top: "14%", right: "18%", transform: "translate(0, -50%)" },
  { top: "12%", right: "8%", transform: "translate(0, -50%)" },
  { left: "6%", top: "28%", transform: "translate(0, -50%)" },
  { left: "6%", bottom: "28%", transform: "translate(0, -50%)" },
  { right: "6%", top: "28%", transform: "translate(0, -50%)" },
  { right: "6%", bottom: "28%", transform: "translate(0, -50%)" },
  { bottom: "14%", left: "18%", transform: "translate(-50%, 0)" },
  { bottom: "12%", left: "8%", transform: "translate(0, 0)" },
  { bottom: "14%", right: "18%", transform: "translate(-50%, 0)" },
  { bottom: "12%", right: "8%", transform: "translate(0, 0)" },
];

const CYCLE_DURATION_MS = 6000;
const BUBBLES_PER_BATCH = 8;

function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = (seed + i * 7 + 11) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface SurroundingTopicsProps {
  /** Optional class for the wrapper (e.g. pointer-events-none). */
  className?: string;
  /** Slightly stagger entrance. */
  animate?: boolean;
  /** Called when user taps a topic bubble (theme key for API). */
  onTopicClick?: (themeKey: string) => void;
}

export function SurroundingTopics({
  className = "",
  animate = true,
  onTopicClick,
}: SurroundingTopicsProps) {
  const [batch, setBatch] = useState(0);

  const { topics, positions } = useMemo(() => {
    const shuffledTopics = shuffle([...SURROUNDING_TOPICS], batch);
    const shuffledPositions = shuffle([...ORBIT_POSITIONS], batch + 100);
    return {
      topics: shuffledTopics.slice(0, BUBBLES_PER_BATCH),
      positions: shuffledPositions.slice(0, BUBBLES_PER_BATCH),
    };
  }, [batch]);

  useEffect(() => {
    const id = setInterval(() => setBatch((b) => b + 1), CYCLE_DURATION_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      aria-hidden={!onTopicClick}
    >
      <AnimatePresence mode="popLayout">
        {topics.map((topic, i) => (
          <motion.button
            type="button"
            key={`${batch}-${topic.themeKey}-${i}`}
            className="bubble-shine absolute inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full whitespace-nowrap border border-white/25 px-4 py-2.5 text-[11px] font-light tracking-wide text-echo-text-muted bg-white cursor-pointer touch-manipulation outline-none hover:bg-echo-bg-warm/80 active:scale-[0.98] pointer-events-auto sm:min-h-0 sm:min-w-0 sm:px-3 sm:py-1.5"
            style={{
              top: positions[i].top,
              left: positions[i].left,
              right: positions[i].right,
              bottom: positions[i].bottom,
              transform: positions[i].transform,
            }}
            initial={animate ? { opacity: 0, scale: 0.6 } : false}
            animate={{
              opacity: 1,
              scale: [1, 1.05, 1.03, 1.05, 1],
              y: [0, -3, 0],
            }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{
              opacity: { duration: 0.4, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] },
              scale: {
                duration: 5,
                delay: i * 0.15,
                repeat: Infinity,
                ease: "easeInOut",
              },
              y: {
                duration: 3 + (i % 2),
                delay: i * 0.1,
                repeat: Infinity,
                ease: "easeInOut",
              },
            }}
            onClick={() => onTopicClick?.(topic.themeKey)}
            aria-label={`Explore others' thoughts on ${topic.label}`}
          >
            {topic.label}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
