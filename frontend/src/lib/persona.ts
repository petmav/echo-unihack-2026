import type { PersonaConfig } from "./types";

export const DEFAULT_PERSONA: PersonaConfig = {
  color: "#BC8D7A", // Rose gold
  face: 0,
  accessory: 0,
};

export const AVATARS = [
  { label: "Tree of Life", src: "/Persona1.svg" },
  { label: "Framed Mountains", src: "/Persona2.svg" },
  { label: "Zen Stones", src: "/Persona3.svg" },
  { label: "Constellation Hands", src: "/Persona4.svg" },
  { label: "Earth Vine", src: "/Persona5.svg" },
  { label: "Meditating Figure", src: "/Persona6.svg" },
  { label: "Hourglass", src: "/Persona7.svg" },
  { label: "Book & Butterfly", src: "/Persona8.svg" },
];

export const COLORS = [
  {
    hex: "#C8B8A2",
    label: "Warm cream",
    filter: "sepia(1) hue-rotate(-2deg) saturate(0.50) brightness(1.20) contrast(1.05)",
  },
  {
    hex: "#BC8D7A",
    label: "Rose gold",
    filter: "sepia(1) hue-rotate(-19deg) saturate(1.10) brightness(0.95) contrast(1.10)",
  },
  {
    hex: "#7E9E8A",
    label: "Sage green",
    filter: "sepia(1) hue-rotate(114deg) saturate(0.85) brightness(0.90) contrast(1.10)",
  },
  {
    hex: "#9E8EB4",
    label: "Lavender",
    filter: "sepia(1) hue-rotate(231deg) saturate(1.30) brightness(0.88) contrast(1.10)",
  },
  {
    hex: "#6B5B3E",
    label: "Taupe",
    filter: "sepia(1) hue-rotate(2deg) saturate(0.65) brightness(0.65) contrast(1.15)",
  },
];

/** Compute a consistent persona based on a string ID (hash-based) */
export function getDeterministicPersona(id: string): PersonaConfig {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const face = Math.abs(hash) % AVATARS.length;
  const color = COLORS[Math.abs(hash) % COLORS.length].hex;
  return { color, face, accessory: 0 };
}

/** Merge potential persona data with defaults and sanitize types */
export function getSafePersona(p?: Partial<PersonaConfig> | null): PersonaConfig {
  return {
    color: p?.color ?? DEFAULT_PERSONA.color,
    face: p?.face ?? DEFAULT_PERSONA.face,
    accessory: Math.round(p?.accessory ?? DEFAULT_PERSONA.accessory),
  };
}
