"use client";

import { useState, useEffect, useRef } from "react";

import { motion, AnimatePresence } from "framer-motion";

import { COUNT_ANIMATION_DURATION_MS } from "@/lib/constants";

interface CountRevealProps {
  targetCount: number;
  liveCount?: number;
  onAnimationComplete?: () => void;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function CountReveal({
  targetCount,
  liveCount,
  onAnimationComplete,
}: CountRevealProps) {
  const [displayCount, setDisplayCount] = useState(0);
  const [delta, setDelta] = useState<number | null>(null);

  const displayCountRef = useRef(0);
  const initialDoneRef = useRef(false);
  const lastLiveCountRef = useRef(targetCount);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const onAnimationCompleteRef = useRef(onAnimationComplete);

  useEffect(() => {
    onAnimationCompleteRef.current = onAnimationComplete;
  }, [onAnimationComplete]);

  // Initial count-up animation (0 → targetCount)
  useEffect(() => {
    startTimeRef.current = null;
    initialDoneRef.current = false;
    lastLiveCountRef.current = targetCount;

    function animate(timestamp: number) {
      if (!startTimeRef.current) startTimeRef.current = timestamp;

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / COUNT_ANIMATION_DURATION_MS, 1);
      const easedProgress = easeOutCubic(progress);
      const value = Math.round(easedProgress * targetCount);

      displayCountRef.current = value;
      setDisplayCount(value);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        initialDoneRef.current = true;
        onAnimationCompleteRef.current?.();
      }
    }

    const delay = setTimeout(() => {
      rafRef.current = requestAnimationFrame(animate);
    }, 400);

    return () => {
      clearTimeout(delay);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Live count update — gentle tick-up with "+N" badge
  useEffect(() => {
    if (!liveCount) return;
    if (!initialDoneRef.current) return;
    if (liveCount <= lastLiveCountRef.current) return;

    const diff = liveCount - lastLiveCountRef.current;
    lastLiveCountRef.current = liveCount;

    setDelta(diff);

    // Animate from current display to new live count
    const from = displayCountRef.current;
    const to = liveCount;
    const duration = 900;
    const start = performance.now();

    cancelAnimationFrame(rafRef.current);
    function tick(now: number) {
      const p = Math.min((now - start) / duration, 1);
      const value = Math.round(from + (to - from) * easeOutCubic(p));
      displayCountRef.current = value;
      setDisplayCount(value);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);

    // Hide the delta badge after 4s
    const hideTimer = setTimeout(() => setDelta(null), 4000);
    return () => {
      clearTimeout(hideTimer);
      cancelAnimationFrame(rafRef.current);
    };
  }, [liveCount]);

  return (
    <motion.div
      className="pt-20 pb-6 px-6 text-center"
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div
        className="font-serif text-[68px] font-semibold leading-none tabular-nums tracking-tighter text-echo-text"
        aria-live="polite"
        aria-label={`${liveCount ?? targetCount} people have felt something like this`}
      >
        {displayCount.toLocaleString()}
      </div>
      <p className="mt-2.5 text-base font-light leading-relaxed text-echo-text-soft">
        people have felt something like this
      </p>

      {/* Live delta badge */}
      <AnimatePresence>
        {delta !== null && (
          <motion.p
            key={delta}
            className="mt-2 text-[12px] font-light tracking-wide text-echo-text-muted/70"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.4 }}
          >
            +{delta} more {delta === 1 ? "person" : "people"} just shared this feeling
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
