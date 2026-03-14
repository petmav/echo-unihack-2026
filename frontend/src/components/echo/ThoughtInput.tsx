"use client";

import { useRef, useEffect } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { Send, X } from "lucide-react";

import { MAX_THOUGHT_LENGTH } from "@/lib/constants";
import { useTheme } from "@/lib/theme";

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
  const { theme } = useTheme();
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
          className="fixed inset-0 z-70 flex flex-col items-center justify-center p-6"
          style={{
            background: theme === "dark"
              ? "#1A1816"
              : "rgba(250, 247, 242, 0.97)",
            backdropFilter: theme === "dark" ? "none" : "blur(24px)",
            WebkitBackdropFilter: theme === "dark" ? "none" : "blur(24px)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-6 top-4 flex h-10 w-10 items-center justify-center rounded-full text-echo-text-soft transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          {/* Input area */}
          <motion.div
            className="w-full max-w-lg"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.35,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="rounded-[22px] bg-white dark:bg-white/10 shadow-[0_6px_32px_rgba(44,40,37,0.07)] dark:shadow-[0_6px_32px_rgba(0,0,0,0.3)]">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) =>
                  onChange(e.target.value.slice(0, MAX_THOUGHT_LENGTH))
                }
                onKeyDown={handleKeyDown}
                placeholder="What's weighing on you right now?"
                className="w-full min-h-[120px] rounded-t-[22px] border-none bg-transparent px-[22px] pt-[22px] pb-1 font-sans text-base font-light leading-relaxed text-echo-text dark:text-white outline-none resize-none placeholder:italic placeholder:text-echo-text-muted dark:placeholder:text-white/30"
                aria-label="Share your thought"
              />

              <div className="flex items-center justify-between px-[22px] pb-[16px]">
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
                  className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-echo-accent dark:bg-[#D4896A] text-white shadow-[0_4px_16px_rgba(200,133,108,0.3)] dark:shadow-[0_6px_24px_rgba(212,137,106,0.5)] transition-all active:scale-[0.93] disabled:opacity-35"
                  aria-label="Submit thought"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
