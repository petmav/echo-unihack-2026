/**
 * normalise-luma-range.js
 *
 * After greyscale conversion, different SVGs can have very different luminance
 * ranges — some are near-white (barely visible after sepia tint), others are
 * darker.  This script remaps the luma values of EACH SVG so that:
 *
 *   - The overall DARKEST fill → TARGET_DARK  (e.g. 0.12)
 *   - The overall LIGHTEST fill → TARGET_LIGHT (e.g. 0.72)
 *
 * Every SVG ends up with the same dynamic range, so  sepia+hue-rotate
 * produces identical colour intensity on all 8 personas.
 *
 * Input:  greyscale SVGs from greyscale-svg-fills.js
 * Output: luminance-normalised SVGs (in place)
 */

const fs   = require('fs');
const path = require('path');

const TARGET_DARK  = 0.12;   // how dark the darkest fill should be  (0=black)
const TARGET_LIGHT = 0.72;   // how light the lightest fill should be (1=white)

const publicDir = path.join(__dirname, '../frontend/public');

for (let i = 1; i <= 8; i++) {
  const file = path.join(publicDir, `Persona${i}.svg`);
  let svg = fs.readFileSync(file, 'utf8');

  // ── 1. Collect all luma values ──────────────────────────────────────────────
  const lumas = [];
  const fillRe = /fill=(["'])#([0-9a-fA-F]{6})\1/g;
  let m;
  while ((m = fillRe.exec(svg)) !== null) {
    // Greyscale: R = G = B, so just read R channel
    const v = parseInt(m[2].slice(0, 2), 16) / 255;
    lumas.push(v);
  }

  if (lumas.length === 0) {
    console.log(`Persona${i}.svg — no fills found, skipping`);
    continue;
  }

  const srcMin = Math.min(...lumas);
  const srcMax = Math.max(...lumas);
  console.log(`Persona${i}.svg  src luma [${srcMin.toFixed(3)}, ${srcMax.toFixed(3)}]`);

  // ── 2. Remap each fill ──────────────────────────────────────────────────────
  svg = svg.replace(/fill=(["'])#([0-9a-fA-F]{6})\1/g, (match, q, hex) => {
    const src = parseInt(hex.slice(0, 2), 16) / 255;

    // Linear remap: src → [TARGET_DARK, TARGET_LIGHT]
    const range  = srcMax - srcMin || 1;
    const mapped = TARGET_DARK + ((src - srcMin) / range) * (TARGET_LIGHT - TARGET_DARK);
    const clamped = Math.max(0, Math.min(1, mapped));
    const lv = Math.round(clamped * 255).toString(16).padStart(2, '0');
    return `fill="${`#${lv}${lv}${lv}`}"`;
  });

  fs.writeFileSync(file, svg, 'utf8');
  console.log(`  → remapped ${lumas.length} fills to [${TARGET_DARK}, ${TARGET_LIGHT}]`);
}

console.log('\nDone. All SVGs now share a normalised luminance range.');
