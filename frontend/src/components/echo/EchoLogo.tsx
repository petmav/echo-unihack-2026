"use client";

import { motion } from "framer-motion";

interface EchoLogoProps {
  size?: number;
  animate?: boolean;
  onClick?: () => void;
  className?: string;
}

const BREATHE_DURATION = 7;

const breatheTransition = {
  duration: BREATHE_DURATION,
  ease: [0.42, 0, 0.58, 1] as const,
  repeat: Infinity,
  repeatType: "loop" as const,
};

const breatheVariants = {
  idle: { scale: 1 },
  breathe: {
    scale: [1, 1.08, 1.06, 1.08, 1],
    transition: breatheTransition,
  },
};

const rippleVariants = (maxScale: number, baseOpacity: number) => ({
  idle: { scale: 1, opacity: baseOpacity },
  breathe: {
    scale: [1, maxScale, maxScale, maxScale, 1],
    opacity: [baseOpacity, baseOpacity * 0.4, baseOpacity * 0.4, baseOpacity * 0.4, baseOpacity],
    transition: breatheTransition,
  },
});

export function EchoLogo({
  size = 100,
  animate = true,
  onClick,
  className,
}: EchoLogoProps) {
  const animState = animate ? "breathe" : "idle";

  return (
    <motion.div
      className={className}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : undefined, lineHeight: 0 }}
      whileTap={onClick ? { scale: 0.95 } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? "Share what's on your mind" : "Echo logo"}
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
            <stop offset="0%" stopColor="#D49A82" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#C8856C" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="echo-arc-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#D49A82" />
            <stop offset="100%" stopColor="#A06B55" />
          </linearGradient>
        </defs>

        {/* Ambient glow — breathes */}
        <motion.circle
          cx="256"
          cy="256"
          r="240"
          fill="url(#echo-bg-glow)"
          variants={breatheVariants}
          animate={animState}
          style={{ originX: "256px", originY: "256px" }}
        />

        {/* Outer arc — widest echo wave */}
        <motion.path
          d="M 180 380 A 175 175 0 0 1 180 132"
          stroke="#C8856C"
          strokeWidth="18"
          strokeLinecap="round"
          fill="none"
          variants={rippleVariants(1.12, 0.25)}
          animate={animState}
          style={{ originX: "256px", originY: "256px" }}
        />

        {/* Middle arc */}
        <motion.path
          d="M 215 345 A 125 125 0 0 1 215 167"
          stroke="#C8856C"
          strokeWidth="22"
          strokeLinecap="round"
          fill="none"
          variants={rippleVariants(1.08, 0.45)}
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
          variants={rippleVariants(1.04, 0.7)}
          animate={animState}
          style={{ originX: "256px", originY: "256px" }}
        />

        {/* Core dot — the person / source */}
        <motion.circle
          cx="290"
          cy="256"
          r="32"
          fill="url(#echo-arc-grad)"
          variants={breatheVariants}
          animate={animState}
          style={{ originX: "290px", originY: "256px" }}
        />

        {/* Specular highlight on core */}
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
