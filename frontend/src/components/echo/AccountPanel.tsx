"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Shield, Trash2, ChevronRight } from "lucide-react";
import type { PersonaConfig } from "@/lib/types";
import { AVATARS, COLORS, DEFAULT_PERSONA, getSafePersona } from "@/lib/persona";

interface AccountPanelProps {
  email: string;
  onBack: () => void;
  onDeleteAccount: () => void;
  onToggleNotifications: (enabled: boolean) => void;
  notificationsEnabled: boolean;
  persona: PersonaConfig;
  onPersonaChange: (newPersona: PersonaConfig) => void;
}

const DEFAULT_COLOR = COLORS.find(c => c.hex === DEFAULT_PERSONA.color) || COLORS[1]; // Rose gold fallback

/** Compute slider track background for dynamic fill effect */
function sliderBg(value: number, min: number, max: number) {
  const pct = ((value - min) / (max - min)) * 100;
  return `linear-gradient(to right, var(--echo-accent) ${pct}%, var(--echo-bg-warm) ${pct}%)`;
}

export function AccountPanel({
  email,
  onBack,
  onDeleteAccount,
  onToggleNotifications,
  notificationsEnabled,
  persona,
  onPersonaChange,
}: AccountPanelProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const [selectedIdx, setSelectedIdx] = useState(
    Math.min(persona.face ?? 0, AVATARS.length - 1)
  );

  const savedColor =
    COLORS.find((c) => c.hex === (persona.color ?? "")) ?? DEFAULT_COLOR;
  const [activeColor, setActiveColor] = useState(savedColor);

  const [avatarOpacity, setAvatarOpacity] = useState(0.95);

  const handleNav = (delta: number) => {
    const next = (selectedIdx + delta + AVATARS.length) % AVATARS.length;
    setSelectedIdx(next);
    onPersonaChange({ ...persona, face: next });
  };

  const handleColorSelect = (col: (typeof COLORS)[0]) => {
    setActiveColor(col);
    onPersonaChange({ ...persona, color: col.hex });
  };

  const currentAvatar = AVATARS[selectedIdx];

  return (
    <div className="echo-scroll-area flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
      {/* Header */}
      <div
        className="sticky top-0 z-50 flex items-center gap-3 px-5 pb-4 pt-4 backdrop-blur-2xl"
        style={{ background: "var(--echo-header-blur)" }}
      >
        <button
          onClick={onBack}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-echo-text transition-colors active:bg-echo-bg-warm"
          aria-label="Go back"
        >
          <ChevronLeft size={22} />
        </button>
        <h2 className="font-serif text-xl font-normal tracking-tight text-echo-text">
          Account
        </h2>
      </div>

      <div className="mx-auto w-full max-w-xl px-4 pb-10">
        {/* Avatar customiser card */}
        <div className="mb-6 overflow-hidden rounded-3xl bg-echo-card p-6 shadow-[0_4px_24px_rgba(44,40,37,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
          <p className="mb-6 text-center text-[12px] font-semibold uppercase tracking-widest text-echo-text-soft">
            Customize Your Avatar
          </p>

          {/* Stage: large preview + controls */}
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
            {/* Large preview circle */}
            <div
              className="flex h-44 w-44 shrink-0 items-center justify-center rounded-full bg-echo-bg"
              style={{
                boxShadow: `0 0 0 3px ${activeColor.hex}60, 0 6px 32px rgba(180,150,130,0.18)`,
              }}
            >
              <img
                src={currentAvatar.src}
                alt={currentAvatar.label}
                className="h-32 w-32 object-contain transition-all duration-300"
                style={{
                  opacity: avatarOpacity,
                  filter: activeColor.filter,
                }}
              />
            </div>

            {/* Controls */}
            <div className="flex w-full flex-1 flex-col gap-5">
              {/* Opacity slider */}
              <div>
                <label className="mb-2 block text-[12px] font-medium text-echo-text-soft">
                  Opacity
                </label>
                <input
                  type="range"
                  min="0.3"
                  max="1"
                  step="0.05"
                  value={avatarOpacity}
                  onChange={(e) => setAvatarOpacity(parseFloat(e.target.value))}
                  className="persona-slider w-full"
                  style={{ background: sliderBg(avatarOpacity, 0.3, 1) }}
                />
              </div>

              {/* Tone swatches */}
              <div>
                <label className="mb-2 block text-[12px] font-medium text-echo-text-soft">
                  Tone
                </label>
                <div className="flex flex-wrap gap-3">
                  {COLORS.map((col) => (
                    <button
                      key={col.hex}
                      aria-label={col.label}
                      onClick={() => handleColorSelect(col)}
                      className="h-8 w-8 rounded-full transition-transform active:scale-90"
                      style={{
                        backgroundColor: col.hex,
                        boxShadow:
                          activeColor.hex === col.hex
                            ? `0 0 0 2px var(--echo-card), 0 0 0 4px ${col.hex}`
                            : "0 1px 4px rgba(0,0,0,0.14)",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Avatar navigator */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              onClick={() => handleNav(-1)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-echo-bg-warm text-echo-text-soft transition-all active:scale-90 hover:bg-echo-accent-soft hover:text-echo-accent"
              aria-label="Previous avatar"
            >
              <ChevronLeft size={20} />
            </button>

            {/* 3-icon peek strip */}
            <div className="flex flex-1 items-center justify-center gap-3">
              {[-1, 0, 1].map((offset) => {
                const idx =
                  (selectedIdx + offset + AVATARS.length) % AVATARS.length;
                const isCurrent = offset === 0;
                const size = isCurrent ? 72 : 52;

                return (
                  <button
                    key={offset}
                    onClick={() => {
                      const next =
                        (selectedIdx + offset + AVATARS.length) %
                        AVATARS.length;
                      setSelectedIdx(next);
                      onPersonaChange({ ...persona, face: next });
                    }}
                    className="flex shrink-0 items-center justify-center rounded-full bg-echo-card transition-all active:scale-95"
                    style={{
                      width: `${size}px`,
                      height: `${size}px`,
                      boxShadow: isCurrent
                        ? `0 0 0 2px ${activeColor.hex}, 0 4px 16px rgba(188,141,122,0.25)`
                        : "0 2px 10px rgba(44,40,37,0.08)",
                      opacity: isCurrent ? 1 : 0.45,
                    }}
                    aria-label={AVATARS[idx].label}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={AVATARS[idx].src}
                      alt={AVATARS[idx].label}
                      style={{
                        width: isCurrent ? "52px" : "36px",
                        height: isCurrent ? "52px" : "36px",
                        objectFit: "contain",
                        filter: isCurrent ? activeColor.filter : "none",
                      }}
                    />
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handleNav(1)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-echo-bg-warm text-echo-text-soft transition-all active:scale-90 hover:bg-echo-accent-soft hover:text-echo-accent"
              aria-label="Next avatar"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Dot progress indicator */}
          <div className="mt-4 flex justify-center gap-1.5">
            {AVATARS.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === selectedIdx ? "16px" : "6px",
                  height: "6px",
                  backgroundColor:
                    i === selectedIdx ? activeColor.hex : "var(--echo-text-muted)",
                }}
              />
            ))}
          </div>

          <p className="mt-3 text-center text-[11px] font-light text-echo-text-muted">
            {currentAvatar.label}
          </p>
        </div>

        {/* Account info card */}
        <div className="overflow-hidden rounded-2xl bg-echo-card shadow-[0_1px_12px_rgba(44,40,37,0.05)] dark:shadow-[0_1px_12px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-4 text-sm text-echo-text">
            <span className="font-normal">Email</span>
            <span className="text-[13.5px] font-light text-echo-text-soft">
              {email}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-border px-4 py-4 text-sm text-echo-text">
            <span className="font-normal">Delayed prompts</span>
            <button
              onClick={() => onToggleNotifications(!notificationsEnabled)}
              className={`relative h-[26px] w-[44px] rounded-full border-none transition-colors ${
                notificationsEnabled ? "bg-echo-accent" : "bg-echo-toggle-off"
              }`}
              role="switch"
              aria-checked={notificationsEnabled}
              aria-label="Toggle delayed prompts"
            >
              <div
                className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.12)] transition-[left] ${
                  notificationsEnabled ? "left-[21px]" : "left-[3px]"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between px-4 py-4 text-sm text-echo-text">
            <span className="font-normal">Password</span>
            <span className="cursor-pointer text-[13.5px] font-normal text-echo-accent">
              Change
            </span>
          </div>
        </div>

        {/* Privacy banner */}
        <div className="my-5 flex items-center gap-2.5 rounded-xl bg-echo-highlight p-3 text-echo-text-soft">
          <Shield size={18} className="shrink-0 text-echo-accent" />
          <p className="text-[11.5px] font-light leading-snug">
            Echo stores only your email. Your thoughts live exclusively on this
            device.
          </p>
        </div>

        {/* Delete account */}
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-echo-card py-[15px] font-sans text-sm font-medium text-echo-red shadow-[0_1px_12px_rgba(44,40,37,0.05)] active:opacity-70 dark:shadow-[0_1px_12px_rgba(0,0,0,0.25)]"
          >
            <Trash2 size={18} />
            Delete account
          </button>
        ) : (
          <div className="rounded-2xl bg-echo-card p-4 shadow-[0_1px_12px_rgba(44,40,37,0.05)] dark:shadow-[0_1px_12px_rgba(0,0,0,0.25)]">
            <p className="mb-3 text-center text-sm font-normal text-echo-text">
              This will permanently delete your account and clear all local
              data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl bg-echo-bg-warm py-3 text-sm font-medium text-echo-text transition-colors hover:bg-echo-accent-soft"
              >
                Cancel
              </button>
              <button
                onClick={onDeleteAccount}
                className="flex-1 rounded-xl bg-echo-red py-3 text-sm font-medium text-white transition-opacity hover:opacity-85"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slider styles — thumb colour uses accent token */}
      <style>{`
        .persona-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 99px;
          outline: none;
          cursor: pointer;
        }
        .persona-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--echo-accent);
          border: 2px solid var(--echo-card);
          box-shadow: 0 1px 6px rgba(0,0,0,0.20);
          cursor: pointer;
          transition: transform 0.15s;
        }
        .persona-slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        .persona-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--echo-accent);
          border: 2px solid var(--echo-card);
          box-shadow: 0 1px 6px rgba(0,0,0,0.20);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
