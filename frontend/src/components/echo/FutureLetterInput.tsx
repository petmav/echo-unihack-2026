"use client";

import { useState } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { Mail, Send } from "lucide-react";

import { MAX_FUTURE_LETTER_LENGTH } from "@/lib/constants";

interface FutureLetterInputProps {
  messageId: string;
  themeCategory: string;
  onSave: (messageId: string, themeCategory: string, text: string) => void;
}

export function FutureLetterInput({
  messageId,
  themeCategory,
  onSave,
}: FutureLetterInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [text, setText] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    if (!text.trim()) return;
    onSave(messageId, themeCategory, text.trim());
    setIsSaved(true);
  };

  if (isSaved) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-2.5 flex items-center gap-2 rounded-[10px] bg-[#F2F7F3] p-2.5 text-[12px] font-light text-[#5A7D5E]"
      >
        <Mail size={13} />
        <span>Note saved — it&apos;ll find you when you need it.</span>
      </motion.div>
    );
  }

  return (
    <div className="mt-2.5">
      <AnimatePresence>
        {!isExpanded && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-1.5 text-[11.5px] font-light text-[#5A7D5E] transition-colors hover:text-[#3D5940]"
            data-testid="future-letter-trigger"
          >
            <Mail size={12} />
            Write a note to your future self?
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="mb-2 text-[11.5px] font-light italic text-[#5A7D5E]/80">
              If this feeling comes back, what would you want to remember?
            </p>
            <textarea
              value={text}
              onChange={(e) =>
                setText(e.target.value.slice(0, MAX_FUTURE_LETTER_LENGTH))
              }
              placeholder="Dear future me..."
              className="w-full min-h-[64px] rounded-xl border border-[#C5D4C8] bg-[#F2F7F3] p-3 font-sans text-[13px] font-light leading-relaxed text-echo-text outline-none resize-none focus:border-[#7BAE7F]"
              data-testid="future-letter-textarea"
            />
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[10.5px] text-echo-text-muted">
                {text.length}/{MAX_FUTURE_LETTER_LENGTH}
              </span>
              <button
                onClick={handleSave}
                disabled={!text.trim()}
                className="flex items-center gap-1.5 rounded-full bg-[#7BAE7F] px-3.5 py-1.5 text-[11.5px] font-medium text-white transition-opacity disabled:opacity-40"
                data-testid="future-letter-save"
              >
                <Send size={11} />
                Save note
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
