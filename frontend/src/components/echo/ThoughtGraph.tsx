"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ZoomIn, ZoomOut, Maximize2, X, Info } from "lucide-react";
import { useTheme } from "@/lib/theme";

import type { GraphNode, GraphEdge, GraphData } from "@/lib/types";
import { getGraphData, getResolution } from "@/lib/api";
import { getThoughtHistory } from "@/lib/storage";
import { ConstellationCanvas } from "./ProcessingScreen";

/* ── Client-side demo data (mirrors backend _DEMO_GRAPH_*) ── */
const DEMO_NODES: GraphNode[] = [
  { message_id: "g1", humanised_text: "There's this constant feeling that I'm falling behind while everyone around me seems to be moving forward effortlessly.", theme_category: "comparison", timestamp_week: "2026-W11", has_resolution: true },
  { message_id: "g2", humanised_text: "I feel invisible at work. I contribute ideas and effort but it's like nobody notices.", theme_category: "professional_worth", timestamp_week: "2026-W11", has_resolution: false },
  { message_id: "g3", humanised_text: "Sometimes I lie awake replaying every awkward thing I've ever said in a conversation.", theme_category: "self_worth", timestamp_week: "2026-W11", has_resolution: true },
  { message_id: "g4", humanised_text: "I moved to a new city and the loneliness is heavier than I expected. I smile through the day and fall apart at night.", theme_category: "relationship_loss", timestamp_week: "2026-W10", has_resolution: false },
  { message_id: "g5", humanised_text: "My family expects me to follow a path I never chose. Every conversation turns into pressure.", theme_category: "family_pressure", timestamp_week: "2026-W10", has_resolution: true },
  { message_id: "g6", humanised_text: "I keep starting things with energy and then abandoning them halfway through.", theme_category: "self_worth", timestamp_week: "2026-W10", has_resolution: false },
  { message_id: "g7", humanised_text: "There's a person in my life who makes me feel small in ways that are hard to explain.", theme_category: "relationship_loss", timestamp_week: "2026-W09", has_resolution: true },
  { message_id: "g8", humanised_text: "I graduated months ago and still don't know what I'm doing with my life.", theme_category: "professional_worth", timestamp_week: "2026-W09", has_resolution: false },
  { message_id: "g9", humanised_text: "I catch myself performing happiness around people because being honest sounds exhausting.", theme_category: "self_worth", timestamp_week: "2026-W09", has_resolution: false },
  { message_id: "g10", humanised_text: "I helped someone through the hardest time of their life and when I needed the same they weren't there.", theme_category: "relationship_loss", timestamp_week: "2026-W08", has_resolution: true },
  { message_id: "g11", humanised_text: "I look at old photos of myself and feel sadness for how harshly I judged that person.", theme_category: "self_worth", timestamp_week: "2026-W08", has_resolution: false },
  { message_id: "g12", humanised_text: "I've been told I'm too sensitive my whole life and I've started to believe it.", theme_category: "self_worth", timestamp_week: "2026-W08", has_resolution: true },
  { message_id: "g13", humanised_text: "The pressure to always be productive makes me feel guilty for resting.", theme_category: "burnout", timestamp_week: "2026-W11", has_resolution: false },
  { message_id: "g14", humanised_text: "I can't stop comparing my life to what I see on social media even though I know it's curated.", theme_category: "comparison", timestamp_week: "2026-W10", has_resolution: false },
  { message_id: "g15", humanised_text: "I feel like I'm just going through the motions each day without any real purpose.", theme_category: "burnout", timestamp_week: "2026-W09", has_resolution: true },
  { message_id: "g16", humanised_text: "Nobody asks how I'm really doing. They just accept the version of me that smiles.", theme_category: "loneliness", timestamp_week: "2026-W11", has_resolution: false },
  { message_id: "g17", humanised_text: "I keep pushing people away because I'm afraid they'll see who I actually am.", theme_category: "loneliness", timestamp_week: "2026-W10", has_resolution: false },
  { message_id: "g18", humanised_text: "The gap between who I am and who I want to be feels insurmountable some days.", theme_category: "self_worth", timestamp_week: "2026-W11", has_resolution: false },
  { message_id: "g19", humanised_text: "I worry that I peaked in college and everything since has been a slow decline.", theme_category: "fear_of_failure", timestamp_week: "2026-W10", has_resolution: false },
  { message_id: "g20", humanised_text: "Every mistake I make at work feels like proof that I don't belong there.", theme_category: "professional_worth", timestamp_week: "2026-W11", has_resolution: true },
];

const DEMO_EDGES: GraphEdge[] = [
  { source: "g1", target: "g14", similarity: 0.89 },
  { source: "g1", target: "g19", similarity: 0.72 },
  { source: "g2", target: "g8", similarity: 0.85 },
  { source: "g2", target: "g20", similarity: 0.82 },
  { source: "g3", target: "g9", similarity: 0.78 },
  { source: "g3", target: "g11", similarity: 0.76 },
  { source: "g3", target: "g12", similarity: 0.71 },
  { source: "g4", target: "g16", similarity: 0.80 },
  { source: "g4", target: "g17", similarity: 0.74 },
  { source: "g5", target: "g7", similarity: 0.65 },
  { source: "g6", target: "g18", similarity: 0.77 },
  { source: "g6", target: "g15", similarity: 0.68 },
  { source: "g8", target: "g19", similarity: 0.79 },
  { source: "g8", target: "g20", similarity: 0.73 },
  { source: "g9", target: "g16", similarity: 0.83 },
  { source: "g9", target: "g18", similarity: 0.70 },
  { source: "g10", target: "g4", similarity: 0.67 },
  { source: "g11", target: "g12", similarity: 0.81 },
  { source: "g13", target: "g15", similarity: 0.86 },
  { source: "g13", target: "g6", similarity: 0.63 },
  { source: "g16", target: "g17", similarity: 0.88 },
  { source: "g18", target: "g11", similarity: 0.72 },
  { source: "g19", target: "g20", similarity: 0.66 },
];

/* ── Theme color palette (matches Echo design tokens) ── */
const THEME_COLORS: Record<string, string> = {
  self_worth: "#B07BAE",
  comparison: "#C8856C",
  professional_worth: "#6BA3C8",
  relationship_loss: "#C75F7B",
  family_pressure: "#D4A06A",
  burnout: "#E08B5A",
  loneliness: "#8B8BC8",
  anxiety: "#C7A04E",
  grief: "#7A8B9C",
  fear_of_failure: "#9B7EC8",
  social_anxiety: "#6BAEB0",
  self_harm: "#C75050",
  suicidal_ideation: "#C75050",
  crisis: "#C75050",
  substance_abuse: "#B06B50",
  eating_disorder: "#C77070",
  abuse: "#C75050",
  domestic_violence: "#C75050",
  work_stress: "#D4956A",
};

/* ── Demo resolution texts for resolved demo nodes ── */
const DEMO_RESOLUTIONS: Record<string, string> = {
  g1: "I stopped measuring my pace against other people's highlight reels. I started a daily gratitude journal and it shifted my focus from what I lacked to what I was building.",
  g3: "I started writing down intrusive thoughts before bed instead of letting them loop. Seeing them on paper made them smaller. A therapist also taught me grounding techniques that helped.",
  g5: "I had an honest conversation with my parents about what I actually wanted. It was terrifying but they surprised me — they didn't fully agree, but they listened.",
  g7: "I set boundaries. I told them how their words affected me, and when they didn't change, I chose distance. It was painful but necessary for my mental health.",
  g10: "I learned that not every relationship is reciprocal and that's okay. I found new people who showed up for me, and I stopped pouring into empty cups.",
  g12: "I realised sensitivity is not a flaw — it's a strength that was mislabelled. I found a community of people who value emotional depth rather than dismissing it.",
  g15: "I took a month off social media and reconnected with hobbies I'd abandoned. The guilt faded when I realised rest is productive too — it recharges everything else.",
  g20: "I kept a 'wins' document at work. Every time something went well, I wrote it down. When imposter syndrome hit, I re-read it. Evidence beats feelings.",
};

const DEFAULT_NODE_COLOR = "#B5ADA6";
const USER_NODE_COLOR = "#34D399";
const USER_NODE_GLOW = "rgba(52, 211, 153, 0.6)";
const EDGE_HOVER_COLOR = "rgba(200, 133, 108, 0.6)";

/* ── Background starfield for space aesthetic ── */
interface Star {
  x: number;      // 0–1 normalised position
  y: number;
  size: number;   // radius in px
  drift: number;  // subtle horizontal drift speed
  twinkleSpeed: number;
  twinkleOffset: number;
  brightness: number; // base brightness 0–1
}

function randomizeStar(star: Star) {
  star.x = Math.random();
  star.y = Math.random();
  star.size = Math.random() < 0.05 ? 0.6 + Math.random() * 0.4 : 0.2 + Math.random() * 0.5;
  star.drift = (Math.random() - 0.5) * 0.00003;
  star.twinkleSpeed = 0.0008 + Math.random() * 0.003;
  star.twinkleOffset = Math.random() * Math.PI * 2;
  star.brightness = 0.3 + Math.random() * 0.7;
}

function generateStars(count: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const s: Star = { x: 0, y: 0, size: 0, drift: 0, twinkleSpeed: 0, twinkleOffset: 0, brightness: 0 };
    randomizeStar(s);
    stars.push(s);
  }
  return stars;
}

const STAR_COUNT = 180;
let _cachedStars: Star[] | null = null;
function getStars(): Star[] {
  if (!_cachedStars) _cachedStars = generateStars(STAR_COUNT);
  return _cachedStars;
}

function drawNebula(ctx: CanvasRenderingContext2D, w: number, h: number, isDark: boolean) {
  if (!isDark) return;
  const now = Date.now();
  // Two slow-moving nebula blobs
  const blobs = [
    { cx: 0.3 + 0.05 * Math.sin(now * 0.00004), cy: 0.4 + 0.06 * Math.cos(now * 0.00003), r: 0.35, color: [80, 50, 120] },
    { cx: 0.7 + 0.04 * Math.cos(now * 0.00005), cy: 0.6 + 0.05 * Math.sin(now * 0.00004), r: 0.3, color: [40, 60, 100] },
  ];
  for (const blob of blobs) {
    const grad = ctx.createRadialGradient(
      blob.cx * w, blob.cy * h, 0,
      blob.cx * w, blob.cy * h, blob.r * Math.max(w, h)
    );
    grad.addColorStop(0, `rgba(${blob.color.join(",")}, 0.06)`);
    grad.addColorStop(0.5, `rgba(${blob.color.join(",")}, 0.03)`);
    grad.addColorStop(1, `rgba(${blob.color.join(",")}, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawStarfield(ctx: CanvasRenderingContext2D, w: number, h: number, isDark: boolean) {
  // Nebula wash behind stars
  drawNebula(ctx, w, h, isDark);

  const stars = getStars();
  const now = Date.now();
  for (const star of stars) {
    // Drift slowly
    star.x = (star.x + star.drift) % 1;
    if (star.x < 0) star.x += 1;

    const twinkle = 0.5 + 0.5 * Math.sin(now * star.twinkleSpeed + star.twinkleOffset);
    const alpha = star.brightness * twinkle * (isDark ? 0.7 : 0.25);
    if (alpha < 0.02) {
      // When a star fully fades out, respawn it at a new random position
      if (twinkle < 0.05) randomizeStar(star);
      continue;
    }

    const sx = star.x * w;
    const sy = star.y * h;
    const color = isDark
      ? `rgba(200, 200, 240, ${alpha})`
      : `rgba(120, 100, 90, ${alpha})`;

    // Draw 4-pointed cross star shape
    const s = star.size;
    const spike = s * 3;   // length of the cross spikes
    const thick = s * 0.45; // half-width of each spike arm
    ctx.fillStyle = color;
    ctx.beginPath();
    // Vertical spike
    ctx.moveTo(sx, sy - spike);
    ctx.lineTo(sx + thick, sy - thick);
    ctx.lineTo(sx + spike, sy);
    ctx.lineTo(sx + thick, sy + thick);
    ctx.lineTo(sx, sy + spike);
    ctx.lineTo(sx - thick, sy + thick);
    ctx.lineTo(sx - spike, sy);
    ctx.lineTo(sx - thick, sy - thick);
    ctx.closePath();
    ctx.fill();

    // Brighter stars get a subtle glow
    if (star.size > 1.2 && alpha > 0.25) {
      ctx.beginPath();
      ctx.arc(sx, sy, star.size * 3, 0, Math.PI * 2);
      ctx.fillStyle = isDark
        ? `rgba(180, 180, 255, ${alpha * 0.12})`
        : `rgba(140, 120, 100, ${alpha * 0.08})`;
      ctx.fill();
    }
  }
}

/* ── Simulation node with physics state ── */
interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  glow: string;
  alpha: number;
  isUser: boolean;
  label: string;
  fullText: string;
  theme: string;
  hasResolution: boolean;
  resolutionText?: string;
  weekAge: number; // 0 = this week, 1 = last week, etc.
}

interface SimEdge {
  source: string;
  target: string;
  similarity: number;
}

/**
 * Parse ISO week string "YYYY-Www" to a week age relative to now.
 * Returns 0 for current week, 1 for last week, etc.
 */
function weekAge(timestampWeek: string): number {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000
  );
  const currentWeek = Math.ceil((dayOfYear + jan4.getDay() + 1) / 7);
  const currentYear = now.getFullYear();

  const match = timestampWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return 4;
  const nodeYear = parseInt(match[1]);
  const nodeWeek = parseInt(match[2]);

  return (currentYear - nodeYear) * 52 + (currentWeek - nodeWeek);
}

/**
 * Compute luminosity (0.0–1.0) from week age.
 * User nodes: bright (0.85–1.0), non-user: dim (0.12–0.35).
 * This creates a clear visual hierarchy — your thoughts glow,
 * everyone else's are soft background stars.
 */
function luminosity(age: number, isUser: boolean, hasResolution: boolean): number {
  if (isUser) {
    const base = Math.max(0.85, 1.0 - age * 0.04);
    return Math.min(1.0, base + (hasResolution ? 0.05 : 0));
  }
  // Non-user: visible and solid so they clearly sit above edges
  // Resolved nodes get a noticeable alpha boost so they stand out
  const base = Math.max(0.55, 0.8 - age * 0.06);
  return base + (hasResolution ? 0.1 : 0);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

/** Run one tick of the force simulation. Mutates nodes in-place. */
function tickOnce(
  nodes: SimNode[],
  edges: SimEdge[],
  w: number,
  h: number,
  tickNum: number,
  draggedId?: string,
  themeAnchors?: Map<string, { x: number; y: number }>,
): void {
  const nodeMap = new Map<string, SimNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // Compute live theme centroids
  const themeCentroids = new Map<string, { x: number; y: number; count: number }>();
  for (const node of nodes) {
    const entry = themeCentroids.get(node.theme);
    if (entry) {
      entry.x += node.x;
      entry.y += node.y;
      entry.count++;
    } else {
      themeCentroids.set(node.theme, { x: node.x, y: node.y, count: 1 });
    }
  }
  for (const entry of themeCentroids.values()) {
    entry.x /= entry.count;
    entry.y /= entry.count;
  }

  // Cooling — strong early, gentle after settling
  const cooling = tickNum < 60
    ? Math.max(0.3, 1 - tickNum * 0.012)
    : Math.max(0.01, 0.3 - (tickNum - 60) * 0.004);

  const area = w * h;
  const repulsion = (area / Math.max(nodes.length, 1)) * 3.0 * cooling;
  const attraction = 0.005 * cooling;
  const centerGravity = tickNum < 40 ? 0.008 : 0.0015;
  const damping = 0.75;
  const idealEdgeLen = Math.sqrt(area / Math.max(nodes.length, 1)) * 1.2;

  // Repulsion — reduced between same-theme nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const dist2 = dx * dx + dy * dy + 1;
      const dist = Math.sqrt(dist2);
      const sameTheme = nodes[i].theme === nodes[j].theme;
      const force = (repulsion * (sameTheme ? 0.4 : 1.0)) / dist2;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      nodes[i].vx -= fx;
      nodes[i].vy -= fy;
      nodes[j].vx += fx;
      nodes[j].vy += fy;
    }
  }

  // Attraction along edges
  for (const edge of edges) {
    const a = nodeMap.get(edge.source);
    const b = nodeMap.get(edge.target);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
    const force = (dist - idealEdgeLen) * attraction * edge.similarity;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    a.vx += fx;
    a.vy += fy;
    b.vx -= fx;
    b.vy -= fy;
  }

  // Theme cohesion + anchor pull + center gravity + velocity
  const themeCohesion = 0.015 * cooling;
  const anchorPull = 0.025 * cooling;

  for (const node of nodes) {
    if (node.id === draggedId) continue;

    // Pull toward live theme centroid
    const centroid = themeCentroids.get(node.theme);
    if (centroid) {
      node.vx += (centroid.x - node.x) * themeCohesion;
      node.vy += (centroid.y - node.y) * themeCohesion;
    }

    // Pull toward fixed theme anchor — stronger for isolated themes
    if (themeAnchors) {
      const anchor = themeAnchors.get(node.theme);
      if (anchor) {
        const themeSize = themeCentroids.get(node.theme)?.count ?? 1;
        const pull = themeSize <= 2 ? anchorPull * 3 : anchorPull;
        node.vx += (anchor.x - node.x) * pull;
        node.vy += (anchor.y - node.y) * pull;
      }
    }

    node.vx += (w / 2 - node.x) * centerGravity;
    node.vy += (h / 2 - node.y) * centerGravity;
    node.vx *= damping;
    node.vy *= damping;
    node.x += node.vx;
    node.y += node.vy;
  }
}

interface ThoughtGraphProps {
  onBack: () => void;
}

export function ThoughtGraph({ onBack }: ThoughtGraphProps) {
  const { theme } = useTheme();
  const themeRef = useRef(theme);
  useEffect(() => { themeRef.current = theme; }, [theme]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const nodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<SimEdge[]>([]);
  const hoveredRef = useRef<string | null>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const isPanningRef = useRef(false);
  const panMovedRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const tickRef = useRef(0);
  const themeAnchorsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [containerWidth, setContainerWidth] = useState(300);
  const [connectedForDetail, setConnectedForDetail] = useState<{ node: SimNode; similarity: number }[]>([]);

  // Smooth animated zoom/pan targets
  const targetZoomRef = useRef(1);
  const targetPanRef = useRef({ x: 0, y: 0 });
  const preSelectViewRef = useRef<{ zoom: number; pan: { x: number; y: number } } | null>(null);

  const initGraph = useCallback(async () => {
    let graphData: GraphData;
    try {
      graphData = await getGraphData();
      if (graphData.nodes.length === 0) {
        graphData = { nodes: DEMO_NODES, edges: DEMO_EDGES };
      }
    } catch {
      graphData = { nodes: DEMO_NODES, edges: DEMO_EDGES };
    }

    // Get user's own message_ids from localStorage
    const history = await getThoughtHistory();
    const userIds = new Set(history.map((t) => t.message_id));

    // Build resolution text map from local history
    const resolutionTexts = new Map<string, string>();
    for (const t of history) {
      if (t.is_resolved && t.resolution_text) {
        resolutionTexts.set(t.message_id, t.resolution_text);
      }
    }

    // When using demo data, check if ANY demo node matches a real user ID.
    // If not, mark a few demo nodes as "yours" so the glow is always visible.
    const isDemo = graphData.nodes.every((n) => n.message_id.startsWith("g"));
    if (isDemo) {
      const hasMatch = graphData.nodes.some((n) => userIds.has(n.message_id));
      if (!hasMatch) {
        for (const id of ["g1", "g3", "g13"]) userIds.add(id);
      }
      // Add demo resolution texts
      for (const [id, text] of Object.entries(DEMO_RESOLUTIONS)) {
        if (!resolutionTexts.has(id)) resolutionTexts.set(id, text);
      }
    }

    // Fetch resolution texts for non-user resolved nodes (best-effort, don't block)
    const resolvedNonUser = graphData.nodes.filter(
      (n) => n.has_resolution && !userIds.has(n.message_id) && !resolutionTexts.has(n.message_id) && !isDemo
    );
    const resolutionFetches = resolvedNonUser.map(async (n) => {
      try {
        const res = await getResolution(n.message_id);
        if (res?.resolution_text) resolutionTexts.set(n.message_id, res.resolution_text);
      } catch { /* best-effort */ }
    });
    await Promise.all(resolutionFetches);

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const w = rect.width || 800;
    const h = rect.height || 600;
    const cx = w / 2;
    const cy = h / 2;

    // Compute theme anchor positions arranged radially
    // Count nodes per theme so we can merge tiny themes into nearest large cluster
    const themeCounts = new Map<string, number>();
    for (const n of graphData.nodes) {
      themeCounts.set(n.theme_category, (themeCounts.get(n.theme_category) ?? 0) + 1);
    }
    const themes = [...new Set(graphData.nodes.map((n) => n.theme_category))];
    const bigThemes = themes.filter((t) => (themeCounts.get(t) ?? 0) >= 3);
    const smallThemes = themes.filter((t) => (themeCounts.get(t) ?? 0) < 3);

    const anchorRadius = Math.min(w * 0.52, h * 0.56);
    const themeAnchors = new Map<string, { x: number; y: number }>();
    // Place big themes evenly around the circle
    bigThemes.forEach((theme, i) => {
      const angle = (2 * Math.PI * i) / bigThemes.length - Math.PI / 2;
      themeAnchors.set(theme, {
        x: cx + Math.cos(angle) * anchorRadius,
        y: cy + Math.sin(angle) * anchorRadius,
      });
    });
    // Place small themes (1-2 nodes) next to the nearest big theme by finding
    // edges that connect them, or failing that, slot them between big themes
    for (const small of smallThemes) {
      // Find which big theme this small theme is most connected to
      const connectionCounts = new Map<string, number>();
      for (const edge of graphData.edges) {
        const srcTheme = graphData.nodes.find((n) => n.message_id === edge.source)?.theme_category;
        const tgtTheme = graphData.nodes.find((n) => n.message_id === edge.target)?.theme_category;
        if (srcTheme === small && tgtTheme && tgtTheme !== small && themeAnchors.has(tgtTheme)) {
          connectionCounts.set(tgtTheme, (connectionCounts.get(tgtTheme) ?? 0) + 1);
        }
        if (tgtTheme === small && srcTheme && srcTheme !== small && themeAnchors.has(srcTheme)) {
          connectionCounts.set(srcTheme, (connectionCounts.get(srcTheme) ?? 0) + 1);
        }
      }
      let bestTheme = bigThemes[0];
      let bestCount = 0;
      for (const [t, c] of connectionCounts) {
        if (c > bestCount) { bestTheme = t; bestCount = c; }
      }
      // Place near the best-connected big theme, offset slightly
      const parentAnchor = themeAnchors.get(bestTheme);
      if (parentAnchor) {
        const offsetAngle = Math.random() * Math.PI * 2;
        const offsetDist = 40 + Math.random() * 30;
        themeAnchors.set(small, {
          x: parentAnchor.x + Math.cos(offsetAngle) * offsetDist,
          y: parentAnchor.y + Math.sin(offsetAngle) * offsetDist,
        });
      } else {
        // Fallback: place at center
        themeAnchors.set(small, { x: cx, y: cy });
      }
    }
    themeAnchorsRef.current = themeAnchors;

    // Build simulation nodes — start near their theme anchor
    const spread = Math.min(w, h) * 0.24;
    const simNodes: SimNode[] = graphData.nodes.map((n) => {
      const anchor = themeAnchors.get(n.theme_category) ?? { x: cx, y: cy };
      const isUser = userIds.has(n.message_id);
      const age = weekAge(n.timestamp_week);
      const lum = luminosity(age, isUser, n.has_resolution);
      const baseColor = isUser ? USER_NODE_COLOR : (THEME_COLORS[n.theme_category] ?? DEFAULT_NODE_COLOR);

      return {
        id: n.message_id,
        x: anchor.x + (Math.random() - 0.5) * spread * 0.5,
        y: anchor.y + (Math.random() - 0.5) * spread * 0.5,
        vx: 0,
        vy: 0,
        radius: isUser ? 7 : 4.5 + (n.has_resolution ? 1.5 : 0),
        color: baseColor,
        glow: isUser ? USER_NODE_GLOW : "none",
        alpha: lum,
        isUser,
        label: truncate(n.humanised_text, 160),
        fullText: n.humanised_text,
        theme: n.theme_category,
        hasResolution: n.has_resolution,
        resolutionText: resolutionTexts.get(n.message_id),
        weekAge: age,
      };
    });

    nodesRef.current = simNodes;
    edgesRef.current = graphData.edges;

    // Pre-run simulation so the graph appears already settled (no visible bouncing)
    for (let i = 0; i < 150; i++) {
      tickOnce(simNodes, graphData.edges, w, h, i, undefined, themeAnchors);
    }
    tickRef.current = 150;

    setNodeCount(simNodes.length);
    setEdgeCount(graphData.edges.length);
    setLoading(false);

    // On mobile, zoom into the most recently created user node so nodes are tappable
    const isMobile = w <= 768;
    if (isMobile) {
      const userNodes = simNodes.filter((n) => n.isUser);
      if (userNodes.length > 0) {
        const mostRecent = userNodes.reduce((a, b) => (a.weekAge <= b.weekAge ? a : b));
        const targetZoom = 2.5;
        const offsetX = 0; // no card shown on init, keep centred
        targetZoomRef.current = targetZoom;
        targetPanRef.current = {
          x: w / 2 - mostRecent.x * targetZoom - offsetX,
          y: h / 2 - mostRecent.y * targetZoom,
        };
        zoomRef.current = targetZoom;
        panRef.current = { ...targetPanRef.current };
      }
    }
  }, []);

  /* ── Force simulation tick ── */
  const tick = useCallback(() => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    if (nodes.length === 0) return;

    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    const t = tickRef.current;
    tickRef.current++;
    tickOnce(nodes, edges, w, h, t, dragRef.current?.id, themeAnchorsRef.current);
  }, []);

  /* ── Render loop ── */
  const renderRef = useRef<() => void>(() => {});
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const hovered = hoveredRef.current;

    tick();

    // Smooth lerp zoom/pan towards targets
    const lerpSpeed = 0.08;
    zoomRef.current += (targetZoomRef.current - zoomRef.current) * lerpSpeed;
    panRef.current.x += (targetPanRef.current.x - panRef.current.x) * lerpSpeed;
    panRef.current.y += (targetPanRef.current.y - panRef.current.y) * lerpSpeed;

    const pan = panRef.current;
    const zoom = zoomRef.current;

    // Build node lookup
    const nodeMap = new Map<string, SimNode>();
    for (const n of nodes) nodeMap.set(n.id, n);

    // Hovered node's connected edges
    const connectedToHovered = new Set<string>();
    if (hovered) {
      connectedToHovered.add(hovered);
      for (const e of edges) {
        if (e.source === hovered) connectedToHovered.add(e.target);
        if (e.target === hovered) connectedToHovered.add(e.source);
      }
    }

    // Clear — read theme-aware background from CSS variable
    const styles = getComputedStyle(document.documentElement);
    const bgColor = styles.getPropertyValue("--echo-graph-bg").trim() || "#1a1a2e";
    const edgeColor = styles.getPropertyValue("--echo-graph-edge").trim() || "rgba(200, 200, 220, 0.15)";
    const edgeCrossColor = styles.getPropertyValue("--echo-graph-edge-cross").trim() || "rgba(200, 200, 220, 0.06)";

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Starfield background — space aesthetic with drifting, twinkling stars
    const isDark = themeRef.current === "dark";
    drawStarfield(ctx, canvas.width, canvas.height, isDark);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw edges — cross-theme edges more visible as bridges
    for (const edge of edges) {
      const a = nodeMap.get(edge.source);
      const b = nodeMap.get(edge.target);
      if (!a || !b) continue;

      const isHighlighted =
        hovered && (edge.source === hovered || edge.target === hovered);
      const dimmedEdge = hovered && !isHighlighted;
      const crossTheme = a.theme !== b.theme;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = isHighlighted
        ? EDGE_HOVER_COLOR
        : crossTheme
          ? edgeColor
          : edgeCrossColor;
      ctx.lineWidth = isHighlighted ? 2 : crossTheme ? 0.8 : 0.4;
      ctx.globalAlpha = dimmedEdge ? 0.05 : isHighlighted ? 0.8 : 0.25;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    // Draw non-user nodes — no glow, just core dots
    for (const node of nodes) {
      if (node.isUser) continue;
      const isHovered = node.id === hovered;
      const isConnected = connectedToHovered.has(node.id);
      const dimmed = hovered && !isConnected;

      // Core dot only — no ambient glow for non-user nodes
      // Boost alpha on light backgrounds so nodes remain visible
      const lightBoost = themeRef.current === "light" ? 0.45 : 0;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.globalAlpha = dimmed ? 0.2 : isHovered ? Math.min(1, node.alpha + 0.4 + lightBoost) : Math.min(1, node.alpha + 0.15 + lightBoost);
      ctx.fill();

      if (node.hasResolution && !dimmed) {
        // Resolved nodes glow in their own color
        ctx.save();
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.shadowColor = node.color;
        ctx.shadowBlur = isHovered ? 14 : 10;
        ctx.fillStyle = node.color;
        ctx.globalAlpha = isHovered ? 0.6 : 0.4;
        ctx.fill();
        ctx.restore();
      }
    }

    // Draw user nodes on top (foreground — pulsing glow, bright core, ring)
    const pulse = 0.6 + 0.4 * Math.sin(Date.now() * 0.003); // slow breathe
    for (const node of nodes) {
      if (!node.isUser) continue;
      const isHovered = node.id === hovered;
      const isConnected = connectedToHovered.has(node.id);
      const dimmed = hovered && !isConnected;
      if (dimmed) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.globalAlpha = 0.25;
        ctx.fill();
        continue;
      }

      // Single radial-gradient circle: solid centre fading out to transparent at the edge
      // so the boundary blends seamlessly into the ambient glow.
      const totalR = node.radius * (3 + pulse * 0.8);
      const solidEdge = node.radius / totalR;          // fraction where solid colour ends
      const fadeEdge  = (node.radius * 1.35) / totalR; // fraction where colour fully fades
      const nodeGrad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, totalR);
      const alpha = isHovered ? 1 : 0.95;
      nodeGrad.addColorStop(0,          `rgba(52, 211, 153, ${alpha})`);
      nodeGrad.addColorStop(solidEdge,  `rgba(52, 211, 153, ${alpha})`);
      nodeGrad.addColorStop(fadeEdge,   `rgba(52, 211, 153, ${0.18 * pulse})`);
      nodeGrad.addColorStop(1,          "rgba(52, 211, 153, 0)");
      ctx.fillStyle = nodeGrad;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(node.x, node.y, totalR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw theme labels last so they render above edges and nodes
    const themeGroups = new Map<string, SimNode[]>();
    for (const node of nodes) {
      const group = themeGroups.get(node.theme) || [];
      group.push(node);
      themeGroups.set(node.theme, group);
    }

    for (const [theme, group] of themeGroups) {
      if (group.length < 1) continue;
      const color = THEME_COLORS[theme] ?? DEFAULT_NODE_COLOR;

      let gcx = 0, gcy = 0;
      for (const n of group) { gcx += n.x; gcy += n.y; }
      gcx /= group.length;
      gcy /= group.length;

      // Use average radius (not max) so outlier nodes don't push the label far away
      let totalR = 0;
      for (const n of group) {
        const dx = n.x - gcx, dy = n.y - gcy;
        totalR += Math.sqrt(dx * dx + dy * dy);
      }
      const avgR = group.length > 1 ? totalR / group.length : 0;
      const labelR = Math.min(avgR + 12, 60); // cap at 60px from centroid

      // Theme label above cluster
      const isLight = themeRef.current === "light";
      ctx.fillStyle = color;
      ctx.globalAlpha = isLight ? 0.85 : 0.8;
      ctx.font = "600 10px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(theme.replace(/_/g, " ").toUpperCase(), gcx, gcy - labelR - 14);
    }

    ctx.globalAlpha = 1;
    ctx.restore();

    animFrameRef.current = requestAnimationFrame(() => renderRef.current());
  }, [tick]);

  useEffect(() => {
    renderRef.current = render;
  }, [render]);

  useEffect(() => {
    if (!selectedNode) {
      queueMicrotask(() => setConnectedForDetail([]));
      return;
    }
    const edges = edgesRef.current;
    const nodes = nodesRef.current;
    const connected = edges
      .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
      .map((e) => {
        const otherId = e.source === selectedNode.id ? e.target : e.source;
        const other = nodes.find((n) => n.id === otherId);
        return other ? { node: other, similarity: e.similarity } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b!.similarity - a!.similarity) as { node: SimNode; similarity: number }[];
    queueMicrotask(() => setConnectedForDetail(connected));
  }, [selectedNode]);

  /* ── Canvas sizing ── */
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    setContainerWidth(rect.width);
    // Use CSS pixels for simulation coordinates (no DPR scaling —
    // keeps physics consistent across displays)
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  }, []);

  /* ── Mouse/touch interaction ── */
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: (sx - panRef.current.x) / zoomRef.current,
      y: (sy - panRef.current.y) / zoomRef.current,
    };
  }, []);

  const findNodeAt = useCallback((wx: number, wy: number): SimNode | null => {
    const nodes = nodesRef.current;
    let closest: SimNode | null = null;
    let closestDist = Infinity;
    for (const node of nodes) {
      const dx = node.x - wx;
      const dy = node.y - wy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const hitRadius = node.radius * 2.5;
      if (dist < hitRadius && dist < closestDist) {
        closest = node;
        closestDist = dist;
      }
    }
    return closest;
  }, []);

  const pendingDragRef = useRef<{ id: string; startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    const node = findNodeAt(x, y);
    if (node) {
      // Don't start drag immediately — wait for movement past threshold
      pendingDragRef.current = { id: node.id, startX: e.clientX, startY: e.clientY, offsetX: x - node.x, offsetY: y - node.y };
    } else {
      isPanningRef.current = true;
      panMovedRef.current = false;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [screenToWorld, findNodeAt]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // Promote pending drag to real drag after 4px movement
    if (pendingDragRef.current && !dragRef.current) {
      const dx = e.clientX - pendingDragRef.current.startX;
      const dy = e.clientY - pendingDragRef.current.startY;
      if (dx * dx + dy * dy > 16) {
        dragRef.current = { id: pendingDragRef.current.id, offsetX: pendingDragRef.current.offsetX, offsetY: pendingDragRef.current.offsetY };
      }
    }

    if (dragRef.current) {
      const { x, y } = screenToWorld(e.clientX, e.clientY);
      const node = nodesRef.current.find((n) => n.id === dragRef.current!.id);
      if (node) {
        node.x = x - dragRef.current.offsetX;
        node.y = y - dragRef.current.offsetY;
        node.vx = 0;
        node.vy = 0;
      }
      return;
    }

    if (isPanningRef.current) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      if (dx * dx + dy * dy > 4) panMovedRef.current = true;
      targetPanRef.current.x += dx;
      targetPanRef.current.y += dy;
      // Also move actual pan immediately for responsive feel
      panRef.current.x += dx;
      panRef.current.y += dy;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      if (panMovedRef.current) {
        setSelectedNode(null);
        preSelectViewRef.current = null;
      }
      return;
    }

    // Hover detection
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    const node = findNodeAt(x, y);
    const prevHovered = hoveredRef.current;
    hoveredRef.current = node?.id ?? null;

    if (node && node.id !== prevHovered) {
      setHoveredNode(node);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    } else if (!node && prevHovered) {
      setHoveredNode(null);
    }
  }, [screenToWorld, findNodeAt]);

  const selectNode = useCallback((node: SimNode | null) => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    if (node) {
      // Save current view so we can restore on deselect
      preSelectViewRef.current = { zoom: zoomRef.current, pan: { ...panRef.current } };
      // Animate to center on node, zoomed in
      const targetZoom = 2.5;
      // Offset left so the card can show on the right
      const offsetX = w * 0.12;
      targetZoomRef.current = targetZoom;
      targetPanRef.current = {
        x: w / 2 - node.x * targetZoom - offsetX,
        y: h / 2 - node.y * targetZoom,
      };
      setSelectedNode(node);
      setHoveredNode(null);
      hoveredRef.current = null;
    } else {
      // Restore previous view
      if (preSelectViewRef.current) {
        targetZoomRef.current = preSelectViewRef.current.zoom;
        targetPanRef.current = { ...preSelectViewRef.current.pan };
        preSelectViewRef.current = null;
      }
      setSelectedNode(null);
    }
  }, []);

  const resetView = useCallback(() => {
    targetZoomRef.current = 1;
    targetPanRef.current = { x: 0, y: 0 };
    setSelectedNode(null);
    preSelectViewRef.current = null;
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- event required by onPointerUp signature
  const handlePointerUp = useCallback((_e: React.PointerEvent) => {
    const wasDragging = !!dragRef.current;

    // Zero velocity on the dragged node so it doesn't lurch
    if (dragRef.current) {
      const node = nodesRef.current.find((n) => n.id === dragRef.current!.id);
      if (node) { node.vx = 0; node.vy = 0; }
    }

    // If it was a click (no drag happened), handle selection
    if (!wasDragging && pendingDragRef.current) {
      const node = nodesRef.current.find((n) => n.id === pendingDragRef.current!.id);
      if (node) {
        selectNode(node);
      }
    } else if (!wasDragging && !pendingDragRef.current && isPanningRef.current && !panMovedRef.current) {
      // Clicked empty space without dragging — reset to default view
      resetView();
    }

    dragRef.current = null;
    pendingDragRef.current = null;
    isPanningRef.current = false;
    panMovedRef.current = false;
  }, [selectNode, resetView]);

  const handlePointerLeave = useCallback(() => {
    // Only clean up drag/pan state — do NOT deselect the node,
    // because the pointer may have left the canvas to interact
    // with the detail card overlay.
    if (dragRef.current) {
      const node = nodesRef.current.find((n) => n.id === dragRef.current!.id);
      if (node) { node.vx = 0; node.vy = 0; }
    }
    dragRef.current = null;
    pendingDragRef.current = null;
    isPanningRef.current = false;
    hoveredRef.current = null;
    setHoveredNode(null);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const newZoom = Math.max(0.3, Math.min(4, targetZoomRef.current * delta));

    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      targetPanRef.current.x = mx - (mx - targetPanRef.current.x) * (newZoom / targetZoomRef.current);
      targetPanRef.current.y = my - (my - targetPanRef.current.y) * (newZoom / targetZoomRef.current);
    }

    targetZoomRef.current = newZoom;
    setSelectedNode(null);
    preSelectViewRef.current = null;
  }, []);

  const zoomToCenter = useCallback((factor: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const oldZoom = targetZoomRef.current;
    const newZoom = Math.min(4, Math.max(0.3, oldZoom * factor));
    // Adjust pan so the viewport center stays fixed
    targetPanRef.current = {
      x: cx - (cx - targetPanRef.current.x) * (newZoom / oldZoom),
      y: cy - (cy - targetPanRef.current.y) * (newZoom / oldZoom),
    };
    targetZoomRef.current = newZoom;
  }, []);

  const zoomIn = useCallback(() => {
    zoomToCenter(1.3);
  }, [zoomToCenter]);

  const zoomOut = useCallback(() => {
    zoomToCenter(0.7);
  }, [zoomToCenter]);

  /* ── Lifecycle ── */
  useEffect(() => {
    // Wait one frame so the container has layout dimensions
    const raf = requestAnimationFrame(() => {
      resizeCanvas();
      initGraph();
      animFrameRef.current = requestAnimationFrame(() => renderRef.current());
    });

    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [resizeCanvas, initGraph, render]);

  return (
    <div className="relative h-full bg-echo-graph-bg">
      {/* Header + legend — overlays the canvas with gradient fade */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-echo-graph-header-from via-echo-graph-header-via to-transparent px-4 pt-3 pb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full text-echo-graph-text transition-colors hover:bg-echo-graph-btn-hover active:scale-[0.92]"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h2 className="font-serif text-[16px] font-medium tracking-tight text-echo-graph-text">
              Thought Constellation
            </h2>
            {!loading && (
              <p className="text-[12px] font-normal text-echo-graph-text-soft">
                {nodeCount} thoughts · {edgeCount} connections
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={zoomOut}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-echo-graph-text transition-colors hover:bg-echo-graph-btn-hover"
              aria-label="Zoom out"
            >
              <ZoomOut size={16} />
            </button>
            <button
              onClick={zoomIn}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-echo-graph-text transition-colors hover:bg-echo-graph-btn-hover"
              aria-label="Zoom in"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={resetView}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-echo-graph-text transition-colors hover:bg-echo-graph-btn-hover"
              aria-label="Reset view"
            >
              <Maximize2 size={16} />
            </button>
            <button
              onClick={() => setShowInfo((v) => !v)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-echo-graph-btn-hover ${showInfo ? "text-echo-accent" : "text-echo-graph-text"}`}
              aria-label="How connections work"
            >
              <Info size={16} />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-2 flex items-center gap-4 px-4 pl-13">
          <div className="flex items-center gap-1.5">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: USER_NODE_COLOR, boxShadow: `0 0 6px ${USER_NODE_GLOW}, 0 0 14px ${USER_NODE_GLOW}` }}
            />
            <span className="text-[11px] font-medium text-echo-graph-text">Your thoughts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="h-3 w-3 rounded-full border border-echo-graph-text/30"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 70%)", boxShadow: "0 0 6px rgba(255,255,255,0.4), 0 0 12px rgba(255,255,255,0.2)" }}
            />
            <span className="text-[11px] font-medium text-echo-graph-text">Resolved</span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="absolute inset-0 overflow-hidden">
        {loading && (
          <motion.div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <ConstellationCanvas width={280} height={280} />
            <span className="mt-4 text-[13px] font-light text-echo-graph-loading">
              mapping connections...
            </span>
          </motion.div>
        )}

        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-grab active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onWheel={handleWheel}
        />

        {/* Tooltip — hidden when a node is selected */}
        {hoveredNode && !selectedNode && (
          <motion.div
            className="pointer-events-none absolute z-20 max-w-65 rounded-xl border-2 border-echo-graph-overlay-border bg-echo-graph-overlay-bg px-3.5 py-2.5 shadow-xl"
            style={{
              left: Math.min(tooltipPos.x + 14, containerWidth - 280),
              top: Math.max(tooltipPos.y - 60, 8),
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.12 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: hoveredNode.color }}
              />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-echo-graph-overlay-muted">
                {hoveredNode.theme.replace(/_/g, " ")}
              </span>
              {hoveredNode.isUser && (
                <span className="rounded-full bg-echo-accent/15 px-1.5 py-0.5 text-[9px] font-bold text-echo-accent">
                  you
                </span>
              )}
            </div>
            <p className="text-[12px] font-normal leading-snug text-echo-graph-overlay-text">
              {hoveredNode.label}
            </p>
            {hoveredNode.hasResolution && (
              <p className="mt-1 text-[10px] font-semibold text-emerald-600">
                ✓ resolved
              </p>
            )}
          </motion.div>
        )}

        {/* Selected node detail card */}
        <AnimatePresence>
          {selectedNode && (
              <motion.div
                key="detail-card"
                className="absolute right-3 top-3 bottom-3 z-30 flex w-[320px] flex-col rounded-2xl border-2 border-echo-graph-overlay-border bg-echo-graph-overlay-bg shadow-2xl"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Close button — pinned top-right */}
                <div className="flex justify-end px-4 pt-4 pb-0">
                  <button
                    onClick={() => selectNode(null)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-echo-graph-overlay-muted transition-colors hover:bg-echo-graph-overlay-hover-btn"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Scrollable content: thought + what helped + connected thoughts */}
                <div className="flex-1 overflow-y-auto px-5 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: selectedNode.color }}
                    />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-echo-graph-overlay-muted">
                      {selectedNode.theme.replace(/_/g, " ")}
                    </span>
                    {selectedNode.isUser && (
                      <span className="rounded-full bg-echo-accent/15 px-2 py-0.5 text-[9px] font-bold text-echo-accent">
                        you
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[14px] font-normal leading-snug text-echo-graph-overlay-text">
                    {selectedNode.fullText}
                  </p>
                  {selectedNode.hasResolution && (
                    <div className="mt-3">
                      <p className="text-[11px] font-semibold text-emerald-600">
                        ✓ resolved
                      </p>
                      {selectedNode.resolutionText && (
                        <div className="mt-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/30 px-3.5 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/70 dark:text-emerald-400/70 mb-1.5">
                            What helped
                          </p>
                          <p className="text-[12px] leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">
                            {selectedNode.resolutionText}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Divider */}
                  <div className="my-3 h-px bg-echo-graph-overlay-divider" />

                  {/* Connected thoughts */}
                  {connectedForDetail.length > 0 ? (
                    <div className="rounded-xl border border-echo-graph-overlay-divider bg-echo-graph-overlay-card-bg p-4">
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-echo-graph-overlay-muted">
                        Connected thoughts
                      </p>
                      <div className="flex flex-col gap-0.5">
                        {connectedForDetail.map(({ node: cn, similarity }) => (
                          <button
                            key={cn.id}
                            className="flex items-start gap-2.5 rounded-xl p-2.5 text-left transition-colors hover:bg-echo-graph-overlay-hover cursor-pointer"
                            onClick={() => selectNode(cn)}
                          >
                            <div
                              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: cn.color }}
                            />
                            <div className="min-w-0">
                              <p className="text-[12px] font-normal leading-snug text-echo-graph-overlay-text">
                                {cn.fullText}
                              </p>
                              <p className="mt-0.5 text-[10px] font-semibold text-echo-graph-overlay-link">
                                {Math.round(similarity * 100)}% similar
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px] font-normal text-echo-graph-overlay-muted">
                      No connected thoughts
                    </p>
                  )}
                </div>
              </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!loading && nodeCount === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[14px] font-light text-echo-graph-text/70">
              No thoughts yet
            </p>
            <p className="mt-1 text-[11px] font-light text-echo-graph-text/50">
              Share a thought to see it appear here
            </p>
          </div>
        )}
      </div>

      {/* How connections work — info overlay */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            key="info-overlay"
            className="absolute inset-0 z-40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setShowInfo(false)} />

            {/* Card */}
            <motion.div
              className="relative z-10 mx-4 w-full max-w-[380px] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white/90 dark:bg-[#1a1a2e]/90 p-6 shadow-2xl backdrop-blur-xl"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                onClick={() => setShowInfo(false)}
                className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-full text-black/30 dark:text-white/40 transition-colors hover:bg-black/5 dark:hover:bg-white/10 hover:text-black/60 dark:hover:text-white/70"
              >
                <X size={14} />
              </button>

              <h3 className="font-serif text-[15px] font-medium text-black/85 dark:text-white/90 mb-5">
                How connections form
              </h3>

              <div className="flex flex-col gap-4">
                <div className="flex gap-3">
                  <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[10px] text-black/40 dark:text-white/50">1</div>
                  <p className="text-[12px] leading-relaxed text-black/50 dark:text-white/60">
                    Every thought is <span className="text-black/75 dark:text-white/80">anonymised</span> and transformed into a semantic vector — capturing meaning, not keywords.
                  </p>
                </div>

                <div className="flex gap-3">
                  <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[10px] text-black/40 dark:text-white/50">2</div>
                  <p className="text-[12px] leading-relaxed text-black/50 dark:text-white/60">
                    Thoughts with high <span className="text-black/75 dark:text-white/80">emotional similarity</span> are linked. The stronger the resonance, the closer the connection.
                  </p>
                </div>

                <div className="flex gap-3">
                  <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[10px] text-black/40 dark:text-white/50">3</div>
                  <p className="text-[12px] leading-relaxed text-black/50 dark:text-white/60">
                    Nodes cluster by <span className="text-black/75 dark:text-white/80">theme</span> — similar struggles gravitate together, forming constellations of shared experience.
                  </p>
                </div>
              </div>

              <div className="mt-5 h-px bg-black/[0.06] dark:bg-white/[0.06]" />

              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: USER_NODE_COLOR, boxShadow: `0 0 6px ${USER_NODE_GLOW}` }} />
                  <span className="text-[10px] text-black/35 dark:text-white/40">Yours</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full border border-black/15 dark:border-white/20" style={{ boxShadow: "0 0 5px rgba(128,128,128,0.2)" }} />
                  <span className="text-[10px] text-black/35 dark:text-white/40">Resolved</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-black/15 dark:bg-white/20" />
                  <span className="text-[10px] text-black/35 dark:text-white/40">Others</span>
                </div>
              </div>

              <p className="mt-4 text-[10px] leading-relaxed text-black/20 dark:text-white/25">
                No personal information is stored. All connections are formed from anonymised text.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
