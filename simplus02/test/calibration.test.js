'use strict';
// Calibration suite for Who Pays for the Wire? Run: node test/calibration.test.js
const C = require('../data/config');
const M = require('../engine/model');

let fails = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) fails++;
}
const all = f => f.utility && f.developer && f.manufacturers && f.advocate;
const filed = Object.fromEntries(Object.entries(C.dials).map(([k, v]) => [k, v.filed]));
const DIALS = Object.keys(C.dials);

// 1 and 2: zone of agreement exists and is narrow
const zone = []; let n = 0;
for (const p of M.grid()) { n++; if (all(M.floors(p))) zone.push(p); }
check('1. Zone of agreement exists', zone.length > 0, `${zone.length} packages`);
check('2. Zone is narrow (< 2% of grid)', zone.length / n < 0.02, `${(100 * zone.length / n).toFixed(2)}% of ${n}`);

// 3: filed proposal fails at least one non-utility seat
const ff = M.floors(filed);
const failing = ['developer', 'manufacturers', 'advocate'].filter(k => !ff[k]);
check('3. Filed proposal fails another seat', failing.length > 0, `fails: ${failing.join(', ') || 'none'}`);

// 4: full fallback breaches all four floors (every corner of the published ranges)
const F = C.fallback; let breachAll = true; const survivors = new Set();
const corners = [[]];
for (const d of DIALS) { const nx = []; for (const c of corners) for (const v of F[d]) nx.push([...c, [d, v]]); corners.splice(0, corners.length, ...nx); }
for (const c of corners) for (const per of F.freezeMonthsPerOpenDial) {
  const p = Object.fromEntries(c); const f = M.floors(p, per * DIALS.length);
  for (const k in f) if (f[k]) { breachAll = false; survivors.add(k); }
}
check('4. Full fallback breaches all four floors', breachAll, survivors.size ? `still clears: ${[...survivors].join(', ')}` : '');

// 5: leaving any one dial open (which imposes its whole settlement group)
// leaves every seat worse off in expectation, from every zone package
let bad = 0; const badBy = {};
for (const p of zone) {
  const base = M.payoffs(p);
  for (const d of DIALS) {
    const e = M.expectedWithOpen(p, [d]);
    for (const k in base) if (e[k] >= base[k]) { bad++; badBy[`${d}->${k}`] = (badBy[`${d}->${k}`] || 0) + 1; }
  }
}
check('5. Leaving any dial open hurts every seat', bad === 0, bad ? JSON.stringify(badBy) : `${zone.length * DIALS.length} cases`);

// 6: subscription response targets
const sf = M.subscribedMW(filed);
const loose = { top: 50, term: 5, exit: 0, coll: 0, threshold: 25 };
const fbMid = { top: 92.5, term: 14.5, exit: 4.5, coll: 33, threshold: 15 };
// 5b: groups cover every dial exactly once
const grouped = Object.values(C.settlementGroups).flat();
check('5b. Settlement groups cover each dial once', grouped.length === DIALS.length && DIALS.every(d => grouped.includes(d)));

check('6a. Filed terms ~5,700 MW', Math.abs(sf - 5700) < 300, `${sf.toFixed(0)} MW`);
check('6b. Loose terms ~30,000 MW', Math.abs(M.subscribedMW(loose) - 30000) < 500, `${M.subscribedMW(loose).toFixed(0)} MW`);
check('6c. Fallback ~3,000 MW', Math.abs(M.subscribedMW(fbMid) - 3000) < 600, `${M.subscribedMW(fbMid).toFixed(0)} MW`);

console.log(fails ? `\n${fails} FAILED` : '\nAll calibration tests pass');
process.exit(fails ? 1 : 0);
