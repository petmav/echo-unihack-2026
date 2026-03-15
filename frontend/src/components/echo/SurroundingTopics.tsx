"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { SURROUNDING_TOPICS } from "@/lib/constants";

/**
 * Positions spread across the full screen including well inside the mid-zone.
 * Only the tight logo/text area (~25-75% x, 40-62% y) is avoided.
 */
const ORBIT_POSITIONS: {
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  transform: string;
}[] = [
  // Perimeter corners
  { top: "8%",  left: "5%",  transform: "translate(0, 0)" },
  { top: "8%",  right: "5%", transform: "translate(0, 0)" },
  { bottom: "8%", left: "5%",  transform: "translate(0, 0)" },
  { bottom: "8%", right: "5%", transform: "translate(0, 0)" },

  // Mid-depth left column — pushed well in from edge
  { top: "22%", left: "20%", transform: "translate(0, 0)" },
  { top: "36%", left: "18%", transform: "translate(0, 0)" },
  { top: "50%", left: "20%", transform: "translate(0, 0)" },
  { top: "64%", left: "18%", transform: "translate(0, 0)" },
  { top: "76%", left: "22%", transform: "translate(0, 0)" },

  // Mid-depth right column — pushed well in from edge
  { top: "22%", right: "20%", transform: "translate(0, 0)" },
  { top: "36%", right: "18%", transform: "translate(0, 0)" },
  { top: "50%", right: "20%", transform: "translate(0, 0)" },
  { top: "64%", right: "18%", transform: "translate(0, 0)" },
  { top: "76%", right: "22%", transform: "translate(0, 0)" },

  // Above/below logo — horizontally centred, clear of the breathing animation
  { top: "12%", left: "38%", transform: "translate(0, 0)" },
  { top: "12%", right: "38%", transform: "translate(0, 0)" },
  { bottom: "14%", left: "38%", transform: "translate(0, 0)" },
  { bottom: "14%", right: "38%", transform: "translate(0, 0)" },
];

// Normalised [0–100, 0–100] coords for each position (right/bottom converted to left/top equiv).
// Used for distance-based repulsion when picking new positions.
const POSITION_COORDS: [number, number][] = ORBIT_POSITIONS.map((p) => {
  const x = p.left  != null ? parseFloat(p.left)
           : p.right != null ? 100 - parseFloat(p.right)
           : 50;
  const y = p.top    != null ? parseFloat(p.top)
           : p.bottom != null ? 100 - parseFloat(p.bottom)
           : 50;
  return [x, y];
});

function dist(a: [number, number], b: [number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Pick a position index biased towards spots far from occupied positions. */
function pickSpreadPosition(
  available: number[],
  occupied: number[],
): number {
  if (available.length === 1) return available[0];
  const occupiedCoords = occupied.map((i) => POSITION_COORDS[i]);
  // Score each candidate by its min-distance to any occupied slot
  const scores = available.map((idx) => {
    if (occupiedCoords.length === 0) return 1;
    const minD = Math.min(...occupiedCoords.map((c) => dist(POSITION_COORDS[idx], c)));
    return minD * minD; // square to amplify spread preference
  });
  const total = scores.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < available.length; i++) {
    r -= scores[i];
    if (r <= 0) return available[i];
  }
  return available[available.length - 1];
}

const BUBBLES_VISIBLE = 8;
// How long between swap events (ms)
const BUBBLE_SWAP_INTERVAL_MS = 3500;

function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = (seed + i * 7 + 11) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface SlotState {
  topicIndex: number;
  positionIndex: number;
  id: number;       // unique key so AnimatePresence detects swap
  seq: number;      // insertion sequence — lowest = oldest (FIFO)
}

interface SurroundingTopicsProps {
  className?: string;
  animate?: boolean;
  onTopicClick?: (themeKey: string) => void;
}

let uidCounter = 0;
function uid() { return ++uidCounter; }
let seqCounter = 0;
function nextSeq() { return ++seqCounter; }

export function SurroundingTopics({
  className = "",
  animate = true,
  onTopicClick,
}: SurroundingTopicsProps) {
  const topicsPool = SURROUNDING_TOPICS;
  const positionsPool = ORBIT_POSITIONS;

  // Initialise slots — each slot has a topic and a position
  const [slots, setSlots] = useState<SlotState[]>(() => {
    const shuffledT = shuffle([...Array(topicsPool.length).keys()], 42);
    const shuffledP = shuffle([...Array(positionsPool.length).keys()], 99);
    return Array.from({ length: BUBBLES_VISIBLE }, (_, i) => ({
      topicIndex: shuffledT[i % shuffledT.length],
      positionIndex: shuffledP[i % shuffledP.length],
      id: uid(),
      seq: nextSeq(),
    }));
  });

  // Track which topic/position indices are currently displayed
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  useEffect(() => {
    const interval = setInterval(() => {
      setSlots((prev) => {
        // FIFO: always replace the oldest 1–3 bubbles
        const count = Math.floor(Math.random() * 3) + 1;
        const indices = [...prev.keys()]
          .sort((a, b) => prev[a].seq - prev[b].seq)
          .slice(0, count);

        const next = [...prev];
        const usedTopics = new Set(next.map((s) => s.topicIndex));
        const usedPositions = new Set(next.map((s) => s.positionIndex));

        for (const slotIdx of indices) {
          usedTopics.delete(next[slotIdx].topicIndex);
          usedPositions.delete(next[slotIdx].positionIndex);

          const availableTopics = [...Array(topicsPool.length).keys()].filter(
            (i) => !usedTopics.has(i)
          );
          const newTopicIndex =
            availableTopics.length > 0
              ? availableTopics[Math.floor(Math.random() * availableTopics.length)]
              : Math.floor(Math.random() * topicsPool.length);

          const availablePositions = [...Array(positionsPool.length).keys()].filter(
            (i) => !usedPositions.has(i)
          );
          const occupiedPositions = [...usedPositions];
          const newPositionIndex =
            availablePositions.length > 0
              ? pickSpreadPosition(availablePositions, occupiedPositions)
              : Math.floor(Math.random() * positionsPool.length);

          next[slotIdx] = { topicIndex: newTopicIndex, positionIndex: newPositionIndex, id: uid(), seq: nextSeq() };
          usedTopics.add(newTopicIndex);
          usedPositions.add(newPositionIndex);
        }

        return next;
      });
    }, BUBBLE_SWAP_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [topicsPool.length, positionsPool.length]);

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      aria-hidden={!onTopicClick}
    >
      <AnimatePresence>
        {slots.map((slot, i) => {
          const topic = topicsPool[slot.topicIndex];
          const pos = positionsPool[slot.positionIndex];
          return (
            <motion.button
              type="button"
              key={slot.id}
              className="bubble-shine absolute inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full whitespace-nowrap border border-black/10 dark:border-white/20 px-4 py-2.5 text-[11px] font-light tracking-wide text-echo-text-muted bg-white dark:bg-white/10 dark:text-white/70 cursor-pointer touch-manipulation outline-none hover:bg-echo-bg-warm/80 dark:hover:bg-white/15 active:scale-[0.98] pointer-events-auto sm:min-h-0 sm:min-w-0 sm:px-3 sm:py-1.5"
              style={{
                top: pos.top,
                left: pos.left,
                right: pos.right,
                bottom: pos.bottom,
                transform: "translate(-50%, -50%)",
              }}
              initial={animate ? { opacity: 0, scale: 0.6 } : false}
              animate={{
                opacity: 1,
                scale: [1, 1.05, 1.03, 1.05, 1],
                y: [0, -3, 0],
              }}
              exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.3 } }}
              transition={{
                opacity: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
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
          );
        })}
      </AnimatePresence>
    </div>
  );
}
