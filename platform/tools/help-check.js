#!/usr/bin/env node
// Every disclosure must have something behind it, and nothing should be written
// that no control reveals. Applies to both shapes: the small question marks
// beside headings, and labelled buttons like "Adding a new simulation".
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public');
let bad = 0;

for (const f of ['admin.html', 'faculty.html']) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8');

  // what can be pressed
  // the helper's own template is not a disclosure
  const controls = new Set([...s.matchAll(/data-help="([^"]+)"/g)]
    .map(m => m[1]).filter(k => !k.includes('${')));
  [...s.matchAll(/helpBtn\('([^']+)'/g)].forEach(m => controls.add(m[1]));

  // what can be shown
  const shown = new Set([...s.matchAll(/explain\('([^']+)'/g)].map(m => m[1]));
  [...s.matchAll(/(?:D|F)\.help === '([^']+)'/g)].forEach(m => shown.add(m[1]));

  // keys built at run time end in a quote-plus, so compare on the stem
  const stem = k => k.replace(/'.*$/, '');
  const cSet = new Set([...controls].map(stem));
  const sSet = new Set([...shown].map(stem));

  const noAnswer = [...cSet].filter(k => !sSet.has(k));
  const unreachable = [...sSet].filter(k => !cSet.has(k));

  console.log(`  ${f}: ${cSet.size} disclosure${cSet.size===1?'':'s'} — ${[...cSet].join(', ')}`);
  if (noAnswer.length) { bad++; console.log(`      NOTHING BEHIND: ${noAnswer.join(', ')}`); }
  if (unreachable.length) { bad++; console.log(`      UNREACHABLE TEXT: ${unreachable.join(', ')}`); }
}

if (bad) { console.error('\nSome help is broken.'); process.exit(1); }
console.log('help check: every disclosure has something behind it, and nothing is unreachable');
