const fs = require('fs');
const path = require('path');

for (let i = 1; i <= 8; i++) {
  const file = path.join(__dirname, `../frontend/public/temp${i}.svg`);
  let content = fs.readFileSync(file, 'utf8');

  // The background is always the first <g>...</g> block — a path anchored at M -0.5,-0.5
  // Strategy: remove the first <g>...</g> block by finding the first occurrence
  const firstGStart = content.indexOf('<g>');
  const firstGEnd = content.indexOf('</g>') + 4;
  if (firstGStart !== -1 && firstGEnd > 4) {
    content = content.substring(0, firstGStart) + content.substring(firstGEnd);
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log('Processed temp' + i + '.svg, removed first <g> block');
}
console.log('Done!');
