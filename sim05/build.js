#!/usr/bin/env node
// Assertion-only build gate: it never rewrites source. It refuses to pass if
// scenario content reaches the browser bundle, if the page would break under the
// /sim05 path prefix, if its script does not parse, or if the access gate regresses.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const C = require('./config/content.js');

const read = (f) => fs.readFileSync(path.join(__dirname, 'public', f), 'utf8');
const pages = { student: read('index.html'), launcher: read('launch.html') };
if (fs.existsSync(path.join(__dirname, 'public', 'instructor.html'))) pages.instructor = read('instructor.html');
const problems = [];
const refuse = (m) => problems.push(m);

// Every round, reveal and cost line arrives from the server one round at a time.
const secret = [];
for (const r of C.ROUNDS) secret.push(r.title, r.request, r.reason, r.adds, r.cost, r.missing);
for (const r of C.ROUNDS) if (r.app) secret.push(r.app.title, r.app.small, r.app.off);
for (const i of C.INFERENCES) for (const l of i.levels) { secret.push(l.text); if (l.lighter) secret.push(l.lighter); }
for (const [name, html] of Object.entries(pages)) {
  for (const s of secret) if (html.includes(s)) refuse(`${name} page contains scenario content: "${s.slice(0, 50)}"`);
  if (/privacy/i.test(html) && name !== 'instructor') refuse(`${name} page uses the word "privacy"`);
  if (/pregnan/i.test(html)) refuse(`${name} page names the round-five inference`);
  if (/\broom\b/i.test(html)) refuse(`${name} page uses the word "room"; say "class" or "session"`);
  if (/fetch\s*\(\s*['"`]\/api\//.test(html)) refuse(`${name} page has an unprefixed /api fetch`);
  if (!html.includes("location.pathname.match(/^\\/sim-?\\d+/)")) refuse(`${name} page is missing the path-prefix detector`);
  for (const [, js] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    try { new vm.Script(js); } catch (e) { refuse(`${name} page script does not parse: ${e.message}`); }
  }
}
for (const m of ['x-access-code', "sessionStorage.setItem('m05-access'", "sessionStorage.removeItem('m05-access'", '/api/config']) {
  if (!pages.launcher.includes(m)) refuse('access gate missing: ' + m);
}
if (/m03-|Midland/.test(pages.launcher + pages.student)) refuse('a page still carries Midland names or storage keys');
for (const m of ['confirmApprove', 'confirmDecline', 'Go back']) {
  if (!pages.student.includes(m)) refuse('student page lost the confirm step: ' + m);
}

if (problems.length) { console.error('REFUSING build:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log(`PASS build: ${Object.keys(pages).length} pages, ${secret.length} scenario strings kept server-side`);
