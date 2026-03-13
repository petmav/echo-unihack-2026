"use client";

import { ChevronLeft } from "lucide-react";

import { EchoLogo } from "./EchoLogo";

interface AboutPanelProps {
  onBack: () => void;
}

export function AboutPanel({ onBack }: AboutPanelProps) {
  return (
    <div className="echo-scroll-area flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-0 z-50 flex items-center gap-3 px-5 pb-4 pt-4 backdrop-blur-2xl" style={{ background: "rgba(250, 247, 242, 0.88)" }}>
        <button
          onClick={onBack}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-echo-text transition-colors active:bg-black/5"
          aria-label="Go back"
        >
          <ChevronLeft size={22} />
        </button>
        <h2 className="font-serif text-xl font-normal tracking-tight text-echo-text">
          About
        </h2>
      </div>

      <div className="px-4 pb-12">
        {/* Hero */}
        <div className="py-5 text-center">
          <div className="flex justify-center">
            <EchoLogo size={80} animate={false} />
          </div>
          <p className="mt-4 font-serif text-[22px] font-light italic leading-snug text-echo-text">
            You are not alone.
          </p>
        </div>

        <div className="mb-3 rounded-2xl bg-white p-5 shadow-[0_1px_12px_rgba(44,40,37,0.05)]">
          <h3 className="mb-2 text-sm font-medium text-echo-text">
            How Echo works
          </h3>
          <p className="text-[13.5px] font-light leading-relaxed text-echo-text-soft">
            You share a thought. Echo anonymises it, then finds others who have
            felt the same way. You see how many people share your experience —
            and what helped them through it.
          </p>
        </div>

        <div className="mb-3 rounded-2xl bg-white p-5 shadow-[0_1px_12px_rgba(44,40,37,0.05)]">
          <h3 className="mb-2 text-sm font-medium text-echo-text">
            Privacy by design
          </h3>
          <p className="text-[13.5px] font-light leading-relaxed text-echo-text-soft">
            Your raw words never leave your device. The server only sees
            anonymised emotions — no names, no details, no trace.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-[0_1px_12px_rgba(44,40,37,0.05)]">
          <h3 className="mb-2 text-sm font-medium text-echo-text">
            Built for UNIHACK 2026
          </h3>
          <p className="text-[13.5px] font-light leading-relaxed text-echo-text-soft">
            Echo was built in 48 hours by a team that believes mental health
            support shouldn&apos;t require clinical gatekeeping or surrendering
            your privacy.
          </p>
        </div>
      </div>
    </div>
  );
}
