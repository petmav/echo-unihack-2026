// frontend/scripts/generate-icon.js
const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const svgPath = path.join(__dirname, '..', 'public', 'icon.svg');
const outDir  = path.join(__dirname, '..', 'resources');
const outPath = path.join(outDir, 'icon.png');

fs.mkdirSync(outDir, { recursive: true });

sharp(svgPath)
  .resize(1024, 1024)
  .png()
  .toFile(outPath)
  .then(() => console.log('[generate-icon] Written: ' + outPath))
  .catch(err => { console.error(err); process.exit(1); });
