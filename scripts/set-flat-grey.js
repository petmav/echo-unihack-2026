/**
 * set-flat-grey.js
 *
 * Each Persona SVG has essentially ONE luminance value per file —
 * the artwork structure is formed by path *shape*, not tonal variation.
 * 
 * Strategy: set EVERY fill to the same mid-grey (#555555 = 33% luminance).
 * This gives sepia(1)+hue-rotate(X) a consistent, strong colour output
 * across all 8 personas.  The icon silhouette remains because the SVG
 * paths themselves define the shape.
 *
 * Run AFTER restoring original Persona SVGs (not after greyscale scripts).
 */

const fs   = require('fs');
const path = require('path');

// Mid-grey: dark enough that sepia produces visible colour, light enough
// that the icon doesn't look black.
const TARGET_GREY = '#555555';

const publicDir = path.join(__dirname, '../frontend/public');

for (let i = 1; i <= 8; i++) {
  const file = path.join(publicDir, `Persona${i}.svg`);
  let svg = fs.readFileSync(file, 'utf8');
  let count = 0;

  svg = svg.replace(/fill=(["'])#([0-9a-fA-F]{6})\1/g, (match, q) => {
    count++;
    return `fill="${TARGET_GREY}"`;
  });

  fs.writeFileSync(file, svg, 'utf8');
  console.log(`Persona${i}.svg — ${count} fills set to ${TARGET_GREY}`);
}

console.log('\nDone. All fills are now mid-grey. sepia+hue-rotate will be fully consistent.');
