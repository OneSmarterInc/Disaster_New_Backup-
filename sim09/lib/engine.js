// RapidSim 09 engine. Pure functions only: phases, validation, fund values and
// room aggregates. No storage, no clock of its own, so every rule is testable.
const C = require('../config/content.js');

const KEYS = C.COMPANIES.map(c => c.key);
const BUCKETS = [...KEYS, 'cash'];
const YEARS = C.REVEAL.stages.map(s => s.year);
const COMPANY = Object.fromEntries(C.COMPANIES.map(c => [c.key, c]));
const OPTION = Object.fromEntries(C.WALL.destination.options.map(o => [o.key, o]));
const MAX_TEXT = 1200;

const B = C.CLOCK.briefingSeconds, W = C.CLOCK.wallSeconds, A = C.CLOCK.allocateSeconds;
const WALL_OPENS = B, ALLOCATION_OPENS = B + W, ALLOCATION_CLOSES = B + W + A;

// Phase from elapsed play seconds. Allocation can be closed early (by the
// instructor, or by a solo player committing); history needs a release.
function phaseAt(elapsed, allocationClosed = false, released = 0) {
  if (elapsed < WALL_OPENS) return { phase: 'briefing', remaining: WALL_OPENS - elapsed };
  if (elapsed < ALLOCATION_OPENS) return { phase: 'wall', remaining: ALLOCATION_OPENS - elapsed };
  if (!allocationClosed && elapsed < ALLOCATION_CLOSES) return { phase: 'allocate', remaining: ALLOCATION_CLOSES - elapsed };
  if (!released) return { phase: 'held', remaining: 0, stage: 0 };
  return { phase: 'reveal', remaining: 0, stage: Math.min(released, YEARS.length) };
}

function cleanText(v) { return String(v ?? '').replace(/\s+/g, ' ').trim(); }

function validateStatements(input) {
  const i = input && typeof input === 'object' ? input : {};
  const direction = cleanText(i.direction);
  const pick = String(i.pick || '');
  const reason = cleanText(i.reason);
  if (direction.length < C.WALL.direction.minChars) return { error: 'direction_too_short' };
  if (!OPTION[pick]) return { error: 'destination_pick_required' };
  if (reason.length < C.WALL.destination.minChars) return { error: 'reason_too_short' };
  if (direction.length > MAX_TEXT || reason.length > MAX_TEXT) return { error: 'statement_too_long' };
  return { value: { direction, pick, reason } };
}

function cashAllowed(statements) {
  return !!(statements && OPTION[statements.pick] && OPTION[statements.pick].cashAllowed);
}

function validateAllocation(input, statements) {
  const i = input && typeof input === 'object' ? input : {};
  for (const k of Object.keys(i)) if (!BUCKETS.includes(k)) return { error: 'unknown_holding' };
  const out = {};
  let sum = 0;
  for (const k of BUCKETS) {
    const v = i[k] === undefined ? 0 : Number(i[k]);
    if (!Number.isInteger(v) || v < 0) return { error: 'invalid_amount' };
    if (v % C.FUND.step !== 0) return { error: 'not_a_step' };
    out[k] = v; sum += v;
  }
  if (sum !== C.FUND.total) return { error: 'fund_not_fully_placed', left: C.FUND.total - sum };
  if (out.cash > 0 && !cashAllowed(statements)) return { error: 'cash_not_allowed' };
  return { value: out };
}

// What a June 2000 position is worth at a stage year.
function fundAt(allocation, year) {
  const parts = {};
  let total = 0;
  for (const k of KEYS) {
    const c = COMPANY[k];
    const v = (allocation[k] || 0) * c.stages[year].perShare / c.entry.price;
    parts[k] = v; total += v;
  }
  parts.cash = allocation.cash || 0;
  total += parts.cash;
  return { parts, total };
}

// 0 is a wipeout. Anything above 0 and under $10K is "under $10K". Otherwise
// round to the nearest $10K, or show millions to two places.
function display(v) {
  if (!(v > 0)) return '$0';
  if (v < 10000) return C.STUDENT_COPY.underTen;
  if (v >= 995000) return '$' + (Math.round(v / 10000) / 100).toFixed(2) + 'M';
  return '$' + Math.round(v / 10000) * 10 + 'K';
}

function money(v) { return '$' + Number(v).toLocaleString('en-US'); }

function shares(allocation) {
  return Object.fromEntries(BUCKETS.map(k => [k, (allocation[k] || 0) / C.FUND.total]));
}
function maxShare(allocation) { return Math.max(...Object.values(shares(allocation))); }
function holdings(allocation) { return BUCKETS.filter(k => allocation[k] > 0).length; }

// Money placed against the unit's own destination pick. Picking a category of
// the five bets on that category; picking anyone else bets against all five.
function contradiction(statements, allocation) {
  if (!statements || !allocation) return null;
  const pick = statements.pick;
  let against = 0;
  for (const k of KEYS) if (COMPANY[k].category !== pick) against += allocation[k] || 0;
  const share = against / C.FUND.total;
  return share >= C.FLAGS.contradictionShare ? { share, pick } : null;
}

function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// units: [{ id, label, statements, allocation }]
function aggregate(units, released) {
  const placed = units.filter(u => u.allocation);
  const totals = Object.fromEntries(BUCKETS.map(k => [k, 0]));
  for (const u of placed) for (const k of BUCKETS) totals[k] += u.allocation[k];
  const picks = Object.fromEntries(C.WALL.destination.options.map(o => [o.key, 0]));
  for (const u of units) if (u.statements) picks[u.statements.pick]++;
  const ranked = placed.map(u => ({ id: u.id, label: u.label, max: maxShare(u.allocation), holdings: holdings(u.allocation) }));
  const concentrated = ranked.filter(r => r.max >= C.FLAGS.concentratedShare).sort((a, b) => b.max - a.max || a.label.localeCompare(b.label));
  const spread = ranked.slice().sort((a, b) => a.max - b.max || b.holdings - a.holdings || a.label.localeCompare(b.label));
  const contradictions = placed.map(u => ({ id: u.id, label: u.label, c: contradiction(u.statements, u.allocation) }))
    .filter(x => x.c).map(x => ({ id: x.id, label: x.label, share: x.c.share, pick: x.c.pick }));
  const stages = YEARS.slice(0, released).map(year => {
    const vals = placed.map(u => fundAt(u.allocation, year).total);
    return {
      year,
      low: vals.length ? display(Math.min(...vals)) : null,
      median: vals.length ? display(median(vals)) : null,
      high: vals.length ? display(Math.max(...vals)) : null,
      room: display(vals.reduce((a, b) => a + b, 0)),
      invested: money(placed.length * C.FUND.total)
    };
  });
  return { placed: placed.length, totals, picks, concentrated, spread, contradictions, stages };
}

module.exports = {
  KEYS, BUCKETS, YEARS, COMPANY, OPTION,
  WALL_OPENS, ALLOCATION_OPENS, ALLOCATION_CLOSES,
  phaseAt, validateStatements, validateAllocation, cashAllowed,
  fundAt, display, money, shares, maxShare, contradiction, aggregate
};
