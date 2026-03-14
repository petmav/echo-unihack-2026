"use client";

import { motion, AnimatePresence } from "framer-motion";

import type { ThoughtResponse } from "@/lib/types";

interface BottomSheetProps {
  thought: ThoughtResponse | null;
  onClose: () => void;
}

export function BottomSheet({ thought, onClose }: BottomSheetProps) {
  return (
    <AnimatePresence>
      {thought && (
        <>
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 z-100 bg-black/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-label="Close sheet"
          />

          {/* Sheet */}
          <motion.div
            className="absolute bottom-0 left-1/2 z-101 w-full max-w-xl -translate-x-1/2 max-h-[65%] overflow-y-auto rounded-t-3xl bg-echo-card px-6 pb-12 pt-4"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{
              duration: 0.35,
              ease: [0.22, 1, 0.36, 1],
            }}
            role="dialog"
            aria-modal="true"
            aria-label="What helped"
          >
            {/* Handle */}
            <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-echo-text-muted opacity-35" />

            <h3 className="mb-3.5 font-serif text-[17px] font-normal text-echo-text">
              What helped
            </h3>

            <p className="mb-4.5 text-[14.5px] font-light leading-[1.75] text-echo-text">
              {thought.resolution_text}
            </p>

            <p className="text-xs italic text-echo-text-muted">
              Written by someone who&apos;s been there.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
