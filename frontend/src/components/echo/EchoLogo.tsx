"use client";

import { useRef, useEffect, useCallback, useId } from "react";
import { motion } from "framer-motion";
import type { PresenceLevel } from "@/lib/types";

interface EchoLogoProps {
  size?: number;
  animate?: boolean;
  presenceLevel?: PresenceLevel;
  onClick?: () => void;
  className?: string;
}

const PRESENCE_VISUAL = [
  { arcHue: "#C8856C", glowOpacity: 0.38, arcBoost: 0,    speed: 1.00 },
  { arcHue: "#C07A60", glowOpacity: 0.46, arcBoost: 0.05, speed: 1.05 },
  { arcHue: "#B86F54", glowOpacity: 0.54, arcBoost: 0.10, speed: 1.10 },
  { arcHue: "#AE6248", glowOpacity: 0.62, arcBoost: 0.15, speed: 1.15 },
  { arcHue: "#A4553C", glowOpacity: 0.70, arcBoost: 0.20, speed: 1.20 },
] as const;

const VIEW = 512;
const CY = VIEW / 2;
const X_START = 46;
const X_END = 466;
const NUM_PTS = 48; // sample points per wave
const X_STEP = (X_END - X_START) / (NUM_PTS - 1);

// Wave layers: offset from centre, stroke width, opacity
// Mirrored pairs so they never cross (same shape, just offset ± from centre)
const WAVE_LAYERS = [
  { offset: 0,   sw: 4,   op: 0.95 },
  { offset: 20,  sw: 3,   op: 0.75 },
  { offset: -20, sw: 3,   op: 0.75 },
  { offset: 42,  sw: 2.2, op: 0.55 },
  { offset: -42, sw: 2.2, op: 0.55 },
  { offset: 66,  sw: 1.5, op: 0.35 },
  { offset: -66, sw: 1.5, op: 0.35 },
  { offset: 90,  sw: 1,   op: 0.18 },
  { offset: -90, sw: 1,   op: 0.18 },
];

// Build a smooth SVG path from y-offset array using Catmull-Rom interpolation
function buildPathFromOffsets(offsets: number[], yBase: number): string {
  const pts = offsets.map((yo, i) => ({
    x: X_START + i * X_STEP,
    y: yBase + yo,
  }));

  let d = `M ${rn(pts[0].x)} ${rn(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${rn(cp1x)} ${rn(cp1y)}, ${rn(cp2x)} ${rn(cp2y)}, ${rn(p2.x)} ${rn(p2.y)}`;
  }
  return d;
}

function rn(n: number) { return Math.round(n * 10) / 10; }

export function EchoLogo({
  size = 100,
  animate = true,
  presenceLevel = 0,
  onClick,
  className,
}: EchoLogoProps) {
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const safeLevel = Math.min(Math.max(presenceLevel, 0), PRESENCE_VISUAL.length - 1);
  const visual = PRESENCE_VISUAL[safeLevel];

  const animRef = useRef<number>(0);
  // Master wave offsets — one shape that all waves share (offset vertically)
  const currentOffsets = useRef<number[]>(new Array(NUM_PTS).fill(0));
  const targetOffsets = useRef<number[]>(new Array(NUM_PTS).fill(0));
  const lastTargetTime = useRef(0);

  const maxAmp = 180 + visual.arcBoost * 120;

  const generateTargets = useCallback((now: number) => {
    // Breathing energy envelope — wide range for gentle↔strong contrast
    const breathe = Math.sin(now * 0.0004 * visual.speed) * 0.45 + 0.55;
    // Smooth continuous energy modulation (no hard thresholds)
    const swell = Math.sin(now * 0.0012) * 0.5 + 0.5;
    const drift = Math.sin(now * 0.0005 + 2.0) * 0.4 + 0.6;
    const energy = breathe * (swell * 0.6 + drift * 0.4);

    const targets: number[] = [];
    for (let i = 0; i < NUM_PTS; i++) {
      const t = i / (NUM_PTS - 1);
      // Fade amplitude at edges so waves taper to flat at left/right
      const envelope = Math.pow(Math.sin(t * Math.PI), 0.8);
      // Multi-frequency noise — larger weights for more dramatic movement
      const n1 = Math.sin(t * 7.3 + now * 0.0012 * visual.speed) * 0.6;
      const n2 = Math.sin(t * 12.1 + now * 0.002 * visual.speed + 1.7) * 0.35;
      const n3 = Math.sin(t * 19.7 + now * 0.003 * visual.speed + 3.2) * 0.15;
      const n4 = Math.sin(t * 3.1 + now * 0.0006 * visual.speed + 0.5) * 0.2;
      const noise = n1 + n2 + n3 + n4;
      targets.push(noise * maxAmp * envelope * energy);
    }
    return targets;
  }, [maxAmp, visual.speed]);

  const updateWaves = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const now = performance.now();

    // New target shape every ~150ms (slower target updates = less jerkiness)
    if (now - lastTargetTime.current > 150) {
      lastTargetTime.current = now;
      targetOffsets.current = generateTargets(now);
    }

    // Smooth lerp for fluid motion
    const cur = currentOffsets.current;
    const tgt = targetOffsets.current;
    for (let i = 0; i < NUM_PTS; i++) {
      cur[i] += (tgt[i] - cur[i]) * 0.045;
    }

    // Update each wave path directly on the DOM (no React re-render)
    const paths = svg.querySelectorAll<SVGPathElement>("[data-wave]");
    paths.forEach((pathEl: SVGPathElement) => {
      const offset = Number(pathEl.dataset.offset);
      // All waves use the SAME master offsets, just shifted vertically.
      // Outer waves get slightly dampened amplitude for a natural spread.
      const dampen = 1 - Math.abs(offset) / 200;
      const layerOffsets = cur.map((v: number) => v * dampen);
      pathEl.setAttribute("d", buildPathFromOffsets(layerOffsets, CY + offset));
    });

    animRef.current = requestAnimationFrame(updateWaves);
  }, [generateTargets]);

  useEffect(() => {
    if (!animate) {
      // Flat lines when idle
      const svg = svgRef.current;
      if (svg) {
        const paths = svg.querySelectorAll<SVGPathElement>("[data-wave]");
        paths.forEach((pathEl: SVGPathElement) => {
          const offset = Number(pathEl.dataset.offset);
          const flat = new Array(NUM_PTS).fill(0);
          pathEl.setAttribute("d", buildPathFromOffsets(flat, CY + offset));
        });
      }
      return;
    }
    animRef.current = requestAnimationFrame(updateWaves);
    return () => cancelAnimationFrame(animRef.current);
  }, [animate, updateWaves]);

  // Initial flat paths
  const flatPath = buildPathFromOffsets(new Array(NUM_PTS).fill(0), CY);

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
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`echo-wave-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor={visual.arcHue} stopOpacity="0" />
            <stop offset="15%"  stopColor={visual.arcHue} stopOpacity="1" />
            <stop offset="50%"  stopColor="#D49A82" />
            <stop offset="85%"  stopColor={visual.arcHue} stopOpacity="1" />
            <stop offset="100%" stopColor={visual.arcHue} stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`echo-glow-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#D9A58E" stopOpacity={String(visual.glowOpacity * 0.5)} />
            <stop offset="70%"  stopColor={visual.arcHue} stopOpacity="0.06" />
            <stop offset="100%" stopColor={visual.arcHue} stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={CY} cy={CY} r="200" fill={`url(#echo-glow-${uid})`} />

        {WAVE_LAYERS.map((layer, i) => (
          <path
            key={i}
            data-wave=""
            data-offset={layer.offset}
            d={flatPath}
            stroke={`url(#echo-wave-${uid})`}
            strokeWidth={layer.sw}
            strokeLinecap="round"
            fill="none"
            opacity={layer.op}
          />
        ))}
      </svg>
    </motion.div>
  );
}

// Static small version
export function EchoLogoSmall() {
  const smLayers = [
    { offset: 0,   sw: 3.5, op: 0.9  },
    { offset: 16,  sw: 2,   op: 0.6  },
    { offset: -16, sw: 2,   op: 0.6  },
    { offset: 34,  sw: 1.2, op: 0.3  },
    { offset: -34, sw: 1.2, op: 0.3  },
  ];

  // Static organic shape for the small logo
  const offsets = Array.from({ length: NUM_PTS }, (_, i) => {
    const t = i / (NUM_PTS - 1);
    const envelope = Math.pow(Math.sin(t * Math.PI), 0.8);
    const wave =
      Math.sin(t * 7.3 + 1) * 0.5 +
      Math.sin(t * 13.1 + 2.5) * 0.25 +
      Math.sin(t * 21.7 + 4) * 0.15;
    return wave * 25 * envelope;
  });

  return (
    <svg width="28" height="28" viewBox={`0 0 ${VIEW} ${VIEW}`} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="echo-sm-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#A06B55" stopOpacity="0" />
          <stop offset="20%"  stopColor="#A06B55" stopOpacity="1" />
          <stop offset="50%"  stopColor="#D49A82" />
          <stop offset="80%"  stopColor="#A06B55" stopOpacity="1" />
          <stop offset="100%" stopColor="#A06B55" stopOpacity="0" />
        </linearGradient>
      </defs>
      {smLayers.map((layer, i) => {
        const dampen = 1 - Math.abs(layer.offset) / 80;
        const layerOffsets = offsets.map((v) => v * dampen);
        return (
          <path
            key={i}
            d={buildPathFromOffsets(layerOffsets, CY + layer.offset)}
            stroke="url(#echo-sm-grad)"
            strokeWidth={layer.sw}
            strokeLinecap="round"
            fill="none"
            opacity={layer.op}
          />
        );
      })}
    </svg>
  );
}
