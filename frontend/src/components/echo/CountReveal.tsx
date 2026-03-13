"use client";

import { useState, useEffect, useRef, useCallback } from "react";

import { motion } from "framer-motion";

import { COUNT_ANIMATION_DURATION_MS } from "@/lib/constants";

interface CountRevealProps {
  targetCount: number;
  onAnimationComplete?: () => void;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function CountReveal({
  targetCount,
  onAnimationComplete,
}: CountRevealProps) {
  const [displayCount, setDisplayCount] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  const animate = useCallback(
    (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / COUNT_ANIMATION_DURATION_MS, 1);
      const easedProgress = easeOutCubic(progress);

      setDisplayCount(Math.round(easedProgress * targetCount));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        onAnimationComplete?.();
      }
    },
    [targetCount, onAnimationComplete]
  );

  useEffect(() => {
    const delay = setTimeout(() => {
      rafRef.current = requestAnimationFrame(animate);
    }, 400);

    return () => {
      clearTimeout(delay);
      cancelAnimationFrame(rafRef.current);
    };
  }, [animate]);

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
        aria-label={`${targetCount} people have felt something like this`}
      >
        {displayCount.toLocaleString()}
      </div>
      <p className="mt-2.5 text-base font-light leading-relaxed text-echo-text-soft">
        people have felt something like this
      </p>
    </motion.div>
  );
}
