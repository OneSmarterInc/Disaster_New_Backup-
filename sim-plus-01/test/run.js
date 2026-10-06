'use strict';

const { classify } = require('../src/classifier');
const corpus = [...require('./corpus'), ...require('./adversarial')];

// Misroutes are not equally bad. A question that should be
// EXCEPTION_HANDLING landing in EFFICIENCY_FRAMING ends a run; one that
// lands in VOLUME_TIMING just costs the participant 90 seconds.
const CRITICAL = new Set(['EFFICIENCY_FRAMING']);
const DOOR_OPENERS = new Set([
  'EXCEPTION_HANDLING',
  'COUNTERFACTUAL',
  'SENDER_PERSPECTIVE'
]);

function severity(expected, actual) {
  if (expected === actual) return null;
  if (CRITICAL.has(actual) && !CRITICAL.has(expected)) return 'CRITICAL';
  if (DOOR_OPENERS.has(expected) && !DOOR_OPENERS.has(actual)) return 'HIGH';
  if (actual === 'GENERIC_DESCRIPTIVE') return 'HIGH';
  return 'LOW';
}

const results = corpus.map(([q, expected]) => {
  const { bucket, matchedBy } = classify(q);
  return { q, expected, actual: bucket, matchedBy, sev: severity(expected, bucket) };
});

const misses = results.filter((r) => r.sev);
const byLevel = (lvl) => misses.filter((r) => r.sev === lvl);

console.log(`\nCorpus: ${results.length}  Correct: ${results.length - misses.length}  Misroutes: ${misses.length}`);
console.log(`Accuracy: ${(((results.length - misses.length) / results.length) * 100).toFixed(1)}%\n`);

for (const lvl of ['CRITICAL', 'HIGH', 'LOW']) {
  const rows = byLevel(lvl);
  if (!rows.length) continue;
  console.log(`--- ${lvl} (${rows.length}) ---`);
  for (const r of rows) {
    console.log(`  "${r.q}"`);
    console.log(`     expected ${r.expected}  ->  got ${r.actual}`);
    if (r.matchedBy) console.log(`     matched: /${r.matchedBy}/`);
  }
  console.log('');
}

// Coverage: every bucket in the taxonomy should be exercised and hit.
const hit = new Set(results.map((r) => r.actual));
const want = new Set(corpus.map(([, e]) => e));
const unhit = [...want].filter((b) => !hit.has(b));
if (unhit.length) console.log(`Buckets never returned: ${unhit.join(', ')}\n`);

process.exit(byLevel('CRITICAL').length ? 1 : 0);
