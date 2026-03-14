"use client";

import { motion } from "framer-motion";
import { Bookmark } from "lucide-react";

import type { SavedAnchor } from "@/lib/types";

interface SavedAnchorsBannerProps {
  anchors: SavedAnchor[];
  themeLabel: string;
}

function formatSavedDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
}

export function SavedAnchorsBanner({
  anchors,
  themeLabel,
}: SavedAnchorsBannerProps) {
  const previewAnchors = anchors.slice(0, 2);
  const hiddenCount = anchors.length - previewAnchors.length;

  return (
    <motion.div
      className="mx-4 mb-4 rounded-2xl border border-[#D6DACC] bg-[#F5F7F0] p-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
      data-testid="saved-anchors-banner"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E1E8D5]">
          <Bookmark size={15} className="text-[#5C7050]" />
        </div>
        <h3 className="font-serif text-[15px] font-normal text-[#44553A]">
          Saved anchors for this space
        </h3>
      </div>

      <p className="text-[13.5px] font-light leading-[1.7] text-[#5A6B4F]">
        These are lines you chose to keep nearby for {themeLabel}.
      </p>

      <div className="mt-3 space-y-3">
        {previewAnchors.map((anchor) => (
          <div
            key={anchor.message_id}
            className="rounded-[18px] border border-white/70 bg-white/70 p-3.5"
            data-testid="saved-anchor-item"
          >
            <p className="text-[13px] font-light italic leading-[1.7] text-[#4D5E44]">
              &ldquo;{anchor.resolution_text}&rdquo;
            </p>
            <p className="mt-2 line-clamp-2 text-[11.5px] font-light leading-[1.6] text-[#6B7A61]">
              {anchor.humanised_text}
            </p>
            <p className="mt-1 text-[11px] font-light italic text-[#7A8771]">
              Saved {formatSavedDate(anchor.saved_at)}
            </p>
          </div>
        ))}
      </div>

      {hiddenCount > 0 && (
        <p className="mt-3 text-[11.5px] font-light text-[#6B7A61]">
          {hiddenCount} more {hiddenCount === 1 ? "anchor is" : "anchors are"} stored on this
          device for later.
        </p>
      )}

      <p className="mt-3 text-[11px] font-light italic text-[#718068]">
        Stored only on this device.
      </p>
    </motion.div>
  );
}
