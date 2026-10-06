#!/usr/bin/env node
// The rewrites must catch the simulation paths and nothing else. A rule that
// matched more broadly would swallow the platform's own pages, and the failure
// would look like the whole site going down.
const fs = require('fs');
const path = require('path');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
const pages = fs.readdirSync(path.join(__dirname, '..', 'public'));

// what a Vercel source pattern matches
const toRe = (src) => new RegExp('^' + src
  .replace(/\/:path\*/g, '(?:/.*)?')
  .replace(/:[a-z]+\*/g, '.*')
  .replace(/:[a-z]+/g, '[^/]+') + '$');

// the clean routes are rewritten on purpose
const CLEAN = new Set(['/admin', '/faculty', '/student', '/signin', '/account', '/join']);

const mustPass = [
  '/', '/signin.html', '/admin.html', '/faculty.html', '/student.html',
  '/join.html', '/accept.html', '/reset.html', '/account.html', '/app.css',
  '/api/auth', '/api/admin', '/api/faculty', '/api/student', '/api/launch',
  '/api/complete', '/api/register', '/api/health'
].concat(pages.map(p => '/' + p));

const mustRoute = {
  '/sim01': 1, '/sim01/': 1, '/sim01/api/scene': 1, '/sim01/faculty.html': 1,
  '/sim02': 1, '/sim02/api/chat': 1,
  // 03 has no chat endpoint and no faculty console — it is played alone, so
  // /api/run is the whole surface.
  '/sim03': 1, '/sim03/': 1, '/sim03/api/run': 1, '/sim03/api/health': 1
};

let bad = 0;
const rules = cfg.rewrites.map(r => ({ re: toRe(r.source), to: r.destination }));

for (const p of [...new Set(mustPass)]) {
  if (CLEAN.has(p)) continue;
  const hit = rules.find(r => r.re.test(p));
  if (hit && !hit.to.startsWith('/')) { bad++; console.log(`  ${p} would be sent away to ${hit.to}`); }
}
for (const p of CLEAN) {
  if (!rules.some(r => r.re.test(p))) { bad++; console.log(`  ${p} has no clean route`); }
}
for (const p of Object.keys(mustRoute)) {
  if (!rules.some(r => r.re.test(p))) { bad++; console.log(`  ${p} is not routed to a simulation`); }
}

if (bad) { console.error(`\n${bad} routing problem${bad === 1 ? '' : 's'}.`); process.exit(1); }
console.log(`routing check: ${Object.keys(mustRoute).length} simulation paths routed, ${new Set(mustPass).size} platform paths untouched`);
