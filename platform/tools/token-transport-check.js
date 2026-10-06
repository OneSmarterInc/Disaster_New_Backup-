#!/usr/bin/env node
// A launch token identifies a person and their role. Put in the query string it
// reaches every access log and proxy between here and the simulation before the
// page can tidy it away; put in the fragment it is never sent at all. Both sims
// read either, so there is no reason to use the query.
const fs = require('fs');
const path = require('path');

const s = fs.readFileSync(path.join(__dirname, '../api/launch.js'), 'utf8');
let bad = 0;

if (/\?lt=/.test(s)) { bad++; console.log('  the launch handoff puts the token in the query string'); }
if (!/#lt=/.test(s)) { bad++; console.log('  the launch handoff does not use the fragment'); }

// and both sims must still be able to read it
for (const d of ['sim', 'sim-02']) {
  const e = fs.readFileSync(path.join(__dirname, '../..', d, 'src/engine.js'), 'utf8');
  if (!/location\.hash/.test(e)) { bad++; console.log(`  ${d} does not read a token from the fragment`); }
}

if (bad) { console.error('\nThe token would be logged on the way.'); process.exit(1); }
console.log('token transport: handed over in the fragment, and both simulations read it there');
