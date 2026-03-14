/**
 * normalise-svg-hue.js
 *
 * Converts every fill="#rrggbb" in each Persona SVG to the same hue (~28° warm
 * brown) while preserving each path's original Lightness.  Saturation is gently
 * scaled so very-desaturated paths stay desaturated (shading / shadows stay intact).
 *
 * After running this, all 8 SVGs share an identical hue baseline, so a single
 * CSS  grayscale(1) sepia(1) hue-rotate(Xdeg)  filter will produce exactly the
 * same colour on every persona.
 */

const fs   = require('fs');
const path = require('path');

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

function rgbToHsl({ r, g, b }) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l   = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else                h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

function hslToHex({ h, s, l }) {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  const toHex = v => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ── Config ────────────────────────────────────────────────────────────────────

// Target hue in [0,1].  28° ≈ 0.0778  (warm brown — the natural "rose gold" base)
const TARGET_HUE = 28 / 360;

// Saturation cap: paths with very low original S stay soft; others are scaled up
// slightly so they read clearly as the target hue.
const SAT_SCALE  = 1.15;
const SAT_MAX    = 0.65;   // keep it monochrome-ish so CSS filter can still swing hue

// ── Process each file ─────────────────────────────────────────────────────────

const publicDir = path.join(__dirname, '../frontend/public');

for (let i = 1; i <= 8; i++) {
  const file = path.join(publicDir, `Persona${i}.svg`);
  let svg = fs.readFileSync(file, 'utf8');

  let replaced = 0;

  // Match both  fill="#rrggbb"  and  fill='#rrggbb'
  svg = svg.replace(/fill=["']#([0-9a-fA-F]{6})["']/g, (match, hex) => {
    const rgb = hexToRgb(`#${hex}`);
    const hsl = rgbToHsl(rgb);

    // Preserve lightness; reassign hue; gently scale saturation (capped)
    const newS = Math.min(hsl.s * SAT_SCALE, SAT_MAX);
    const newHsl = { h: TARGET_HUE, s: newS, l: hsl.l };

    const newHex = hslToHex(newHsl);
    replaced++;
    return `fill="${newHex}"`;   // normalise quotes to double-quote
  });

  fs.writeFileSync(file, svg, 'utf8');
  console.log(`Persona${i}.svg — ${replaced} fills normalised`);
}

console.log('\nDone. All SVGs now share hue ~28° (warm brown baseline).');
