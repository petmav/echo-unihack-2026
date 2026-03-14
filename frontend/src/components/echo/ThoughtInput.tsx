"use client";

import { useRef, useEffect, useState } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { Send, X, Mic, MicOff } from "lucide-react";

import { MAX_THOUGHT_LENGTH } from "@/lib/constants";
import { SurroundingTopics } from "@/components/echo/SurroundingTopics";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

interface ThoughtInputProps {
  isOpen: boolean;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  /** When provided, topic bubbles are clickable and open the topic screen. */
  onTopicClick?: (themeKey: string) => void;
}

const WARN_THRESHOLD = 250;

export function ThoughtInput({
  isOpen,
  value,
  onChange,
  onSubmit,
  onClose,
  onTopicClick,
}: ThoughtInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isListening, transcript, isSupported, toggleListening, stopListening } = useSpeechRecognition();
  const preRecordValueRef = useRef("");
  const [showLimitWarning, setShowLimitWarning] = useState(false);

  useEffect(() => {
    if (isListening && value.length >= MAX_THOUGHT_LENGTH) {
      stopListening();
      setShowLimitWarning(true);
    }
  }, [value.length, isListening, stopListening]);

  useEffect(() => {
    if (showLimitWarning) {
      const timer = setTimeout(() => setShowLimitWarning(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [showLimitWarning]);

  useEffect(() => {
    if (isOpen && textareaRef.current && !isListening) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isListening]);

  const handleMicClick = () => {
    if (!isListening) {
      preRecordValueRef.current = value;
    }
    toggleListening();
  };

  useEffect(() => {
    if (isListening && transcript) {
      const baseText = preRecordValueRef.current;
      const separator =
        baseText && !baseText.endsWith(" ") && baseText.length > 0 && !baseText.endsWith("\n")
          ? " "
          : "";
      const newText = baseText + separator + transcript;
      onChange(newText.slice(0, MAX_THOUGHT_LENGTH));
    }
  }, [transcript, isListening, onChange]);

  useEffect(() => {
    if (!isOpen && isListening) {
      toggleListening();
    }
  }, [isOpen, isListening, toggleListening]);

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
          <SurroundingTopics animate onTopicClick={onTopicClick} />
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
            className="w-full max-w-lg"
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
              <div className="flex items-center gap-2">
                <AnimatePresence>
                  {showLimitWarning && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="text-xs font-medium text-red-500"
                    >
                      Max length reached
                    </motion.span>
                  )}
                </AnimatePresence>
                <span
                  className="text-xs tabular-nums font-normal transition-colors"
                  style={{
                    color: isOverWarnThreshold ? "#C8856C" : "#B5ADA6",
                  }}
                >
                  {value.length}/{MAX_THOUGHT_LENGTH}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {isSupported && (
                  <button
                    onClick={handleMicClick}
                    className={`flex h-[50px] w-[50px] items-center justify-center rounded-full transition-all active:scale-[0.93] ${
                      isListening
                        ? "bg-red-50 text-red-500 shadow-[0_4px_16px_rgba(239,68,68,0.2)]"
                        : "bg-black/5 text-echo-text-soft hover:bg-black/10"
                    }`}
                    title={isListening ? "Stop listening" : "Start dictating"}
                    aria-label={isListening ? "Stop dictating" : "Start dictating"}
                  >
                    {isListening ? <MicOff size={20} className="animate-pulse" /> : <Mic size={20} />}
                  </button>
                )}
                <button
                  disabled={!isSubmittable}
                  onClick={() => {
                    if (isListening) toggleListening();
                    onSubmit();
                  }}
                  className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-echo-accent text-white shadow-[0_4px_16px_rgba(200,133,108,0.3)] transition-all active:scale-[0.93] disabled:opacity-35"
                  aria-label="Submit thought"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
