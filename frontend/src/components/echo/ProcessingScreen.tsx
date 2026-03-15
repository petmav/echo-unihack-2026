"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PROCESSING_PHRASES } from "@/lib/constants";

const PHRASE_CYCLE_MS = 3500;

/* ── Constellation config ── */
const DEFAULT_W = 300;
const DEFAULT_H = 300;
const STAR_COUNT = 14;
const NODE_APPEAR_INTERVAL = 350;
const EDGE_DRAW_DELAY = 200;
const EDGE_DRAW_DURATION = 700;

interface Star {
  id: number;
  x: number;
  y: number;
  appearAt: number;
  brightness: number; // 0-1, varies star size & glow
  twinkleSpeed: number;
  twinklePhase: number;
}

interface Line {
  from: number;
  to: number;
  appearAt: number;
}

/* ── Minimum spanning tree via Prim's — gives the sparse, branching
     look of real constellation lines ── */
function mst(nodes: Star[]): [number, number][] {
  const n = nodes.length;
  if (n < 2) return [];
  const inTree = new Array(n).fill(false);
  const minCost = new Array(n).fill(Infinity);
  const minEdge = new Array(n).fill(-1);
  minCost[0] = 0;
  const edges: [number, number][] = [];

  for (let iter = 0; iter < n; iter++) {
    // pick cheapest node not in tree
    let u = -1;
    for (let i = 0; i < n; i++) {
      if (!inTree[i] && (u === -1 || minCost[i] < minCost[u])) u = i;
    }
    inTree[u] = true;
    if (minEdge[u] !== -1) edges.push([minEdge[u], u]);

    // update neighbors
    for (let v = 0; v < n; v++) {
      if (inTree[v]) continue;
      const d = Math.hypot(nodes[u].x - nodes[v].x, nodes[u].y - nodes[v].y);
      if (d < minCost[v]) {
        minCost[v] = d;
        minEdge[v] = u;
      }
    }
  }
  return edges;
}

function generateConstellation(w: number, h: number): { stars: Star[]; lines: Line[] } {
  const stars: Star[] = [];
  const pad = Math.min(w, h) * 0.1;
  const minDist = Math.min(w, h) * 0.09;

  for (let i = 0; i < STAR_COUNT; i++) {
    let x: number, y: number;
    let attempts = 0;
    do {
      x = pad + Math.random() * (w - pad * 2);
      y = pad + Math.random() * (h - pad * 2);
      attempts++;
    } while (
      attempts < 50 &&
      stars.some((s) => Math.hypot(s.x - x, s.y - y) < minDist)
    );
    stars.push({
      id: i,
      x,
      y,
      appearAt: i * NODE_APPEAR_INTERVAL,
      brightness: 0.4 + Math.random() * 0.6, // dim to bright
      twinkleSpeed: 0.8 + Math.random() * 1.5,
      twinklePhase: Math.random() * Math.PI * 2,
    });
  }

  // MST edges = sparse tree structure
  const treeEdges = mst(stars);

  // Add 2-3 extra short edges for a bit of visual interest (not a full mesh)
  const extraCount = 2 + Math.floor(Math.random() * 2);
  const allDists: { i: number; j: number; d: number }[] = [];
  const treeSet = new Set(treeEdges.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      const k = `${i}-${j}`;
      if (!treeSet.has(k)) {
        allDists.push({ i, j, d: Math.hypot(stars[i].x - stars[j].x, stars[i].y - stars[j].y) });
      }
    }
  }
  allDists.sort((a, b) => a.d - b.d);
  const extraEdges = allDists.slice(0, extraCount).map(({ i, j }) => [i, j] as [number, number]);

  const allEdges = [...treeEdges, ...extraEdges];

  // Schedule lines — each appears after both endpoint stars are visible
  const lines: Line[] = allEdges.map(([a, b]) => ({
    from: a,
    to: b,
    appearAt: Math.max(stars[a].appearAt, stars[b].appearAt) + EDGE_DRAW_DELAY,
  }));

  return { stars, lines };
}

export interface ConstellationCanvasProps {
  width?: number;
  height?: number;
  className?: string;
}

export function ConstellationCanvas({
  width = DEFAULT_W,
  height = DEFAULT_H,
  className,
}: ConstellationCanvasProps) {
  const [data] = useState(() => generateConstellation(width, height));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTime = useRef(0);
  const animRef = useRef(0);
  const drawRef = useRef<(now: number) => void>(() => {});

  const draw = useCallback(
    (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      if (!startTime.current) startTime.current = now;
      const elapsed = now - startTime.current;

      ctx.clearRect(0, 0, width, height);

      // ── Lines (thin, faint — like constellation diagrams) ──
      for (const line of data.lines) {
        if (elapsed < line.appearAt) continue;
        const t = Math.min((elapsed - line.appearAt) / EDGE_DRAW_DURATION, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const a = data.stars[line.from];
        const b = data.stars[line.to];
        const ex = a.x + (b.x - a.x) * eased;
        const ey = a.y + (b.y - a.y) * eased;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = `rgba(200, 160, 140, ${0.3 * eased})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }

      // ── Stars ──
      for (const star of data.stars) {
        if (elapsed < star.appearAt) continue;
        const age = elapsed - star.appearAt;
        const fadeIn = Math.min(age / 500, 1);

        // Twinkle: oscillate brightness
        const twinkle =
          0.6 + 0.4 * Math.sin(now * 0.001 * star.twinkleSpeed + star.twinklePhase);
        const alpha = star.brightness * twinkle * fadeIn;
        const r = (1.2 + star.brightness * 2) * fadeIn;

        // Soft outer glow
        const grad = ctx.createRadialGradient(
          star.x, star.y, 0,
          star.x, star.y, r * 6
        );
        grad.addColorStop(0, `rgba(220, 180, 160, ${0.4 * alpha})`);
        grad.addColorStop(0.3, `rgba(210, 160, 140, ${0.1 * alpha})`);
        grad.addColorStop(1, "rgba(210, 160, 140, 0)");
        ctx.beginPath();
        ctx.arc(star.x, star.y, r * 6, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // 4-point star spike (cross shape) for brighter stars
        if (star.brightness > 0.6) {
          const spikeLen = r * 3.5 * alpha;
          const spikeAlpha = 0.2 * alpha;
          ctx.strokeStyle = `rgba(230, 200, 180, ${spikeAlpha})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(star.x - spikeLen, star.y);
          ctx.lineTo(star.x + spikeLen, star.y);
          ctx.moveTo(star.x, star.y - spikeLen);
          ctx.lineTo(star.x, star.y + spikeLen);
          ctx.stroke();
        }

        // Core dot
        ctx.beginPath();
        ctx.arc(star.x, star.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(235, 210, 195, ${0.9 * alpha})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame((t) => drawRef.current(t));
    },
    [data, width, height]
  );

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  useEffect(() => {
    animRef.current = requestAnimationFrame((t) => drawRef.current(t));
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width, height }}
    />
  );
}

export function ProcessingScreen() {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % PROCESSING_PHRASES.length);
    }, PHRASE_CYCLE_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <ConstellationCanvas />

      <div className="mt-6 h-6 text-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={phraseIndex}
            className="inline-block text-[15px] font-light tracking-wide text-echo-text-soft"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.6 }}
          >
            {PROCESSING_PHRASES[phraseIndex]}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
