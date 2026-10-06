#!/usr/bin/env node
// RapidSim 07 build gate. Assertion-only: it never rewrites source. It refuses
// deployment if anything before the reveal names the companies or points
// forward, if placeholder content remains, if identity is wrong, or if the
// pages break.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const C = require('./data/config.js');
const { publicConfig } = require('./api/config.js');

const read = (rel) => fs.readFileSync(path.join(__dirname, rel), 'utf8');
function refuse(message) { console.error('REFUSING:', message); process.exit(1); }

const pages = {
  student: read('public/index.html'),
  presenter: read('public/instructor.html'),
  projector: read('public/projector.html'),
  launcher: read('public/launch.html')
};

// 1. Identity.
if (C.META.id !== 'rapid-07-bought') refuse('catalogue id changed: ' + C.META.id);
const RETIRED = ['rapid-03-bench'];
if (RETIRED.includes(C.META.id) || (C.META.replaces || []).some(r => RETIRED.includes(r))) refuse('retired sim id reused');

// 2. The pre-reveal render path. This is exactly what reaches a browser before
// the reveal: the /api/config payload (built by the real function, not a copy of
// the text) plus every static page.
const leakScan = (text) => C.FORBIDDEN_PRE_REVEAL.filter(w => text.toLowerCase().includes(w.toLowerCase()));
const preRevealPayload = JSON.stringify(publicConfig());
const leaks = leakScan(preRevealPayload);
if (leaks.length) refuse('pre-reveal config payload contains: ' + leaks.join(', '));
for (const [name, html] of Object.entries(pages)) {
  const hit = leakScan(html);
  if (hit.length) refuse(`${name} page contains: ${hit.join(', ')}`);
}
// The scanner must be able to fail. Seed a leak into a copy of the real payload.
const seeded = JSON.parse(preRevealPayload);
seeded.briefing.sections[0].rows[0][1] += ' ' + C.FORBIDDEN_PRE_REVEAL[0];
if (!leakScan(JSON.stringify(seeded)).length) refuse('leak scanner did not catch a seeded leak');
// Reveal text must not be reachable from the config payload.
for (const s of C.REVEAL.stages) for (const p of s.body) if (preRevealPayload.includes(p)) refuse('reveal text is in the pre-reveal payload');

// 2b. Catalogue copy is shown before play, so it gets the same scan, plus a
// check for wording that hints at how the story ends.
const metaText = JSON.stringify(C.META);
const metaLeaks = leakScan(metaText);
if (metaLeaks.length) refuse('catalogue copy contains: ' + metaLeaks.join(', '));
for (const hint of ['mistake', 'wrong', 'failed', 'regret', 'outcome is known', 'look different after', 'later knowledge', 'became known later']) {
  if (metaText.toLowerCase().includes(hint)) refuse('catalogue copy hints at the ending: ' + hint);
}
if (C.META.detail.teaches !== 'what was knowable at the time · how hindsight rewrites a judgement') refuse('approved teaches line changed');
if (!C.PRE_REVEAL.intro || !C.PRE_REVEAL.intro.points.length) refuse('untimed intro screen content missing');
if (!pages.student.includes('function viewIntro()')) refuse('student page has no untimed intro screen');

// 3. Names appear in stage 3 and nowhere earlier in the reveal.
const st3 = C.REVEAL.stages.find(s => s.n === 3);
if (!st3 || !/Blockbuster/.test(st3.names || '') || !/Netflix/.test(st3.names || '')) refuse('stage 3 does not name the companies');
for (const s of C.REVEAL.stages.filter(s => s.n < 3)) {
  const hit = leakScan(JSON.stringify(s));
  if (hit.length) refuse(`stage ${s.n} contains: ${hit.join(', ')}`);
}

// 4. No placeholder content anywhere in the configuration.
const configText = read('data/config.js');
for (const pat of [/\bTODO\b/i, /\bTBD\b/i, /lorem ipsum/i, /PLACEHOLDER/i, /\bXXX\b/, /\[insert/i, /\?\?\?/]) {
  if (pat.test(configText)) refuse('placeholder content in data/config.js: ' + pat);
}
if (C.PRE_REVEAL.advisers.length !== 4) refuse('expected four advisers');
const positions = C.PRE_REVEAL.advisers.map(a => a.position).sort().join(',');
if (positions !== 'Buy,Decline,Decline,Wait') refuse('adviser balance changed: ' + positions);

// 5. Nothing scored, ranked or graded in the student-facing surfaces.
for (const w of ['Score:', 'Grade:', 'Rank:', 'Correct answer', 'You were wrong', 'You were right']) {
  if (pages.student.includes(w) || configText.includes(w)) refuse('grade-like language: ' + w);
}

// 6. Path prefix, access guard, parsing.
for (const [name, html] of Object.entries(pages)) {
  if (!html.includes("location.pathname.match(/^\\/sim-?\\d+/)")) refuse(`${name} page is missing the path-prefix detector`);
  if (/fetch\s*\(\s*['"]\/api\//.test(html)) refuse(`${name} page contains an unprefixed /api fetch`);
}
if (!read('api/config.js').includes('checkConfigAccess(req, res)')) refuse('config endpoint is not behind the access guard');
if (!read('api/reveal.js').includes('checkAccess(req, res)')) refuse('standalone reveal is not behind the access guard');
const vercel = JSON.parse(read('vercel.json'));
if (vercel.git && vercel.git.deploymentEnabled === false) refuse('vercel.json disables git deployments');
for (const [name, html] of Object.entries(pages)) {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  if (!scripts.length) refuse(`${name}: no inline script`);
  try { scripts.forEach((code, i) => new vm.Script(code, { filename: `${name}:${i + 1}` })); }
  catch (e) { refuse('browser JavaScript does not parse: ' + e.message); }
}

if (!process.argv.includes('--static-only')) {
  execFileSync(process.execPath, [path.join(__dirname, 'tools', 'checks.js')], { stdio: 'inherit' });
}
console.log('RapidSim 07 build gate passed.');
