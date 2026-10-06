#!/usr/bin/env node
// Public copy should read as though somebody wrote it. This flags the two
// things that make it read otherwise: sentences that run on, and the handful of
// words that turn up when nobody is paying attention.
const fs = require('fs');
const path = require('path');

const TELLS = [
  'leverage','seamless','robust','cutting-edge','game.changer','unlock','harness',
  'delve','realm','tapestry','synergy','paradigm','next.gen','elevate','empower',
  'transformative','holistic','best.in.class','turnkey','world.class','revolutionary',
  'ensure that you','it is worth noting','in today','landscape','journey','solutions',
  'moreover','furthermore','additionally'
];

let bad = 0;

// the copy that ships on the public page
const sources = [
  ['catalogue defaults', require(path.join(__dirname, '../lib/catalogue.js')).DEFAULTS],
];
for (const d of ['sim', 'sim-02']) {
  try {
    const { META } = require(path.join(__dirname, '../..', d, 'lib/scenario.js'));
    if (META && META.detail) sources.push([META.id, META.detail]);
  } catch (e) {}
}

for (const [name, obj] of sources) {
  const complaints = [];
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v !== 'string' || !v.trim()) continue;
    for (const t of TELLS) {
      if (new RegExp('\\b' + t + '\\b', 'i').test(v)) complaints.push(`${k}: "${t}"`);
    }
    // a sentence past 35 words has usually stopped being one
    v.split(/(?<=[.!?])\s+/).forEach(sent => {
      const n = sent.trim().split(/\s+/).length;
      if (n > 35) complaints.push(`${k}: a ${n}-word sentence`);
    });
  }
  if (complaints.length) { bad += complaints.length; console.log(`  ${name}`); complaints.forEach(c => console.log(`      ${c}`)); }
}

if (bad) { console.error(`\n${bad} thing${bad === 1 ? '' : 's'} to rewrite.`); process.exit(1); }
console.log(`prose check: ${sources.length} sources, nothing overlong and none of the usual tells`);

// And nothing published may state the outcome. This is the fault that reached a
// live page twice: a guard looking for named terms passed a description that
// simply said what the answer was, in ordinary words.
{
  const { statesOutcome } = require(path.join(__dirname, '../lib/catalogue.js'));
  let told = 0;
  for (const [name, obj] of sources) {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v !== 'string') continue;
      const hits = statesOutcome(v);
      if (hits.length) { told++; console.log(`  ${name} · ${k} states the outcome: ${hits.join(', ')}`); }
    }
  }
  if (told) { console.error('\nPublic copy must not say how it ends.'); process.exit(1); }
  console.log('outcome check: nothing published says how a simulation ends');
}

// And it has to be readable by somebody who does not already know the world.
// Long sentences and long words are what make copy sound like it was written
// for people already inside it.
{
  const JARGON = [
    'entitlement','provision','stakeholder','remediation','mitigate','escalation path',
    'operational','infrastructure','architecture','methodology','framework','competency',
    'pedagogical','facilitate the','instantiate','leverage','utilise','utilize',
    'commitments','disclosure obligations','exposure runs','playbooks are opposed'
  ];
  let rough = 0;
  for (const [name, obj] of sources) {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v !== 'string' || !v.trim()) continue;
      const sents = v.split(/(?<=[.!?])\s+/).filter(Boolean);
      const words = v.split(/\s+/).filter(Boolean);
      const per = words.length / sents.length;
      if (per > 22) { rough++; console.log(`  ${name} · ${k}: ${Math.round(per)} words a sentence`); }
      // Length alone is a poor test — 'manufacturing' is a word everybody
      // knows. What makes copy hard is the abstract ending, so look for that.
      const heavy = words.filter(w => /(?:isation|ization|ality|ivity|ology|ment(?:s)?ation|ification)\b/i.test(w));
      if (heavy.length) { rough++; console.log(`  ${name} · ${k}: ${heavy.join(', ')}`); }
      JARGON.forEach(j => {
        if (new RegExp('\\b' + j + '\\b', 'i').test(v)) { rough++; console.log(`  ${name} · ${k}: "${j}"`); }
      });
    }
  }
  if (rough) { console.error('\nWrite it for somebody who has not seen this before.'); process.exit(1); }
  console.log('reading check: short sentences, plain words');
}
