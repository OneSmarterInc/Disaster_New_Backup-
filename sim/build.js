#!/usr/bin/env node
// Assembles public/index.html from the three source files in src/.
// The client is a single self-contained file so it loads in one request and has
// no build step at deploy time — this script is just how it gets stitched.
const fs = require('fs');
const path = require('path');

const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');

const out = src('shell.html')
  .replace('/*__SCENARIO__*/', src('client-scenario.js'))
  .replace('/*__ENGINE__*/', src('engine.js'));

const dest = path.join(__dirname, 'public', 'index.html');
fs.writeFileSync(dest, out);
console.log(`built ${path.relative(process.cwd(), dest)} — ${out.length} bytes`);

// Guard: the scenario must never end up in the browser bundle.
//
// The list below is checked case-insensitively and in fragments, because a
// previous version tested for 'Q3 cost review' while the bundle actually
// shipped 'q3|cost review|overrul|...' — different wording, so the check passed
// on a file that leaked. Match on the smallest distinctive piece, not on a
// phrase someone might reword.
// Distinctive fragments only. Avoid anything that is a substring of an ordinary
// word — 'knowledge' matches 'acknowledge', for instance. FW-2231 is absent
// deliberately: it is named on the opening screens as part of Kate's exposure.
const forbidden = [
  'svc-bkp-legacy', 'san-07', 'crm-db',
  'cost review', 'was overruled', 'edr coverage', 'coverage was cut',
  'ground_truth', 'prohibitions:', 'tier 2', 'tier 1',
  'dwell time', 'firmware fault caused', 'staging directory'
];
const hay = out.toLowerCase();
const leaked = forbidden.filter(t => hay.includes(t));
if (leaked.length) {
  console.error('REFUSING: scenario content reached the client bundle:', leaked.join(', '));
  console.error('Anything a student can read must not tell them what the sim is watching for.');
  process.exit(1);
}
console.log(`scenario audit: clean (${forbidden.length} markers checked)`);

// The catalogue copy is published on a public page, so it must give nothing
// away. Two checks, because the first one alone let a description through that
// stated the resolution outright.
{
  const S = require('./lib/scenario.js');
  const blurb = JSON.stringify(S.META || {}).toLowerCase();

  // 1. The named things — same markers that guard the browser bundle.
  const named = forbidden.filter(t => blurb.includes(t));

  // 2. Anything the copy has in common with the resolution. A run of five
  //    words shared with GROUND_TRUTH means the description is doing the
  //    simulation's job for it.
  const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const runs = (t, n) => {
    const w = norm(t).split(' ');
    const out = new Set();
    for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
    return out;
  };
  const truth = runs(JSON.stringify(S.GROUND_TRUTH || {}), 5);
  const shared = [...runs(JSON.stringify(S.META || {}), 5)].filter(r => truth.has(r));

  // 3. The shapes a resolution takes, whatever words it uses.
  const TELLS = [
    'both are true', 'neither alone', 'it was both', 'turns out to be both',
    'the real cause', 'what actually caused', 'the answer is',
    'destroys the evidence', 'unless somebody stops', 'unless someone stops'
  ];
  const shapes = TELLS.filter(t => blurb.includes(t));

  const problems = [
    ...named.map(t => `names "${t}"`),
    ...shared.slice(0, 3).map(r => `shares a phrase with the resolution: "${r}"`),
    ...shapes.map(t => `states the outcome: "${t}"`)
  ];
  if (problems.length) {
    console.error('REFUSING: the catalogue copy gives the simulation away:');
    problems.forEach(x => console.error('  · ' + x));
    process.exit(1);
  }
  console.log('catalogue audit: clean (named terms, shared phrasing, and stated outcomes)');
}

// Served under a path behind the platform's domain, every request has to carry
// that path. Checked here because the failure only shows up when somebody opens
// it at /sim01, by which time it is in front of a class.
{
  const { execFileSync } = require('child_process');
  try {
    execFileSync(process.execPath, [require('path').join(__dirname, 'tools/prefix-check.js')], { stdio: 'inherit' });
    execFileSync(process.execPath, [require('path').join(__dirname, 'tools/session-contract-check.js')], { stdio: 'inherit' });
  } catch (e) {
    process.exit(1);
  }
}
