#!/usr/bin/env node
// One address, everywhere. A page offering a way to get in touch that nobody
// reads is worse than not offering one, and an address that drifts between
// pages is how that happens.
const fs = require('fs');
const path = require('path');
const ADDRESS = 'support@flexee.org';
// The landing page also has an intentional business-enquiry contact.
const ENQUIRY = 'chuck@theguruofbiz.com';
const dir = path.join(__dirname, '..', 'public');
let bad = 0, footers = 0;

for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.html'))) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8');

  const others = [...new Set([...s.matchAll(/mailto:([^"?&]+)/g)].map(m => m[1]))]
    .filter(a => a !== ADDRESS && !(f === 'index.html' && a === ENQUIRY));
  if (others.length) { bad++; console.log(`  ${f}: a different address — ${others.join(', ')}`); }

  const foot = s.match(/foot-note[\s\S]*?<\/div><\/div>/);
  if (!foot) { bad++; console.log(`  ${f}: no footer`); continue; }
  footers++;
  if (!foot[0].includes('©') && !foot[0].includes('&copy;')) { bad++; console.log(`  ${f}: footer has no copyright`); }
  if (!foot[0].includes(ADDRESS)) { bad++; console.log(`  ${f}: footer has no address`); }
}

if (bad) { console.error(`\n${bad} problem${bad === 1 ? '' : 's'}.`); process.exit(1); }
console.log(`contact check: ${footers} footers, all carrying the copyright and ${ADDRESS}`);
