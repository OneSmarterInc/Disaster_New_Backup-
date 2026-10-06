#!/usr/bin/env node
// Content gate. Refuses to pass if the config would ship something we agreed
// never ships. Each rule below matches the exact string it checks, so the guard
// cannot drift from the thing it guards.
const C = require('../config/content.js');

const problems = [];
const refuse = (m) => problems.push(m);

function strings(value, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

const everything = strings(C);
// Student-facing copy: everything except the instructor debrief and ids.
const studentFacing = everything.filter(([p]) => !p.startsWith('DEBRIEF') && !/\.(id|key|group|routes)\b|routes\.|replaces|catalogueRevision/.test(p));

const PLACEHOLDER = /\b(TODO|TBD|FIXME|XXX|lorem|ipsum|placeholder)\b|\?\?\?|\[\s*(insert|add|write)\b/i;
const COURSE_OR_PLACE = /\b(MIS|ISM|3000|4400|7000|semester|quarter system|syllabus|week \d+|monday|tuesday|wednesday|thursday|friday|university|college|wright state|chapter \d+)\b/i;
const BANNED = /\b(moat|delve|leverage|tapestry|synergy|paradigm|cutting-edge|realm|harness|unlock|game changer|garner|next-gen)\b/i;
const RETIRED = ['rapid-03-bench', 'rapid-03-midland', 'rapid-01', 'rapid-02', 'rapidsimplus-01', 'rapid-04-whose-number', 'rapid-05-approve', 'rapid-06-switch', 'rapid-07-bought'];

for (const [p, s] of everything) {
  if (PLACEHOLDER.test(s)) refuse(`placeholder text at ${p}: ${s.slice(0, 60)}`);
  if (BANNED.test(s)) refuse(`banned word at ${p}: ${s.match(BANNED)[0]}`);
  if (s.includes('*')) refuse(`asterisk at ${p}`);
  if (/[“”]/.test(s)) refuse(`curly double quotes at ${p}; use straight quotes`);
}
for (const [p, s] of studentFacing) {
  if (/privacy/i.test(s)) refuse(`"privacy" appears in student-facing copy at ${p}`);
  if (COURSE_OR_PLACE.test(s)) refuse(`course, day or institution named at ${p}: ${s.match(COURSE_OR_PLACE)[0]}`);
}

// Identity.
if (C.META.id !== 'rapid-08-later') refuse('sim id changed from rapid-08-later');
if (RETIRED.some(id => C.META.id === id || (C.META.replaces || []).includes(id))) refuse('sim id reuses or replaces another sim');

// Names must not collide with other sims in the catalogue.
for (const [p, s] of everything) {
  if (/\b(Harlow|Dana|Loopwell|Tom)\b/.test(s)) refuse(`name used by another sim at ${p}: ${s.match(/\b(Harlow|Dana|Loopwell|Tom)\b/)[0]}`);
}

// Structure.
const vendors = C.VENDORS.map(v => v.key);
if (vendors.length !== 3) refuse('there must be exactly three vendors');
for (const v of C.VENDORS) {
  for (const f of ['name', 'rep', 'pitch', 'implementation', 'demo']) if (!v[f]) refuse(`vendor ${v.key} missing ${f}`);
  if (v.fee + v.monthly * 36 !== v.threeYear) refuse(`vendor ${v.key} three-year quote does not add up`);
  if (v.threeYear > C.BUDGET_CEILING) refuse(`vendor ${v.key} is over the ceiling`);
}
const ids = C.QUESTIONS.map(q => q.id);
if (new Set(ids).size !== ids.length) refuse('question ids must be unique');
if (C.QUESTIONS.length !== 16) refuse('the menu must have sixteen questions');
if (C.QUESTION_BUDGET !== 6) refuse('the budget must be six questions');
for (const q of C.QUESTIONS) {
  for (const v of vendors) if (!q.answers[v]) refuse(`${q.id} has no answer from ${v}`);
  for (const [v, r] of Object.entries(q.routes)) {
    if (!vendors.includes(v)) refuse(`${q.id} routes to unknown vendor ${v}`);
    if (!['direct', 'partial'].includes(r)) refuse(`${q.id} has unknown route ${r}`);
  }
}
// Every hidden risk is findable two ways, and no single question is the only key.
for (const v of vendors) {
  const direct = C.QUESTIONS.filter(q => q.routes[v] === 'direct').length;
  const partial = C.QUESTIONS.filter(q => q.routes[v] === 'partial').length;
  if (direct < 2) refuse(`${v} risk needs at least two direct routes (has ${direct})`);
  if (partial < 2) refuse(`${v} risk needs at least two partial routes (has ${partial})`);
}
// Diligence answers must not carry a direct route: that would reward the glamorous question.
for (const q of C.QUESTIONS.filter(q => q.group === 'diligence')) {
  if (Object.values(q.routes).includes('direct')) refuse(`${q.id} is a diligence question with a direct route`);
}
// Plans: each vendor has exactly one matching plan, and one decoy matches nothing.
for (const v of vendors) {
  const n = C.PLANS.filter(p => p.matches.includes(v)).length;
  if (n !== 1) refuse(`${v} must match exactly one plan (has ${n})`);
}
if (!C.PLANS.some(p => !p.matches.length)) refuse('the decoy plan that matches nothing is missing');
for (const v of vendors) {
  for (const t of ['adopted', 'lucky', 'knew', 'shadow']) {
    const r = C.REPORTS[v] && C.REPORTS[v][t];
    if (!r || !r.text || !r.headline) refuse(`report ${v}.${t} missing`);
    else if (!r.text.startsWith('Eighteen months on')) refuse(`report ${v}.${t} must open on the jump`);
  }
}
const cover = C.PLANS.find(p => p.matches.includes('kestrel'));
if (C.VENDORS.find(v => v.key === 'kestrel').threeYear + cover.cost > C.BUDGET_CEILING) refuse('Kestrel plus its plan must fit the ceiling');

// Briefing must state the rules that make the sim fair.
const brief = C.BRIEFING.paragraphs.join(' ');
for (const must of ['six questions', 'all three', "won't wait", 'go-live plan', 'Nothing is scored', '$240,000']) {
  if (!brief.includes(must)) refuse(`briefing no longer states: ${must}`);
}
if (!/majority/.test(C.BRIEFING.teamExtra) || !/on price/.test(C.BRIEFING.teamExtra)) refuse('team briefing must state majority and the price fallback');
if (!/on price/.test(C.BRIEFING.individualExtra)) refuse('individual briefing must state the price fallback');

if (problems.length) {
  console.error('REFUSING content:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`PASS content-check: ${everything.length} strings checked, ${studentFacing.length} student-facing`);
