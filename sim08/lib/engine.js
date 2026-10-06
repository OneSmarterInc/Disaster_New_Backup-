// RapidSim 08 engine. Pure: no clock, no storage, no I/O.
// Everything here is a function of config plus the facts of one run.
const C = require('../config/content.js');

const VENDOR_KEYS = C.VENDORS.map(v => v.key);
const PLAN_KEYS = C.PLANS.map(p => p.key);
const QUESTION_IDS = C.QUESTIONS.map(q => q.id);
const TIERS = ['adopted', 'lucky', 'knew', 'shadow'];

const PHASES = [
  ['briefing', 'briefingSeconds'],
  ['demos', 'demoSeconds'],
  ['questions', 'questionSeconds'],
  ['commit', 'commitSeconds'],
  ['plan', 'planSeconds']
];

// Where the shared clock is after `elapsed` seconds. The report phase never ends.
function phaseAt(elapsed) {
  let t = 0;
  for (const [phase, key] of PHASES) {
    const len = C.CLOCK[key];
    if (elapsed < t + len) return { phase, remaining: t + len - elapsed };
    t += len;
  }
  return { phase: 'report', remaining: 0 };
}
const ORDER = ['lobby', ...PHASES.map(p => p[0]), 'report'];
const reached = (phase, target) => ORDER.indexOf(phase) >= ORDER.indexOf(target);
function phaseStart(phase) {
  let t = 0;
  for (const [p, key] of PHASES) { if (p === phase) return t; t += C.CLOCK[key]; }
  return t;
}

// Found = one direct route, or two partial routes, among the questions spent.
function routesFor(vendor, questionIds) {
  const out = { direct: [], partial: [] };
  for (const id of questionIds) {
    const q = C.QUESTIONS.find(x => x.id === id);
    const r = q && q.routes[vendor];
    if (r === 'direct') out.direct.push(id);
    else if (r === 'partial') out.partial.push(id);
  }
  return out;
}
function found(vendor, questionIds) {
  const r = routesFor(vendor, questionIds);
  return r.direct.length >= 1 || r.partial.length >= 2;
}
function planMatches(vendor, plan) {
  const p = C.PLANS.find(x => x.key === plan);
  return !!p && p.matches.includes(vendor);
}
function tier(vendor, questionIds, plan) {
  const f = found(vendor, questionIds), m = planMatches(vendor, plan);
  return f && m ? 'adopted' : m ? 'lucky' : f ? 'knew' : 'shadow';
}

const price = key => C.VENDORS.find(v => v.key === key).threeYear;
const cheapest = keys => keys.slice().sort((a, b) => price(a) - price(b))[0];

// Majority of the votes cast. A tie or no votes: the board chooses on price
// among the tied vendors (or among all three when nobody voted).
function decideVendor(votes) {
  const counts = {};
  for (const v of votes) if (VENDOR_KEYS.includes(v)) counts[v] = (counts[v] || 0) + 1;
  const keys = Object.keys(counts);
  if (!keys.length) return { vendor: cheapest(VENDOR_KEYS), boardChose: true, counts };
  const top = Math.max(...keys.map(k => counts[k]));
  const leaders = keys.filter(k => counts[k] === top);
  if (leaders.length === 1) return { vendor: leaders[0], boardChose: false, counts };
  return { vendor: cheapest(leaders), boardChose: true, counts };
}

// Majority of the votes cast. A tie or no votes: nothing is funded.
function decidePlan(votes) {
  const counts = {};
  for (const v of votes) if (PLAN_KEYS.includes(v)) counts[v] = (counts[v] || 0) + 1;
  const keys = Object.keys(counts);
  if (!keys.length) return { plan: null, counts };
  const top = Math.max(...keys.map(k => counts[k]));
  const leaders = keys.filter(k => counts[k] === top);
  return { plan: leaders.length === 1 ? leaders[0] : null, counts };
}

// The eighteen-month report for one run. No score, no tier label.
function report({ vendor, boardChose, questionIds, plan }) {
  const t = tier(vendor, questionIds, plan);
  const parts = [];
  if (boardChose) parts.push(C.REPORT_NOTES.boardChose);
  if (!plan) parts.push(C.REPORT_NOTES.noPlan);
  parts.push(C.REPORTS[vendor][t].text);
  if (plan === 'parallel' && t !== 'adopted') parts.push(C.REPORT_NOTES.parallel);
  return { tier: t, text: parts.join(' '), headline: C.REPORTS[vendor][t].headline };
}

// Answers for the questions spent, in the order spent, all three vendors each.
function answers(questionIds) {
  return questionIds.map(id => {
    const q = C.QUESTIONS.find(x => x.id === id);
    return { id, text: q.text, answers: VENDOR_KEYS.map(k => ({ vendor: k, text: q.answers[k] })) };
  });
}

// Pick a disagreement pair: two runs with the same vendor and different tiers.
function disagreement(rows) {
  const rank = { adopted: 0, lucky: 1, knew: 1, shadow: 2 };
  let best = null;
  for (const v of VENDOR_KEYS) {
    const mine = rows.filter(r => r.vendor === v);
    for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) {
      const a = mine[i], b = mine[j];
      if (a.tier === b.tier) continue;
      const gap = Math.abs(rank[a.tier] - rank[b.tier]);
      if (!best || gap > best.gap) best = { gap, vendor: v, a: a.label, b: b.label };
    }
  }
  return best;
}

module.exports = {
  VENDOR_KEYS, PLAN_KEYS, QUESTION_IDS, TIERS, PHASES, ORDER,
  phaseAt, phaseStart, reached, routesFor, found, planMatches, tier,
  decideVendor, decidePlan, report, answers, disagreement, cheapest
};
