"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

import type { ThoughtResponse } from "@/lib/types";
import { AVATARS, COLORS, getDeterministicPersona, getSafePersona } from "@/lib/persona";

interface BottomSheetProps {
  thought: ThoughtResponse | null;
  onClose: () => void;
  onSaveAnchor?: (thought: ThoughtResponse) => void;
  isAnchorSaved?: boolean;
}

export function BottomSheet({
  thought,
  onClose,
  onSaveAnchor,
  isAnchorSaved = false,
}: BottomSheetProps) {
  const resolutionText = thought?.resolution_text?.trim();

  useEffect(() => {
    if (!thought) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [thought, onClose]);

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

            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-echo-text-soft transition-colors active:bg-black/5"
              aria-label="Close sheet"
            >
              <X size={18} />
            </button>

            <div className="mb-5 flex items-center gap-3">
              <div 
                className="h-12 w-12 shrink-0 rounded-full flex items-center justify-center bg-echo-bg-warm"
                style={{
                  boxShadow: `0 2px 8px ${COLORS.find(c => c.hex === getSafePersona(thought.persona || getDeterministicPersona(thought.message_id)).color)?.hex || "#000"}30`
                }}
              >
                <img 
                  src={AVATARS[getSafePersona(thought.persona || getDeterministicPersona(thought.message_id)).face]?.src} 
                  alt="Persona" 
                  className="h-8 w-8 object-contain"
                  style={{ filter: COLORS.find(c => c.hex === getSafePersona(thought.persona || getDeterministicPersona(thought.message_id)).color)?.filter }}
                />
              </div>
              <h3 className="font-serif text-[18px] font-normal text-echo-text">
                What helped
              </h3>
            </div>

            <p className="mb-4.5 text-[14.5px] font-light leading-[1.75] text-echo-text">
              {resolutionText ?? "We couldn't load what helped this time."}
            </p>

            {resolutionText && (
              <button
                type="button"
                className="mb-4 inline-flex min-h-[44px] items-center justify-center rounded-full border border-echo-highlight-border bg-echo-highlight px-4 py-2.5 text-[12.5px] font-medium text-echo-accent transition-opacity disabled:cursor-default disabled:opacity-70"
                onClick={() => onSaveAnchor?.(thought)}
                disabled={isAnchorSaved}
                data-testid="save-anchor-button"
              >
                {isAnchorSaved ? "Saved on this device" : "Save as anchor"}
              </button>
            )}

            <p className="text-xs italic text-echo-text-muted">
              Written by someone who&apos;s been there.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
