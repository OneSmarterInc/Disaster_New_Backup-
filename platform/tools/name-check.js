#!/usr/bin/env node
// One spelling of the name. It is RapidSims, and RapidSim 01 for one of them.
// Anything with a space in the middle has been missed — including headings
// split across tags, which a plain find-and-replace walks straight past.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SKIP = new Set(['.git', 'node_modules']);
const bad = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!/\.(js|html|md|sql|json)$/.test(e.name)) continue;
    const s = fs.readFileSync(p, 'utf8');

    if (p === __filename) continue;   // this file describes the fault it looks for

    // the plain form
    [...s.matchAll(/Rapid Sims?\b/g)].forEach(() => bad.push(`${path.relative(ROOT, p)}: "Rapid Sim"`));

    // and the form that hides across tags: <h1>Rapid <em>Sims</em></h1>. A space
    // before the tag is the fault; RapidSims broken over an <em> is correct.
    [...s.matchAll(/Rapid\s+<[^>]+>\s*Sims?/g)].forEach(m =>
      bad.push(`${path.relative(ROOT, p)}: split across tags — ${m[0].replace(/\s+/g, ' ')}`));
  }
}
walk(ROOT);

if (bad.length) {
  [...new Set(bad)].forEach(b => console.log('  ' + b));
  console.error(`\n${bad.length} place${bad.length === 1 ? '' : 's'} still say Rapid Sim.`);
  process.exit(1);
}
console.log('name check: RapidSims everywhere, including headings split across tags');
