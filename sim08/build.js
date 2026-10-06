#!/usr/bin/env node
// Assertion-only build gate: it never rewrites source. It refuses to pass if any
// answer, plan, report or risk text reaches a page, if a page would break under
// the /sim08 path prefix, if its script does not parse, or if the access gate regresses.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const C = require('./config/content.js');

const read = (f) => fs.readFileSync(path.join(__dirname, 'public', f), 'utf8');
const pages = { student: read('index.html'), launcher: read('launch.html'), instructor: read('instructor.html') };
const platformLaunch = fs.readFileSync(path.join(__dirname, 'public', 'platform-launch.js'), 'utf8');
const problems = [];
const refuse = (m) => problems.push(m);

// Everything a student must earn arrives from the server, never in the bundle.
const secret = [];
for (const q of C.QUESTIONS) for (const a of Object.values(q.answers)) secret.push(a);
for (const p of C.PLANS) secret.push(p.text);
for (const v of Object.values(C.REPORTS)) for (const r of Object.values(v)) secret.push(r.text, r.headline);
secret.push(...Object.values(C.REPORT_NOTES), ...Object.values(C.DEBRIEF.riskLabels), ...C.DEBRIEF.naming, C.DEBRIEF.turn);
for (const [name, html] of Object.entries(pages)) {
  for (const s of secret) if (html.includes(s)) refuse(`${name} page contains scenario content: "${s.slice(0, 50)}"`);
  if (/fetch\s*\(\s*['"`]\/api\//.test(html)) refuse(`${name} page has an unprefixed /api fetch`);
  if (!html.includes("location.pathname.match(/^\\/sim-?\\d+/)")) refuse(`${name} page is missing the path-prefix detector`);
  if (/Loopwell|Would You Approve|m05-|Midland|m03-/.test(html)) refuse(`${name} page still carries another sim's names or storage keys`);
  for (const [, js] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    try { new vm.Script(js); } catch (e) { refuse(`${name} page script does not parse: ${e.message}`); }
  }
}
try { new vm.Script(platformLaunch, { filename: 'platform-launch.js' }); }
catch (e) { refuse(`platform-launch.js does not parse: ${e.message}`); }
for (const name of ['student', 'launcher']) {
  if (!pages[name].includes('<script src="platform-launch.js"></script>')) refuse(`${name} page is missing the RapidSims launch bridge`);
}
// Students never see tier labels, scores or rankings.
for (const w of [...Object.values(C.DEBRIEF.tierLabels), 'score', 'rank', 'correct answer']) {
  if (pages.student.toLowerCase().includes(w.toLowerCase())) refuse(`student page contains "${w}"`);
}
for (const m of ['x-access-code', "sessionStorage.setItem('m08-access'", "sessionStorage.removeItem('m08-access'", '/api/config']) {
  if (!pages.launcher.includes(m)) refuse('access gate missing: ' + m);
}
for (const m of ['confirmAsk', 'confirmVendor', 'confirmPlan', 'CFG.copy.back']) {
  if (!pages.student.includes(m)) refuse('student page lost a confirm step: ' + m);
}
if (!/revealStep/.test(pages.instructor)) refuse('instructor page lost the staged reveal');

if (problems.length) { console.error('REFUSING build:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log(`PASS build: ${Object.keys(pages).length} pages, ${secret.length} scenario strings kept server-side`);
