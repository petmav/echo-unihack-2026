"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

import type { QuietWin } from "@/lib/quietWins";

interface QuietWinBannerProps {
  quietWin: QuietWin;
}

function formatGapDays(days: number): string {
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function QuietWinBanner({ quietWin }: QuietWinBannerProps) {
  return (
    <motion.div
      className="mx-4 mb-4 rounded-2xl border border-[#E3D3C8] bg-[#FCF6F1] p-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      data-testid="quiet-win-banner"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F1DED0]">
          <Sparkles size={15} className="text-[#A96D4F]" />
        </div>
        <h3 className="font-serif text-[15px] font-normal text-[#7D4D34]">
          A quiet win
        </h3>
      </div>

      <p className="text-[13.5px] font-light leading-[1.7] text-[#865741]">
        You had gone {formatGapDays(quietWin.gapDays)} without mentioning{" "}
        {quietWin.themeLabel}. That stretch still counts, even if this feeling
        is here again today.
      </p>

      <p className="mt-2 text-[11px] font-light italic text-[#A06B55]/75">
        Noticed only from your local history on this device.
      </p>
    </motion.div>
  );
}
