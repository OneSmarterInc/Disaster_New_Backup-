#!/usr/bin/env node
// Assertion-only build gate: it never rewrites source. It refuses to pass if
// history, stage values or real names reach a browser page, if a page would
// break under the /sim09 path prefix, if a script does not parse, if the access
// gate regresses, or if the deployment config would silently stop building.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const C = require('./config/content.js');

const read = (f) => fs.readFileSync(path.join(__dirname, 'public', f), 'utf8');
const pages = { student: read('index.html'), launcher: read('launch.html'), instructor: read('instructor.html') };
const problems = [];
const refuse = (m) => problems.push(m);

// History, names and values arrive from the server one released stage at a time.
const secret = [];
for (const s of C.REVEAL.stages) secret.push(s.direction, s.destination, ...Object.values(s.companies));
secret.push(...Object.values(C.REVEAL.names), C.REVEAL.closing, C.DEBRIEF.epilogue, C.DEBRIEF.sawItComing);
for (const c of C.COMPANIES) for (const st of Object.values(c.stages)) secret.push(st.note);
const REAL_NAMES = /FreeMarkets|Verticalnet|VerticalNet|Chemdex|Ventro|NexPrise|Commerce One|Ariba/;

for (const [name, html] of Object.entries(pages)) {
  for (const s of secret) if (s && html.includes(s)) refuse(`${name} page contains scenario content: "${s.slice(0, 50)}"`);
  if (REAL_NAMES.test(html)) refuse(`${name} page names a real company: ${html.match(REAL_NAMES)[0]}`);
  if (/fetch\s*\(\s*['"`]\/api\//.test(html)) refuse(`${name} page has an unprefixed /api fetch`);
  if (!html.includes("location.pathname.match(/^\\/sim-?\\d+/)")) refuse(`${name} page is missing the path-prefix detector`);
  if (/m05-|m03-|Midland|Loopwell|Dana/.test(html)) refuse(`${name} page still carries another sim's names or storage keys`);
  for (const [, js] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    try { new vm.Script(js); } catch (e) { refuse(`${name} page script does not parse: ${e.message}`); }
  }
}
for (const m of ['x-access-code', "sessionStorage.setItem('m09-access'", "sessionStorage.removeItem('m09-access'", '/api/config']) {
  if (!pages.launcher.includes(m)) refuse('access gate missing: ' + m);
}
// The wall and the fund both keep a confirm step before anything is final.
for (const m of ['confirmStatements', 'confirmAllocation', 'goBack']) {
  if (!pages.student.includes(m)) refuse('student page lost a confirm step: ' + m);
}
// The instructor must choose a mode: no radio may arrive pre-checked by default.
if (/name="mode" value="\w+" checked/.test(pages.instructor)) refuse('instructor page pre-selects a play mode');
if (!pages.instructor.includes("SIM='" + C.META.id + "'")) refuse('instructor page renews faculty access for the wrong sim id');

// Deployment config that has silently stopped builds before.
const vercel = fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf8');
if (/"deploymentEnabled"\s*:\s*false/.test(vercel)) refuse('vercel.json sets deploymentEnabled: false, which stops git deployments building');

if (problems.length) { console.error('REFUSING build:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log(`PASS build: ${Object.keys(pages).length} pages, ${secret.length} scenario strings kept server-side`);
