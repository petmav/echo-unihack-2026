"use client";

import { motion } from "framer-motion";
import { Heart, Phone, ExternalLink, MessageCircle } from "lucide-react";

import { SAFETY_RESOURCES, RISK_THEMES } from "@/lib/constants";

interface SafetyBannerProps {
  themeCategory: string;
}

const CONTACT_ICONS = {
  phone: Phone,
  text: MessageCircle,
  url: ExternalLink,
} as const;

export function shouldShowSafetyBanner(themeCategory: string): boolean {
  return RISK_THEMES.has(themeCategory);
}

export function SafetyBanner({ themeCategory }: SafetyBannerProps) {
  if (!shouldShowSafetyBanner(themeCategory)) return null;

  return (
    <motion.div
      className="mx-4 mb-4 rounded-2xl border border-[#E8C8C0] bg-[#FFF5F2] p-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      role="alert"
      data-testid="safety-banner"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8C8C0]/40">
          <Heart size={16} className="text-[#B5564D]" />
        </div>
        <h3 className="font-serif text-[15px] font-normal text-[#7A3B34]">
          {SAFETY_RESOURCES.heading}
        </h3>
      </div>

      <p className="mb-4 text-[13px] font-light leading-relaxed text-[#8B5E58]">
        {SAFETY_RESOURCES.body}
      </p>

      <div className="space-y-2">
        {SAFETY_RESOURCES.contacts.map((contact) => {
          const Icon = CONTACT_ICONS[contact.type];
          const isLink = contact.type === "url";

          return (
            <div
              key={contact.label}
              className="flex items-center gap-3 rounded-xl bg-white/60 px-3.5 py-2.5"
            >
              <Icon size={14} className="shrink-0 text-[#B5564D]" />
              <div className="min-w-0 flex-1">
                <span className="text-[12px] font-medium text-[#7A3B34]">
                  {contact.label}
                </span>
                {isLink ? (
                  <a
                    href={contact.value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1.5 text-[12px] font-light text-[#B5564D] underline underline-offset-2"
                  >
                    Find help near you
                  </a>
                ) : (
                  <span className="ml-1.5 text-[12px] font-light text-[#8B5E58]">
                    {contact.value}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3.5 text-[11px] font-light italic text-[#B5564D]/70">
        This information is shown based on the topic of your thought. It is not
        logged or recorded in any way.
      </p>
    </motion.div>
  );
}
