#!/usr/bin/env node
// Every error written into a page needs somewhere to land. A handler that puts
// its message into an element the render never produced fails silently — the
// action appears to do nothing at all, which is worse than an error.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public');
let bad = 0;

for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.html'))) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8');

  // attributes a handler looks for
  const wanted = new Set([...s.matchAll(/querySelector\(`\[data-([\w-]+)="/g)].map(m => m[1]));
  for (const attr of wanted) {
    // is anything rendered with it?
    const rendered = new RegExp(`data-${attr}="\\$\\{`).test(s) || new RegExp(`data-${attr}="[^$]`).test(s);
    if (!rendered) { bad++; console.log(`  ${f}: nothing renders data-${attr}, so messages sent there vanish`); }
  }
}

if (bad) { console.error(`\n${bad} message target${bad === 1 ? '' : 's'} missing.`); process.exit(1); }
console.log('error target check: every message has somewhere to appear');
