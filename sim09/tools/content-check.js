#!/usr/bin/env node
// Content gate. Refuses to pass if the config would ship something we agreed
// never ships. Each rule matches the exact thing it guards.
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
const isMeta = (p) => /\.(id|key|category|basis|pick)\b|replaces|catalogueRevision|\.sources\[|\.note$/.test(p);
const studentFacing = everything.filter(([p]) => !p.startsWith('DEBRIEF') && !p.startsWith('FLAGS') && !isMeta(p));

const PLACEHOLDER = /\b(TODO|TBD|FIXME|XXX|lorem|ipsum|placeholder)\b|\?\?\?|\[\s*(insert|add|write)\b/i;
const COURSE_OR_PLACE = /\b(MIS|ISM|3000|4400|7000|semester|syllabus|week \d+|monday|tuesday|wednesday|thursday|friday|saturday|sunday|university|college|wright state|chapter \d+)\b/i;
const BANNED = /\b(moat|delve|leverage|tapestry|synergy|paradigm|cutting-edge|realm|harness|unlock|game changer|garner|next-gen|moreover|furthermore|additionally)\b/i;
const RETIRED = ['rapid-03-bench', 'rapid-03-midland', 'rapid-01', 'rapid-02', 'rapidsimplus-01', 'rapid-04-whose-number', 'rapid-05-approve', 'rapid-06-switch', 'rapid-07-bought', 'rapid-08-later'];
const REAL_NAMES = /FreeMarkets|Verticalnet|VerticalNet|Chemdex|Ventro|NexPrise|Commerce One|Ariba|\bSAP\b|Oracle|Covisint|General Motors|\bGM\b|Microsoft|Bravo/;

for (const [p, s] of everything) {
  if (PLACEHOLDER.test(s)) refuse(`placeholder text at ${p}: ${s.slice(0, 60)}`);
  if (BANNED.test(s)) refuse(`banned word at ${p}: ${s.match(BANNED)[0]}`);
  if (s.includes('*')) refuse(`asterisk at ${p}`);
  if (/[“”]/.test(s)) refuse(`curly double quotes at ${p}; use straight quotes`);
}
for (const [p, s] of studentFacing) {
  if (COURSE_OR_PLACE.test(s)) refuse(`course, day or institution named at ${p}: ${s.match(COURSE_OR_PLACE)[0]}`);
}
// Real names live only in REVEAL.names (released with the last stage) and in
// the forecast's source line, which names the research firms, not the companies.
for (const [p, s] of everything) {
  if (p.startsWith('REVEAL.names') || isMeta(p)) continue;
  if (REAL_NAMES.test(s)) refuse(`a real company name appears before the reveal at ${p}: ${s.match(REAL_NAMES)[0]}`);
}

// Identity.
if (C.META.id !== 'rapid-09-money-land') refuse('sim id changed from rapid-09-money-land');
if (RETIRED.some(id => C.META.id === id || (C.META.replaces || []).includes(id))) refuse('sim id reuses or replaces another sim');
if (/3000|MIS/.test(C.META.title)) refuse('the title carries a course number');

// The five companies and their numbers.
const keys = C.COMPANIES.map(c => c.key);
if (C.COMPANIES.length !== 5) refuse('there must be exactly five companies');
if (new Set(keys).size !== 5) refuse('company keys must be unique');
const years = C.REVEAL.stages.map(s => s.year);
if (JSON.stringify(years) !== '[2002,2004,2010]') refuse('the reveal must run 2002, 2004, 2010');
const cats = new Set(C.WALL.destination.options.map(o => o.key));
for (const c of C.COMPANIES) {
  for (const f of ['descriptor', 'does', 'model', 'position', 'funding']) if (!c[f]) refuse(`${c.key} is missing ${f}`);
  if (!c.numbers || c.numbers.length < 2) refuse(`${c.key} needs at least two figures`);
  if (!cats.has(c.category)) refuse(`${c.key} category ${c.category} is not a destination option`);
  if (!(c.entry && c.entry.price > 0 && c.entry.note)) refuse(`${c.key} entry price needs a price and a source note`);
  if (!c.sources || !c.sources.length) refuse(`${c.key} has no sources`);
  for (const y of years) {
    const st = c.stages && c.stages[y];
    if (!st || typeof st.perShare !== 'number' || st.perShare < 0 || !st.note) refuse(`${c.key} ${y} needs a value and a source note`);
    else if (st.perShare >= c.entry.price) refuse(`${c.key} ${y} is not a loss; the reveal was agreed as one where nobody does well`);
    if (st && !['filing', 'record', 'estimate'].includes(st.basis)) refuse(`${c.key} ${y} basis must be filing, record or estimate`);
  }
  for (const y of years) if (!C.REVEAL.stages.find(s => s.year === y).companies[c.key]) refuse(`${c.key} has no event in ${y}`);
  if (!C.REVEAL.names[c.key]) refuse(`${c.key} has no name for the reveal`);
}

// The wall and the cash rule.
const opts = C.WALL.destination.options;
if (!opts.some(o => o.cashAllowed) || !opts.some(o => !o.cashAllowed)) refuse('the cash rule needs picks on both sides');
for (const o of opts) if (keys.some(k => C.COMPANIES.find(c => c.key === k).category === o.key) && o.cashAllowed) refuse(`pick ${o.key} names one of the five but allows cash`);
if (!(C.WALL.direction.minChars >= 20 && C.WALL.destination.minChars >= 20)) refuse('statements must require real sentences');
if (C.FUND.total % C.FUND.step !== 0) refuse('the fund must divide into whole steps');

// The briefing must state the rules that make the sim fair.
const brief = C.BRIEFING.individual.join(' ');
for (const must of ['direction', 'destination', 'final', 'lock', '$50,000', 'Holding cash is allowed only', 'totals']) {
  if (!brief.includes(must)) refuse(`briefing no longer states: ${must}`);
}
if (!/one screen/.test(C.BRIEFING.teamExtra)) refuse('team briefing no longer says the team works on one screen');

// The debrief spine: disagreement first, naming second, the turn last.
for (const f of ['facilitatorNote', 'disagreement', 'naming', 'turn', 'cashPrompt', 'epilogue', 'sawItComing']) if (!C.DEBRIEF[f]) refuse(`debrief missing ${f}`);
if (!/built to produce/.test(C.DEBRIEF.facilitatorNote.join(' '))) refuse('facilitator note no longer says the loss is the designed outcome');

if (problems.length) {
  console.error('REFUSING content:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`PASS content-check: ${everything.length} strings checked, ${studentFacing.length} student-facing`);
