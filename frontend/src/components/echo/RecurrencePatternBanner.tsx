"use client";

import { motion } from "framer-motion";
import { Repeat2 } from "lucide-react";

import type { RecurrencePattern } from "@/lib/recurrencePattern";

interface RecurrencePatternBannerProps {
  pattern: RecurrencePattern;
}

function formatWindow(windowDays: number): string {
  return `${windowDays} day${windowDays === 1 ? "" : "s"}`;
}

function formatLastMention(daysAgo: number): string {
  if (daysAgo <= 0) {
    return "earlier today";
  }

  if (daysAgo === 1) {
    return "1 day ago";
  }

  return `${daysAgo} days ago`;
}

export function RecurrencePatternBanner({
  pattern,
}: RecurrencePatternBannerProps) {
  return (
    <motion.div
      className="mx-4 mb-4 rounded-2xl border border-[#D9D5C8] bg-[#F8F6EF] p-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
      data-testid="recurrence-pattern-banner"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8E2D3]">
          <Repeat2 size={15} className="text-[#7A6B59]" />
        </div>
        <h3 className="font-serif text-[15px] font-normal text-[#5D5044]">
          A returning pattern
        </h3>
      </div>

      <p className="text-[13.5px] font-light leading-[1.7] text-[#685A4D]">
        {pattern.themeLabel} has come up {pattern.mentionsInWindow} times in the
        last {formatWindow(pattern.windowDays)}. The most recent mention before
        today was {formatLastMention(pattern.lastMentionDaysAgo)}.
      </p>

      <p className="mt-2 text-[11px] font-light italic text-[#7C6D60]/75">
        Noticed only from your local history on this device.
      </p>
    </motion.div>
  );
}
