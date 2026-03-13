"use client";

import { motion } from "framer-motion";
import { Mail } from "lucide-react";

import type { FutureLetter } from "@/lib/types";

interface FutureYouBannerProps {
  letter: FutureLetter;
}

function formatLetterDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
  });
}

export function FutureYouBanner({ letter }: FutureYouBannerProps) {
  return (
    <motion.div
      className="mx-4 mb-4 rounded-2xl border border-[#C5D4C8] bg-[#F2F7F3] p-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      data-testid="future-you-banner"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C5D4C8]/50">
          <Mail size={15} className="text-[#5A7D5E]" />
        </div>
        <h3 className="font-serif text-[15px] font-normal text-[#3D5940]">
          A note from past you
        </h3>
      </div>

      <p className="mb-2 text-[13.5px] font-light leading-[1.7] text-[#4A6B4E]">
        &ldquo;{letter.letter_text}&rdquo;
      </p>

      <p className="text-[11px] font-light italic text-[#5A7D5E]/70">
        Written by you in {formatLetterDate(letter.timestamp)}
      </p>
    </motion.div>
  );
}
