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
const studentFacing = everything.filter(([p]) => !p.startsWith('DEBRIEF') && !/\.(id|key|requires|level|group)\b|replaces|catalogueRevision/.test(p));

const PLACEHOLDER = /\b(TODO|TBD|FIXME|XXX|lorem|ipsum|placeholder)\b|\?\?\?|\[\s*(insert|add|write)\b/i;
const COURSE_OR_PLACE = /\b(MIS|ISM|3000|4400|7000|semester|quarter system|syllabus|week \d+|monday|tuesday|wednesday|thursday|friday|university|college|wright state|chapter \d+)\b/i;
const BANNED = /\b(moat|delve|leverage|tapestry|synergy|paradigm|cutting-edge|realm|harness|unlock|game changer|garner|next-gen)\b/i;
const RETIRED = ['rapid-03-bench', 'rapid-03-midland', 'rapid-01', 'rapid-02', 'rapidsimplus-01', 'rapid-04-whose-number'];

for (const [p, s] of everything) {
  if (PLACEHOLDER.test(s)) refuse(`placeholder text at ${p}: ${s.slice(0, 60)}`);
  if (BANNED.test(s)) refuse(`banned word at ${p}: ${s.match(BANNED)[0]}`);
  if (s.includes('*')) refuse(`asterisk at ${p}`);
  if (/[“”]/.test(s)) refuse(`curly double quotes at ${p}; use straight quotes`);
}
for (const [p, s] of studentFacing) {
  if (/privacy/i.test(s)) refuse(`"privacy" appears in student-facing copy at ${p}`);
  if (/\broom\b/i.test(s)) refuse(`"room" appears in student-facing copy at ${p}; say "class" or name the screen`);
  if (COURSE_OR_PLACE.test(s)) refuse(`course, day or institution named at ${p}: ${s.match(COURSE_OR_PLACE)[0]}`);
}

// Identity.
if (C.META.id !== 'rapid-05-approve') refuse('sim id changed from rapid-05-approve');
if (RETIRED.some(id => C.META.id === id || (C.META.replaces || []).includes(id))) refuse('sim id reuses or replaces another sim');

// Structure and coherence.
const keys = C.ROUNDS.map(r => r.key);
if (C.ROUNDS.length !== 5) refuse('there must be exactly five rounds');
if (new Set(keys).size !== keys.length) refuse('round keys must be unique');
C.ROUNDS.forEach((r, i) => {
  if (r.n !== i + 1) refuse(`round ${i + 1} is numbered ${r.n}`);
  for (const f of ['title', 'request', 'reason', 'adds', 'cost', 'missing']) if (!r[f]) refuse(`round ${r.n} missing ${f}`);
});
const LEVELS = ['high', 'moderate', 'low'];
for (const inf of C.INFERENCES) {
  if (!inf.levels.length) refuse(`inference ${inf.id} has no levels`);
  let last = 99;
  for (const l of inf.levels) {
    if (!LEVELS.includes(l.level)) refuse(`inference ${inf.id} has unknown level ${l.level}`);
    const rank = 3 - LEVELS.indexOf(l.level);
    if (rank > last) refuse(`inference ${inf.id} levels are not ordered strongest first`);
    last = rank;
    for (const k of l.requires) if (!keys.includes(k)) refuse(`inference ${inf.id} requires unknown key ${k}`);
    if (!l.text) refuse(`inference ${inf.id} ${l.level} has no text`);
  }
}
const health = C.INFERENCES.find(i => i.id === 'health');
if (!health) refuse('the health inference is missing');
else for (const l of health.levels) {
  if (!l.lighter) refuse(`health ${l.level} has no lighter text`);
  else if (/pregnan/i.test(l.lighter)) refuse(`health ${l.level} lighter text names pregnancy`);
}
if (/pregnan/i.test(health && health.lighterLabel || '')) refuse('lighter label names pregnancy');
const infIds = C.INFERENCES.map(i => i.id);
for (const e of C.ENDINGS) {
  if (e.when) for (const id of Object.keys(e.when)) if (!infIds.includes(id)) refuse(`ending ${e.group} refers to unknown inference ${id}`);
  if (e.lighterLabel && /pregnan/i.test(e.lighterLabel)) refuse(`ending ${e.group} lighter label names pregnancy`);
}
if (C.ENDINGS[C.ENDINGS.length - 1].when !== null) refuse('the last ending must be the catch-all');

// Briefing must state the rules that make the sim fair.
const brief = C.BRIEFING.individual.join(' ');
for (const must of ['final', 'three-minute clock', 'the feature ships', C.CUSTOMER.name, 'totals']) {
  if (!brief.includes(must)) refuse(`briefing no longer states: ${must}`);
}
if (!/tie ships/.test(C.BRIEFING.teamExtra)) refuse('team briefing no longer states that a tie ships');

if (problems.length) {
  console.error('REFUSING content:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`PASS content-check: ${everything.length} strings checked, ${studentFacing.length} student-facing`);
