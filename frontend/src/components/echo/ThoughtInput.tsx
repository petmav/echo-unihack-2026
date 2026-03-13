"use client";

import { useRef, useEffect } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { Send, X } from "lucide-react";

import { MAX_THOUGHT_LENGTH } from "@/lib/constants";

interface ThoughtInputProps {
  isOpen: boolean;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

const WARN_THRESHOLD = 250;

export function ThoughtInput({
  isOpen,
  value,
  onChange,
  onSubmit,
  onClose,
}: ThoughtInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && value.trim()) {
      e.preventDefault();
      onSubmit();
    }
  };

  const isOverWarnThreshold = value.length > WARN_THRESHOLD;
  const isSubmittable = value.trim().length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="absolute inset-0 z-70 flex flex-col items-center justify-center p-6"
          style={{
            background: "rgba(250, 247, 242, 0.95)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-14 flex h-10 w-10 items-center justify-center rounded-full text-echo-text-soft transition-colors hover:bg-black/5"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          {/* Input area */}
          <motion.div
            className="w-full"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.35,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) =>
                onChange(e.target.value.slice(0, MAX_THOUGHT_LENGTH))
              }
              onKeyDown={handleKeyDown}
              placeholder="What's weighing on you right now?"
              className="w-full min-h-[150px] rounded-[22px] border-none bg-white p-[22px] font-sans text-base font-light leading-relaxed text-echo-text shadow-[0_6px_32px_rgba(44,40,37,0.07)] outline-none resize-none placeholder:italic placeholder:text-echo-text-muted"
              aria-label="Share your thought"
            />

            <div className="mt-3.5 flex items-center justify-between px-1">
              <span
                className="text-xs tabular-nums font-normal transition-colors"
                style={{
                  color: isOverWarnThreshold ? "#C8856C" : "#B5ADA6",
                }}
              >
                {value.length}/{MAX_THOUGHT_LENGTH}
              </span>

              <button
                disabled={!isSubmittable}
                onClick={onSubmit}
                className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-echo-accent text-white shadow-[0_4px_16px_rgba(200,133,108,0.3)] transition-all active:scale-[0.93] disabled:opacity-35"
                aria-label="Submit thought"
              >
                <Send size={20} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
