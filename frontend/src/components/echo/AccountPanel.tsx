"use client";

import { useState } from "react";
import { ChevronLeft, Shield, Trash2, ChevronRight } from "lucide-react";
import type { PersonaConfig } from "@/lib/types";

interface AccountPanelProps {
  email: string;
  onBack: () => void;
  onDeleteAccount: () => void;
  onToggleNotifications: (enabled: boolean) => void;
  notificationsEnabled: boolean;
  persona: PersonaConfig;
  onPersonaChange: (newPersona: PersonaConfig) => void;
}

const AVATARS = [
  { label: "Persona 1", src: "/Persona1.svg" },
  { label: "Persona 2", src: "/Persona2.svg" },
  { label: "Persona 3", src: "/Persona3.svg" },
  { label: "Persona 4", src: "/Persona4.svg" },
  { label: "Persona 5", src: "/Persona5.svg" },
  { label: "Persona 6", src: "/Persona6.svg" },
  { label: "Persona 7", src: "/Persona7.svg" },
  { label: "Persona 8", src: "/Persona8.svg" },
];

/**
 * Color palette entries.
 * Every filter starts with grayscale(1) sepia(1) to normalise ALL SVGs
 * to the same warm-sepia baseline regardless of their original colours.
 * hue-rotate() then swings that baseline to the target palette colour,
 * ensuring 100% consistent tinting across all 8 personas.
 */
/**
 * SVG fills are now pure greyscale (perceptual luma only).
 * Pipeline: sepia(1) maps greyscale → deterministic warm-sepia baseline (~35°).
 *           hue-rotate(Δ) swings to target hue.  Δ = target_hue − 35°.
 *           saturate / brightness match the swatch's chroma and lightness.
 * No grayscale() step needed — SVGs are already single-channel.
 */
const COLORS = [
  {
    hex: "#C8B8A2",
    label: "Warm cream",
    // ~33° → Δ = -2°. Very desaturated, light.
    filter: "sepia(1) hue-rotate(-2deg) saturate(0.50) brightness(1.20) contrast(1.05)",
  },
  {
    hex: "#BC8D7A",
    label: "Rose gold",
    // ~16° → Δ = -19°.
    filter: "sepia(1) hue-rotate(-19deg) saturate(1.10) brightness(0.95) contrast(1.10)",
  },
  {
    hex: "#7E9E8A",
    label: "Sage green",
    // ~149° → Δ = +114°.
    filter: "sepia(1) hue-rotate(114deg) saturate(0.85) brightness(0.90) contrast(1.10)",
  },
  {
    hex: "#9E8EB4",
    label: "Lavender",
    // ~266° → Δ = +231°.
    filter: "sepia(1) hue-rotate(231deg) saturate(1.30) brightness(0.88) contrast(1.10)",
  },
  {
    hex: "#6B5B3E",
    label: "Taupe",
    // ~37° → Δ = +2°. Dark and desaturated.
    filter: "sepia(1) hue-rotate(2deg) saturate(0.65) brightness(0.65) contrast(1.15)",
  },
];

const DEFAULT_COLOR = COLORS[1]; // Rose gold

/** Compute slider track background for dynamic fill effect */
function sliderBg(value: number, min: number, max: number) {
  const pct = ((value - min) / (max - min)) * 100;
  return `linear-gradient(to right, #BC8D7A ${pct}%, #E8DED6 ${pct}%)`;
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

  // Find saved color object, fall back to rose gold
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
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-50 flex items-center gap-3 px-5 pb-4 pt-4 backdrop-blur-2xl"
        style={{ background: "rgba(250, 247, 242, 0.88)" }}
      >
        <button
          onClick={onBack}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-echo-text transition-colors active:bg-black/5"
          aria-label="Go back"
        >
          <ChevronLeft size={22} />
        </button>
        <h2 className="font-serif text-xl font-normal tracking-tight text-echo-text">
          Account
        </h2>
      </div>

      <div className="mx-auto w-full max-w-xl px-4 pb-10">
        {/* ── Avatar customizer card ── */}
        <div className="mb-6 overflow-hidden rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(44,40,37,0.08)]">
          <p className="mb-6 text-center text-[12px] font-semibold uppercase tracking-widest text-[#9E8A78]">
            Customize Your Avatar
          </p>

          {/* Stage: large preview + controls */}
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
            {/* Large preview circle */}
            <div
              className="flex h-44 w-44 shrink-0 items-center justify-center rounded-full bg-[#FAF7F2]"
              style={{
                boxShadow: `0 0 0 3px ${activeColor.hex}60, 0 6px 32px rgba(180,150,130,0.18)`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
                <label className="mb-2 block text-[12px] font-medium text-[#9E8A78]">
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

              {/* Accent color swatches */}
              <div>
                <label className="mb-2 block text-[12px] font-medium text-[#9E8A78]">
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
                            ? `0 0 0 2px #fff, 0 0 0 4px ${col.hex}`
                            : "0 1px 4px rgba(0,0,0,0.12)",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Avatar navigator ── */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              onClick={() => handleNav(-1)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5EDE8] text-[#9E8A78] transition-all active:scale-90 hover:bg-[#ECDDD8]"
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
                    className="flex shrink-0 items-center justify-center rounded-full bg-white transition-all active:scale-95"
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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5EDE8] text-[#9E8A78] transition-all active:scale-90 hover:bg-[#ECDDD8]"
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
                    i === selectedIdx ? activeColor.hex : "#DDD0C8",
                }}
              />
            ))}
          </div>

          <p className="mt-3 text-center text-[11px] font-light text-[#9E8A78]">
            {currentAvatar.label}
          </p>
        </div>

        {/* ── Account info card ── */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_12px_rgba(44,40,37,0.05)]">
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-4 text-sm text-echo-text">
            <span className="font-normal">Email</span>
            <span className="text-[13.5px] font-light text-echo-text-soft">
              {email}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-black/5 px-4 py-4 text-sm text-echo-text">
            <span className="font-normal">Delayed prompts</span>
            <button
              onClick={() => onToggleNotifications(!notificationsEnabled)}
              className={`relative h-[26px] w-[44px] rounded-full border-none transition-colors ${
                notificationsEnabled ? "bg-echo-accent" : "bg-[#D0CBC5]"
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
          <Shield size={18} className="shrink-0" />
          <p className="text-[11.5px] font-light leading-snug">
            Echo stores only your email. Your thoughts live exclusively on this
            device.
          </p>
        </div>

        {/* Delete account */}
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-[15px] font-sans text-sm font-medium text-echo-red shadow-[0_1px_12px_rgba(44,40,37,0.05)] active:opacity-70"
          >
            <Trash2 size={18} />
            Delete account
          </button>
        ) : (
          <div className="rounded-2xl bg-white p-4 shadow-[0_1px_12px_rgba(44,40,37,0.05)]">
            <p className="mb-3 text-center text-sm font-normal text-echo-text">
              This will permanently delete your account and clear all local
              data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl bg-echo-bg-warm py-3 text-sm font-medium text-echo-text"
              >
                Cancel
              </button>
              <button
                onClick={onDeleteAccount}
                className="flex-1 rounded-xl bg-echo-red py-3 text-sm font-medium text-white"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slider styles */}
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
          background: #BC8D7A;
          border: 2px solid #fff;
          box-shadow: 0 1px 6px rgba(188,141,122,0.40);
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
          background: #BC8D7A;
          border: 2px solid #fff;
          box-shadow: 0 1px 6px rgba(188,141,122,0.40);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
