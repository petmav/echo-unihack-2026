"use client";

import { useState, useCallback } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";

import type { LocalThought } from "@/lib/types";
import { MAX_RESOLUTION_LENGTH } from "@/lib/constants";

interface DelayedPromptSheetProps {
  thought: LocalThought | null;
  onDismiss: () => void;
  onResolve: (messageId: string, resolutionText: string) => void;
}

export function DelayedPromptSheet({
  thought,
  onDismiss,
  onResolve,
}: DelayedPromptSheetProps) {
  const [resolutionText, setResolutionText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleResolve = useCallback(() => {
    if (!thought || !resolutionText.trim()) return;

    const text = resolutionText;
    setSubmitted(true);

    // Brief delay so the user sees the success state before close
    setTimeout(() => {
      onResolve(thought.message_id, text);
    }, 700);
  }, [thought, resolutionText, onResolve]);

  const handleDismiss = useCallback(() => {
    setResolutionText("");
    setSubmitted(false);
    onDismiss();
  }, [onDismiss]);

  // Reset local state when a new thought is shown
  const handleOpen = () => {
    setResolutionText("");
    setSubmitted(false);
  };

  return (
    <AnimatePresence onExitComplete={handleOpen}>
      {thought && (
        <>
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 z-100 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleDismiss}
            aria-label="Dismiss prompt"
          />

          {/* Sheet */}
          <motion.div
            className="absolute bottom-0 left-1/2 z-101 w-full max-w-xl -translate-x-1/2 rounded-t-3xl bg-echo-card px-6 pb-12 pt-4"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{
              duration: 0.35,
              ease: [0.22, 1, 0.36, 1],
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Did something shift for the better?"
          >
            {/* Handle */}
            <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-echo-text-muted opacity-35" />

            {/* Header row */}
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles
                  size={18}
                  className="shrink-0 text-echo-accent"
                  aria-hidden="true"
                />
                <h3 className="font-serif text-[17px] font-normal leading-snug text-echo-text">
                  Did something shift for the better?
                </h3>
              </div>

              <button
                onClick={handleDismiss}
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-echo-text-muted transition-colors active:bg-black/5"
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>

            {/* Celebratory sub-heading */}
            <p className="mb-4 text-[13.5px] font-light leading-relaxed text-echo-text-soft">
              You haven&apos;t mentioned this in a while — that&apos;s worth
              noticing. If something helped, sharing it could mean the world to
              someone else going through the same thing.
            </p>

            {/* Thought preview */}
            <div className="mb-5 rounded-xl bg-echo-highlight p-3.5">
              <p className="line-clamp-3 text-[13px] font-light italic leading-relaxed text-echo-text-soft">
                &ldquo;{thought.raw_text}&rdquo;
              </p>
            </div>

            {/* Resolution input or success state */}
            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="flex flex-col items-center gap-2 py-4 text-center"
                >
                  <Sparkles size={22} className="text-echo-accent" />
                  <p className="text-[13.5px] font-light text-echo-text-soft">
                    Thank you for sharing — it helps others feel less alone.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="input"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <textarea
                    value={resolutionText}
                    onChange={(e) =>
                      setResolutionText(
                        e.target.value.slice(0, MAX_RESOLUTION_LENGTH)
                      )
                    }
                    placeholder="What helped you with this? (optional — you can also just dismiss)"
                    className="w-full min-h-[80px] resize-none rounded-xl border border-echo-highlight-border bg-echo-highlight p-3 font-sans text-[13.5px] font-light leading-relaxed text-echo-text outline-none focus:border-echo-accent"
                    aria-label="What helped you?"
                  />

                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={handleResolve}
                      disabled={!resolutionText.trim()}
                      className="flex-1 rounded-full bg-echo-accent py-2.5 text-[13px] font-medium text-white transition-opacity disabled:opacity-40"
                    >
                      Share what helped
                    </button>

                    <button
                      onClick={handleDismiss}
                      className="rounded-full border border-echo-highlight-border px-4 py-2.5 text-[13px] font-light text-echo-text-muted transition-colors active:bg-black/5"
                    >
                      Not now
                    </button>
                  </div>

                  <p className="mt-3 text-center text-[11px] font-light leading-snug text-echo-text-muted">
                    Your words are anonymised before storage and shown verbatim
                    to others — never paraphrased.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
