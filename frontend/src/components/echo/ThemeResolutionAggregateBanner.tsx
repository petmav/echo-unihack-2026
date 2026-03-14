"use client";

import { motion } from "framer-motion";
import { MessageSquareHeart } from "lucide-react";

import type { ThemeCountSummary } from "@/lib/api";

interface ThemeResolutionAggregateBannerProps {
  stats: ThemeCountSummary;
  themeLabel: string;
}

function formatPeople(count: number): string {
  return count.toLocaleString("en-AU");
}

export function ThemeResolutionAggregateBanner({
  stats,
  themeLabel,
}: ThemeResolutionAggregateBannerProps) {
  return (
    <motion.div
      className="mx-4 mb-4 rounded-2xl border border-[#D4DDE7] bg-[#F4F8FC] p-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
      data-testid="theme-resolution-aggregate-banner"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#DDE9F3]">
          <MessageSquareHeart size={15} className="text-[#4D657A]" />
        </div>
        <h3 className="font-serif text-[15px] font-normal text-[#394B5C]">
          What helped in this space
        </h3>
      </div>

      <p className="text-[13.5px] font-light leading-[1.7] text-[#526576]">
        Across {themeLabel.toLowerCase()}, {formatPeople(stats.resolution_count)} people later
        shared what helped. That&apos;s {stats.resolution_rate}% of similar thoughts so far.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-[18px] border border-white/70 bg-white/80 p-3.5">
          <p className="text-[20px] font-light tracking-tight text-[#324454]">
            {formatPeople(stats.resolution_count)}
          </p>
          <p className="mt-1 text-[11.5px] font-light text-[#6A7B8A]">
            shared what helped
          </p>
        </div>
        <div className="rounded-[18px] border border-white/70 bg-white/80 p-3.5">
          <p className="text-[20px] font-light tracking-tight text-[#324454]">
            {stats.resolution_rate}%
          </p>
          <p className="mt-1 text-[11.5px] font-light text-[#6A7B8A]">
            of similar thoughts
          </p>
        </div>
      </div>

      <p className="mt-3 text-[11px] font-light italic text-[#758593]">
        Anonymous aggregate from similar thoughts only.
      </p>
    </motion.div>
  );
}
