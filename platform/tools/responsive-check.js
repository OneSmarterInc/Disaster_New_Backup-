#!/usr/bin/env node
// On a narrow screen every table becomes stacked cards, and each cell shows the
// column it came from. A cell without a data-l attribute loses its meaning
// entirely once the header row is hidden — which is invisible on a desktop and
// obvious on a phone.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public');
let bad = 0;

for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.html'))) {
  const s = fs.readFileSync(path.join(dir, file), 'utf8');
  if (!s.includes('<td')) continue;
  // colspan cells span the whole row, so they need no label
  const unlabelled = [...s.matchAll(/<td(?![^>]*(?:data-l|colspan))[^>]*>/g)];
  if (unlabelled.length) {
    bad += unlabelled.length;
    console.log(`  ${file}: ${unlabelled.length} cell${unlabelled.length === 1 ? '' : 's'} with no column label`);
    [...new Set(unlabelled.map(m => m[0]))].forEach(t => console.log(`      ${t.slice(0, 70)}`));
  }
}

const css = fs.readFileSync(path.join(dir, 'app.css'), 'utf8');
if (!css.includes('attr(data-l)')) { console.error('  app.css does not render the labels'); bad++; }

if (bad) { console.error(`\n${bad} problem${bad === 1 ? '' : 's'} on narrow screens.`); process.exit(1); }
console.log('responsive check: every table cell keeps its meaning on a phone');
