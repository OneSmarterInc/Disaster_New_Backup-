#!/usr/bin/env node
// Behind the platform's domain this simulation is served under /sim02, and
// every request has to carry that prefix. Defining BASE and then not using it
// looks fine to a syntax check and to a boot check: the code is valid, the page
// starts, and only the first call fails — with a 404 from the platform, which
// has no such endpoint. So this checks what every fetch actually passes.
const fs = require('fs');
const path = require('path');

const targets = [
  ['the built bundle', path.join(__dirname, '../public/index.html')],
  ['the session console', path.join(__dirname, '../public/faculty.html')]
];
let bad = 0;

for (const [name, file] of targets) {
  const s = fs.readFileSync(file, 'utf8');
  if (!s.includes('const BASE')) { bad++; console.log(`  ${name}: does not work out where it is served from`); continue; }

  // every call, and what it was handed
  const calls = [
    ...s.matchAll(/fetch\(\s*([^,)]+)/g),
    ...s.matchAll(/location\.replace\(\s*([^)]+?)\s*\)/g),
    ...s.matchAll(/location\.href\s*=\s*([^;]+);/g)
  ].map(m => m[1].trim());

  for (const arg of calls) {
    if (arg.startsWith('BASE')) continue;                  // carries the prefix
    if (/^['"`]https?:/.test(arg)) continue;               // somewhere else entirely
    if (/^['"`](?!\/)/.test(arg)) continue;                // relative already
    if (/^\/\//.test(arg)) continue;
    bad++;
    console.log(`  ${name}: a request that ignores the prefix — ${arg.slice(0, 48)}`);
  }
}

if (bad) {
  console.error('\nUnder /sim02 these land on the platform, which answers 404.');
  process.exit(1);
}
console.log('prefix check: every request carries the path it was served from');
