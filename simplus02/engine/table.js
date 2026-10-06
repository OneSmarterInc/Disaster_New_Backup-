'use strict';
// Term-sheet engine: seats, moves, signatures, group locks, revision log, deadline and fallback draw.
// Pure functions over a plain state object, so it persists to Redis as JSON unchanged.
const C = require('../data/config');

const SEATS = ['utility', 'developer', 'manufacturers', 'advocate'];
const DIALS = Object.keys(C.dials);
const groupOf = d => Object.keys(C.settlementGroups).find(g => C.settlementGroups[g].includes(d));

// Seat plan for a room of n students: tables of four, leftovers double a seat as co-counsel.
function planTables(n) {
  if (n < 4) throw new Error('A table needs at least four students');
  const tables = Math.floor(n / 4);
  const plan = Array.from({ length: tables }, () => Object.fromEntries(SEATS.map(s => [s, 1])));
  for (let i = 0; i < n - tables * 4; i++) plan[i % tables][SEATS[Math.floor(i / tables) % 4]]++;
  return plan;
}

function hashSeed(s) { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
function rng(seed) { let a = hashSeed(seed); return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function createTable(code, seed = code) {
  return {
    code, seed, phase: 'negotiation',
    dials: Object.fromEntries(DIALS.map(d => [d, C.dials[d].filed])),
    signatures: Object.fromEntries(DIALS.map(d => [d, []])),
    locked: Object.fromEntries(Object.keys(C.settlementGroups).map(g => [g, false])),
    log: [], result: null,
  };
}

function fail(msg) { const e = new Error(msg); e.code = 'REJECTED'; throw e; }
function guard(st, seat, dial) {
  if (st.phase !== 'negotiation') fail('The term sheet is closed');
  if (!SEATS.includes(seat)) fail('Unknown seat');
  if (dial !== undefined && !DIALS.includes(dial)) fail('Unknown term');
}
function onGrid(dial, v) {
  const x = C.dials[dial], k = (v - x.min) / x.step;
  return v >= x.min && v <= x.max && Math.abs(k - Math.round(k)) < 1e-9;
}
function relock(st, g) {
  st.locked[g] = C.settlementGroups[g].every(d => SEATS.every(s => st.signatures[d].includes(s)));
}

function move(st, seat, dial, value, t = Date.now()) {
  guard(st, seat, dial);
  if (st.locked[groupOf(dial)]) fail('That group is locked; unlock it first');
  if (!onGrid(dial, value)) fail('Value outside the allowed range or step');
  const old = st.dials[dial];
  if (old === value) return st;
  st.dials[dial] = value;
  st.signatures[dial] = [];
  st.log.push({ t, seat, action: 'move', dial, from: old, to: value });
  return st;
}

function sign(st, seat, dial, t = Date.now()) {
  guard(st, seat, dial);
  if (!st.signatures[dial].includes(seat)) {
    st.signatures[dial].push(seat);
    st.log.push({ t, seat, action: 'sign', dial, value: st.dials[dial] });
    const g = groupOf(dial), was = st.locked[g];
    relock(st, g);
    if (!was && st.locked[g]) st.log.push({ t, seat, action: 'lock', group: g });
  }
  return st;
}

function unsign(st, seat, dial, t = Date.now()) {
  guard(st, seat, dial);
  const g = groupOf(dial);
  if (st.locked[g]) fail('That group is locked; unlock it first');
  st.signatures[dial] = st.signatures[dial].filter(s => s !== seat);
  st.log.push({ t, seat, action: 'unsign', dial });
  return st;
}

// Any seat can unlock a locked group before the deadline; this clears the group's signatures.
function unlock(st, seat, group, t = Date.now()) {
  guard(st, seat);
  if (!st.locked[group]) fail('That group is not locked');
  for (const d of C.settlementGroups[group]) st.signatures[d] = [];
  st.locked[group] = false;
  st.log.push({ t, seat, action: 'unlock', group });
  return st;
}

function drawOn(r, dial, [lo, hi]) {
  const step = C.dials[dial].step, n = Math.round((hi - lo) / step);
  return Math.round((lo + step * Math.floor(r() * (n + 1))) * 100) / 100;
}

// Close the sheet. Open groups are imposed whole from the published ranges; each imposed dial adds freeze.
function closeTable(st, t = Date.now()) {
  if (st.phase !== 'negotiation') return st;
  const r = rng(st.seed), F = C.fallback, [f0, f1] = F.freezeMonthsPerOpenDial;
  const terms = { ...st.dials }, imposed = [];
  let freezeMonths = 0;
  for (const [g, dials] of Object.entries(C.settlementGroups)) {
    if (st.locked[g]) continue;
    for (const d of dials) {
      terms[d] = drawOn(r, d, F[d]);
      imposed.push(d);
      freezeMonths += f0 + Math.floor(r() * (f1 - f0 + 1));
    }
  }
  st.phase = 'closed';
  st.result = {
    terms, imposed, freezeMonths,
    settled: Object.keys(C.settlementGroups).filter(g => st.locked[g]),
  };
  st.log.push({ t, action: 'deadline', imposed, freezeMonths });
  return st;
}

module.exports = { SEATS, DIALS, groupOf, planTables, createTable, move, sign, unsign, unlock, closeTable };
