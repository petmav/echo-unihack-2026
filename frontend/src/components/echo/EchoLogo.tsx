"use client";

import { useMemo, useId } from "react";
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

const PRESENCE_VISUAL = [
  { arcHue: "#C8856C", glowOpacity: 0.38, arcBoost: 0,    durationScale: 1.00 },
  { arcHue: "#C07A60", glowOpacity: 0.46, arcBoost: 0.05, durationScale: 0.95 },
  { arcHue: "#B86F54", glowOpacity: 0.54, arcBoost: 0.10, durationScale: 0.90 },
  { arcHue: "#AE6248", glowOpacity: 0.62, arcBoost: 0.15, durationScale: 0.85 },
  { arcHue: "#A4553C", glowOpacity: 0.70, arcBoost: 0.20, durationScale: 0.80 },
] as const;

// Required for Framer Motion scale/translate to work correctly on SVG elements.
// Without transformBox:"fill-box", transforms pivot from the SVG viewport origin
// (top-left corner) instead of the element's own bounding box centre.
const SVG_T: React.CSSProperties = {
  transformBox: "fill-box",
  transformOrigin: "center",
};

function makeTrans(duration: number, delay = 0) {
  return {
    duration,
    delay,
    ease: [0.42, 0, 0.58, 1] as const,
    repeat: Infinity,
    repeatType: "loop" as const,
  };
}

export function EchoLogo({
  size = 100,
  animate = true,
  presenceLevel = 0,
  onClick,
  className,
}: EchoLogoProps) {
  const uid = useId().replace(/:/g, "");
  const animState = animate ? "breathe" : "idle";
  const safeLevel = Math.min(Math.max(presenceLevel, 0), PRESENCE_VISUAL.length - 1);
  const visual = PRESENCE_VISUAL[safeLevel];
  const dur = BREATHE_DURATION * visual.durationScale;

  // Left crescent breathes leftward (expanding the shared space)
  const leftV = useMemo(() => ({
    idle:    { x: 0 },
    breathe: { x: [0, -5, -4, -5, 0], transition: makeTrans(dur) },
  }), [dur]);

  // Right crescent mirrors left
  const rightV = useMemo(() => ({
    idle:    { x: 0 },
    breathe: { x: [0, 5, 4, 5, 0], transition: makeTrans(dur) },
  }), [dur]);

  // The shared breath glow brightens and expands on inhale
  const glowV = useMemo(() => {
    const peak = Math.min(visual.glowOpacity + 0.28, 0.92);
    return {
      idle:    { scale: 1, opacity: visual.glowOpacity },
      breathe: {
        scale:   [1, 1.18, 1.14, 1.18, 1],
        opacity: [visual.glowOpacity, peak, peak * 0.95, peak, visual.glowOpacity],
        transition: makeTrans(dur),
      },
    };
  }, [visual.glowOpacity, dur]);

  // Two oval ripples expand outward, staggered by half a breath cycle
  const ripple1V = useMemo(() => ({
    idle:    { scale: 1, opacity: 0 },
    breathe: {
      scale:   [1, 1.55],
      opacity: [0.28 + visual.arcBoost, 0],
      transition: { duration: dur * 0.48, delay: 0, ease: "easeOut" as const, repeat: Infinity, repeatDelay: dur * 0.52 },
    },
  }), [visual.arcBoost, dur]);

  const ripple2V = useMemo(() => ({
    idle:    { scale: 1, opacity: 0 },
    breathe: {
      scale:   [1, 1.55],
      opacity: [0.18 + visual.arcBoost, 0],
      transition: { duration: dur * 0.48, delay: dur * 0.5, ease: "easeOut" as const, repeat: Infinity, repeatDelay: dur * 0.52 },
    },
  }), [visual.arcBoost, dur]);

  return (
    <motion.div
      className={className}
      onClick={onClick}
      onKeyDown={onClick ? (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      style={{ cursor: onClick ? "pointer" : undefined, lineHeight: 0 }}
      whileTap={onClick ? { scale: 0.95 } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? "Share what's on your mind" : undefined}
      aria-hidden={onClick ? undefined : true}
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
          <linearGradient id={`echo-crescent-grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#D49A82" />
            <stop offset="100%" stopColor={visual.arcHue} />
          </linearGradient>
          <radialGradient id={`echo-breath-glow-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#D9A58E" stopOpacity="1" />
            <stop offset="55%"  stopColor={visual.arcHue} stopOpacity="0.55" />
            <stop offset="100%" stopColor={visual.arcHue} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ripple ring 2 (more delay) */}
        <motion.ellipse
          cx="256" cy="256" rx="168" ry="108"
          stroke={visual.arcHue} strokeWidth="1.5" fill="none"
          variants={ripple2V} animate={animState}
          style={SVG_T}
        />

        {/* Ripple ring 1 */}
        <motion.ellipse
          cx="256" cy="256" rx="168" ry="108"
          stroke={visual.arcHue} strokeWidth="2" fill="none"
          variants={ripple1V} animate={animState}
          style={SVG_T}
        />

        {/* Left crescent — sweeps left (outer ctrl≈100), concave inner ctrl≈185 */}
        <motion.g variants={leftV} animate={animState} style={SVG_T}>
          <path
            d="M 256 152 C 100 195, 100 317, 256 360 C 185 317, 185 195, 256 152 Z"
            fill={`url(#echo-crescent-grad-${uid})`}
          />
        </motion.g>

        {/* Right crescent — sweeps right (outer ctrl≈412), concave inner ctrl≈327 */}
        <motion.g variants={rightV} animate={animState} style={SVG_T}>
          <path
            d="M 256 152 C 412 195, 412 317, 256 360 C 327 317, 327 195, 256 152 Z"
            fill={`url(#echo-crescent-grad-${uid})`}
          />
        </motion.g>

        {/* Shared breath space glow — fills the almond gap between crescent inner edges */}
        <motion.ellipse
          cx="256" cy="256" rx="62" ry="104"
          fill={`url(#echo-breath-glow-${uid})`}
          variants={glowV} animate={animState}
          style={SVG_T}
        />
      </svg>
    </motion.div>
  );
}

export function EchoLogoSmall() {
  return (
    <svg width="28" height="28" viewBox="0 0 512 512" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="echo-sm-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#D49A82" />
          <stop offset="100%" stopColor="#A06B55" />
        </linearGradient>
        <radialGradient id="echo-sm-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#D9A58E" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#C8856C" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d="M 256 152 C 100 195, 100 317, 256 360 C 185 317, 185 195, 256 152 Z"
        fill="url(#echo-sm-grad)"
      />
      <path
        d="M 256 152 C 412 195, 412 317, 256 360 C 327 317, 327 195, 256 152 Z"
        fill="url(#echo-sm-grad)"
      />
      <ellipse cx="256" cy="256" rx="62" ry="104" fill="url(#echo-sm-glow)" />
    </svg>
  );
}
