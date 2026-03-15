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
      className="mx-4 mb-4 rounded-2xl border border-echo-safety-border bg-echo-safety-bg p-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      role="alert"
      data-testid="safety-banner"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-echo-safety-border/40">
          <Heart size={16} className="text-echo-safety-icon" />
        </div>
        <h3 className="font-serif text-[15px] font-normal text-echo-safety-heading">
          {SAFETY_RESOURCES.heading}
        </h3>
      </div>

      <p className="mb-4 text-[13px] font-light leading-relaxed text-echo-safety-text">
        {SAFETY_RESOURCES.body}
      </p>

      <div className="space-y-2">
        {SAFETY_RESOURCES.contacts.map((contact) => {
          const Icon = CONTACT_ICONS[contact.type];
          const isLink = contact.type === "url";

          return (
            <div
              key={contact.label}
              className="flex items-center gap-3 rounded-xl bg-echo-safety-card-bg px-3.5 py-2.5"
            >
              <Icon size={14} className="shrink-0 text-echo-safety-icon" />
              <div className="min-w-0 flex-1">
                <span className="text-[12px] font-medium text-echo-safety-heading">
                  {contact.label}
                </span>
                {isLink ? (
                  <a
                    href={contact.value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1.5 text-[12px] font-light text-echo-safety-icon underline underline-offset-2"
                  >
                    Find help near you
                  </a>
                ) : (
                  <span className="ml-1.5 text-[12px] font-light text-echo-safety-text">
                    {contact.value}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3.5 text-[11px] font-light italic text-echo-safety-icon/70">
        This information is shown based on the topic of your thought. It is not
        logged or recorded in any way.
      </p>
    </motion.div>
  );
}
