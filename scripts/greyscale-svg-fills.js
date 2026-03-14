/**
 * greyscale-svg-fills.js
 *
 * WHY GREYSCALE? 
 * The CSS pipeline  sepia(1) → hue-rotate(X°) → saturate(S) → brightness(B)
 * is FULLY DETERMINISTIC when the input image is greyscale.
 * Every pixel's colour after sepia+hue-rotate depends ONLY on its luminance,
 * so if all 8 SVGs start as greyscale, the same filter values produce the
 * IDENTICAL colour on every persona.
 *
 * This converts every fill="#rrggbb" to its greyscale equivalent:
 *   L = 0.2126*R + 0.7152*G + 0.0722*B  (perceptual luma)
 *   output #LLLLLL  where LL = hex(round(L*255))
 */

const fs   = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../frontend/public');

for (let i = 1; i <= 8; i++) {
  // Use the ORIGINALS if they exist; otherwise fall back to whatever is there.
  // We re-read from the current file each run (idempotent for greyscale inputs).
  const file = path.join(publicDir, `Persona${i}.svg`);
  let svg = fs.readFileSync(file, 'utf8');
  let replaced = 0;

  svg = svg.replace(/fill=(["'])#([0-9a-fA-F]{6})\1/g, (match, q, hex) => {
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;

    // Perceptual luminance (ITU-R BT.709)
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const lv = Math.round(L * 255).toString(16).padStart(2, '0');
    replaced++;
    return `fill="${`#${lv}${lv}${lv}`}"`;
  });

  fs.writeFileSync(file, svg, 'utf8');
  console.log(`Persona${i}.svg — ${replaced} fills → greyscale`);
}

console.log('\nDone. All SVGs are now pure greyscale. CSS sepia+hue-rotate will be consistent.');
