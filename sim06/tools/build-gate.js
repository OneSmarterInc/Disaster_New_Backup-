'use strict';
// Build gate for Sim-06. Exit 1 on any failure. Every rule is exercised by a planted
// violation in test/gate.test.js, so a rule that stops matching real content fails the tests.

const PLACEHOLDER = /\b(TODO|TBD|XXX|FIXME|PLACEHOLDER|lorem ipsum)\b|\[their text\]/i;
const BANNED = /\b(moat|delve[sd]?|leverage|realm|harness|unlock|tapestry|synergy|paradigm|cutting-edge|game changer|garner|next-gen)\b/i;
const INSTITUTIONAL_WORDS = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|semester|university|college|chapter|syllabus)\b/i;
const COURSE_CODE = /\b[A-Z]{2,4}\s?\d{4}\b/; // case-sensitive: "MIS 3000", not "to 2026"
const INSTITUTIONAL = { test: s => INSTITUTIONAL_WORDS.test(s) || COURSE_CODE.test(s), match: s => s.match(INSTITUTIONAL_WORDS) || s.match(COURSE_CODE) };

function strings(obj, path = '', out = []) {
  if (typeof obj === 'string') out.push([path, obj]);
  else if (Array.isArray(obj)) obj.forEach((v, i) => strings(v, `${path}[${i}]`, out));
  else if (obj && typeof obj === 'object') Object.entries(obj).forEach(([k, v]) => strings(v, path ? `${path}.${k}` : k, out));
  return out;
}

function checkConfig(cfg) {
  const errors = [];
  const err = m => errors.push(m);

  // Identity
  if (cfg.retiredIds.includes(cfg.sim.id)) err(`sim id ${cfg.sim.id} is retired and cannot be reused`);
  const m = /^rapid-(\d{2})-[a-z0-9-]+$/.exec(cfg.sim.id);
  if (!m) err(`sim id ${cfg.sim.id} does not match rapid-NN-name`);
  else if (Number(m[1]) !== cfg.sim.number) err(`sim id number ${m[1]} does not match sim.number ${cfg.sim.number}`);

  // Modes: both, no default
  const modes = [...cfg.modes].sort().join(',');
  if (modes !== 'individual,team') err(`modes must be exactly individual and team, got ${modes}`);

  // Reports: numbered from 1, strictly increasing, inside the clock
  const r = cfg.reports;
  if (!r.length) err('no reports');
  r.forEach((rep, i) => {
    if (rep.n !== i + 1) err(`report at position ${i} has n=${rep.n}, expected ${i + 1}`);
    if (i === 0 && rep.atSeconds !== 0) err('first report must arrive at 0 seconds');
    if (i > 0 && rep.atSeconds <= r[i - 1].atSeconds) err(`report ${rep.n} does not arrive after report ${r[i - 1].n}`);
    if (rep.atSeconds >= cfg.clock.playSeconds) err(`report ${rep.n} arrives after the clock ends`);
    if (!rep.source || !rep.text) err(`report ${rep.n} is missing source or text`);
  });

  // Text hygiene across every string in the config
  strings(cfg).forEach(([path, s]) => {
    if (PLACEHOLDER.test(s)) err(`placeholder text at ${path}`);
    if (BANNED.test(s)) err(`banned word at ${path}: ${s.match(BANNED)[0]}`);
    if (INSTITUTIONAL.test(s)) err(`course, term, weekday or institution reference at ${path}: ${INSTITUTIONAL.match(s)[0]}`);
  });

  // Lesson integrity: findable in every document, never given away in the briefing
  const dep = cfg.hiddenDependency;
  if (!dep) err('hiddenDependency is not set');
  else {
    cfg.documents.forEach(doc => {
      const hit = doc.blocks.some(b => b.revealHighlight && b.text.includes(dep));
      if (!hit) err(`document ${doc.id} has no highlighted line naming ${dep}`);
    });
    cfg.briefing.forEach((para, i) => {
      if (para.includes(dep)) err(`briefing paragraph ${i + 1} names ${dep}, which gives the answer away`);
    });
  }

  // Every sim prepares the student before play, and the debrief keeps disagreement first.
  if (!Array.isArray(cfg.walkthrough) || cfg.walkthrough.length < 2) err('walkthrough needs at least two screens');
  (cfg.walkthrough || []).forEach((w, i) => {
    if (w.title && w.title.length > 45) err(`walkthrough screen ${i + 1} title is over 45 characters`);
    (w.text || []).forEach(line => { if (line.split(/\s+/).length > 30) err(`walkthrough screen ${i + 1} has a sentence block over 30 words`); });
    if (dep && JSON.stringify(w).includes(dep)) err(`walkthrough screen ${i + 1} names ${dep}`);
  });
  if (!Array.isArray(cfg.debrief) || cfg.debrief[0]?.step !== 'Disagreement') err('debrief must open with Disagreement');

  // Reveal templates carry every field the engine fills
  ['switch', 'stay'].forEach(k => {
    ['{n}', '{time}', '{reason}'].forEach(tok => {
      if (!cfg.reveal.decisionLines[k].includes(tok)) err(`reveal line for ${k} is missing ${tok}`);
    });
  });

  return errors;
}

// Deployment guard: a bare `deploymentEnabled: false` silently stops git deploys.
function checkVercel(v) {
  const errors = [];
  const d = v && v.git && v.git.deploymentEnabled;
  if (d === false) errors.push('vercel.json sets git.deploymentEnabled to false, which blocks every git deployment');
  else if (d && typeof d === 'object' && d.main !== true) errors.push('vercel.json does not enable deployments from main');
  return errors;
}

module.exports = { checkConfig, checkVercel };

if (require.main === module) {
  const errors = [...checkConfig(require('../data/config')), ...checkVercel(require('../vercel.json'))];
  if (errors.length) {
    console.error(`Build gate FAILED (${errors.length}):`);
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log('Build gate passed.');
}
