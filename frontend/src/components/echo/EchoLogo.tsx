"use client";

import { useMemo } from "react";

import { motion } from "framer-motion";

import type { PresenceLevel } from "@/lib/types";

interface EchoLogoProps {
  size?: number;
  animate?: boolean;
  presenceLevel?: PresenceLevel;
  onClick?: () => void;
  className?: string;
}

const BREATHE_DURATION = 7;

/**
 * Visual parameters per presence level. Higher levels produce
 * deeper hues, stronger ripples, and a slower, more resonant
 * breathing rhythm — as if more people are breathing together.
 */
const PRESENCE_VISUAL = [
  { arcHue: "#C8856C", glowOpacity: 0.08, arcBoost: 0, durationScale: 1.0 },
  { arcHue: "#C07A60", glowOpacity: 0.10, arcBoost: 0.05, durationScale: 0.95 },
  { arcHue: "#B86F54", glowOpacity: 0.13, arcBoost: 0.10, durationScale: 0.90 },
  { arcHue: "#AE6248", glowOpacity: 0.17, arcBoost: 0.15, durationScale: 0.85 },
  { arcHue: "#A4553C", glowOpacity: 0.22, arcBoost: 0.20, durationScale: 0.80 },
] as const;

function makeTransition(durationScale: number) {
  return {
    duration: BREATHE_DURATION * durationScale,
    ease: [0.42, 0, 0.58, 1] as const,
    repeat: Infinity,
    repeatType: "loop" as const,
  };
}

function makeBreathVariants(durationScale: number) {
  return {
    idle: { scale: 1 },
    breathe: {
      scale: [1, 1.08, 1.06, 1.08, 1],
      transition: makeTransition(durationScale),
    },
  };
}

function makeRippleVariants(
  maxScale: number,
  baseOpacity: number,
  boost: number,
  durationScale: number
) {
  const boostedOpacity = Math.min(baseOpacity + boost, 1);
  return {
    idle: { scale: 1, opacity: boostedOpacity },
    breathe: {
      scale: [1, maxScale, maxScale, maxScale, 1],
      opacity: [
        boostedOpacity,
        boostedOpacity * 0.4,
        boostedOpacity * 0.4,
        boostedOpacity * 0.4,
        boostedOpacity,
      ],
      transition: makeTransition(durationScale),
    },
  };
}

export function EchoLogo({
  size = 100,
  animate = true,
  presenceLevel = 0,
  onClick,
  className,
}: EchoLogoProps) {
  const animState = animate ? "breathe" : "idle";
  const visual = PRESENCE_VISUAL[presenceLevel];

  const breatheVariants = useMemo(
    () => makeBreathVariants(visual.durationScale),
    [visual.durationScale]
  );

  const outerRipple = useMemo(
    () => makeRippleVariants(1.12, 0.25, visual.arcBoost, visual.durationScale),
    [visual.arcBoost, visual.durationScale]
  );
  const middleRipple = useMemo(
    () => makeRippleVariants(1.08, 0.45, visual.arcBoost, visual.durationScale),
    [visual.arcBoost, visual.durationScale]
  );
  const innerRipple = useMemo(
    () => makeRippleVariants(1.04, 0.7, visual.arcBoost, visual.durationScale),
    [visual.arcBoost, visual.durationScale]
  );

  return (
    <motion.div
      className={className}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : undefined, lineHeight: 0 }}
      whileTap={onClick ? { scale: 0.95 } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? "Share what's on your mind" : "Echo logo"}
      data-presence-level={presenceLevel}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="echo-bg-glow" cx="0.4" cy="0.45" r="0.65">
            <stop offset="0%" stopColor="#D49A82" stopOpacity={visual.glowOpacity} />
            <stop offset="100%" stopColor={visual.arcHue} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="echo-arc-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#D49A82" />
            <stop offset="100%" stopColor="#A06B55" />
          </linearGradient>
        </defs>

        {/* Ambient glow */}
        <motion.circle
          cx="256"
          cy="256"
          r="240"
          fill="url(#echo-bg-glow)"
          variants={breatheVariants}
          animate={animState}
          style={{ originX: "256px", originY: "256px" }}
        />

        {/* Outer arc */}
        <motion.path
          d="M 180 380 A 175 175 0 0 1 180 132"
          stroke={visual.arcHue}
          strokeWidth="18"
          strokeLinecap="round"
          fill="none"
          variants={outerRipple}
          animate={animState}
          style={{ originX: "256px", originY: "256px" }}
        />

        {/* Middle arc */}
        <motion.path
          d="M 215 345 A 125 125 0 0 1 215 167"
          stroke={visual.arcHue}
          strokeWidth="22"
          strokeLinecap="round"
          fill="none"
          variants={middleRipple}
          animate={animState}
          style={{ originX: "256px", originY: "256px" }}
        />

        {/* Inner arc */}
        <motion.path
          d="M 250 310 A 75 75 0 0 1 250 202"
          stroke="url(#echo-arc-grad)"
          strokeWidth="26"
          strokeLinecap="round"
          fill="none"
          variants={innerRipple}
          animate={animState}
          style={{ originX: "256px", originY: "256px" }}
        />

        {/* Core dot */}
        <motion.circle
          cx="290"
          cy="256"
          r="32"
          fill="url(#echo-arc-grad)"
          variants={breatheVariants}
          animate={animState}
          style={{ originX: "290px", originY: "256px" }}
        />

        {/* Specular highlight */}
        <circle cx="282" cy="248" r="10" fill="white" opacity="0.15" />

        {/* Wordmark */}
        <text
          x="256"
          y="460"
          textAnchor="middle"
          fontFamily="'Fraunces', Georgia, serif"
          fontSize="56"
          fontWeight="300"
          fill="#A06B55"
          letterSpacing="8"
          opacity="0.8"
        >
          echo
        </text>
      </svg>
    </motion.div>
  );
}

export function EchoLogoSmall() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 512 512"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="echo-sm-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#D49A82" />
          <stop offset="100%" stopColor="#A06B55" />
        </linearGradient>
      </defs>
      <path d="M 180 380 A 175 175 0 0 1 180 132" stroke="#C8856C" strokeWidth="24" strokeLinecap="round" fill="none" opacity="0.2" />
      <path d="M 215 345 A 125 125 0 0 1 215 167" stroke="#C8856C" strokeWidth="28" strokeLinecap="round" fill="none" opacity="0.35" />
      <path d="M 250 310 A 75 75 0 0 1 250 202" stroke="url(#echo-sm-grad)" strokeWidth="32" strokeLinecap="round" fill="none" opacity="0.6" />
      <circle cx="290" cy="256" r="40" fill="url(#echo-sm-grad)" />
    </svg>
  );
}
