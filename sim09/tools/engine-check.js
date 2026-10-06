#!/usr/bin/env node
// Engine rules: phases, the wall, the cash rule, fund arithmetic and the display
// rounding agreed for the reveal. Pure functions, no store, no clock.
const assert = require('node:assert/strict');
const C = require('../config/content.js');
const E = require('../lib/engine.js');
let n = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const ok = (c, m) => { assert.ok(c, m); n++; };

// Phases follow the clock in content.js, and history needs a release.
const { briefingSeconds: B, wallSeconds: W, allocateSeconds: A } = C.CLOCK;
eq(E.phaseAt(0).phase, 'briefing', 'play opens on the briefing');
eq(E.phaseAt(B).phase, 'wall', 'the wall opens after the briefing');
eq(E.phaseAt(B + W).phase, 'allocate', 'allocation opens after the wall');
eq(E.phaseAt(B + W + A).phase, 'held', 'history waits for the instructor');
eq(E.phaseAt(B + W + 10, true).phase, 'held', 'allocation can close early');
eq(E.phaseAt(B + W + A, false, 1), { phase: 'reveal', remaining: 0, stage: 1 }, 'a release opens stage 1');
eq(E.phaseAt(B + W + A, false, 9).stage, 3, 'stages cap at three');

// The wall.
const good = { direction: 'Purchasing between businesses moves onto the internet within five years.', pick: 'buyers', reason: 'Suppliers bid prices down, and the buyer keeps the difference every time.' };
ok(E.validateStatements(good).value, 'complete statements pass');
eq(E.validateStatements({ ...good, direction: 'online' }).error, 'direction_too_short', 'a one-word direction is refused');
eq(E.validateStatements({ ...good, pick: '' }).error, 'destination_pick_required', 'destination needs a pick');
eq(E.validateStatements({ ...good, pick: 'the-moon' }).error, 'destination_pick_required', 'unknown picks are refused');
eq(E.validateStatements({ ...good, reason: 'because' }).error, 'reason_too_short', 'destination needs a reason');
eq(E.validateStatements({ ...good, direction: '  lots   of   space  '.repeat(10) }).value.direction.includes('  '), false, 'whitespace is collapsed');

// Allocation and the cash rule.
const T = C.FUND.total, S = C.FUND.step;
const all = (k) => ({ ...Object.fromEntries(E.BUCKETS.map(b => [b, 0])), [k]: T });
ok(E.validateAllocation(all('RA'), good).value, 'everything on one company is allowed');
eq(E.validateAllocation({ ...all('RA'), RA: T - S }, good).error, 'fund_not_fully_placed', 'every dollar must be placed');
eq(E.validateAllocation({ ...all('RA'), RA: T - 1, IC: 1 }, good).error, 'not_a_step', 'amounts move in steps');
eq(E.validateAllocation({ ...all('RA'), RA: -S, IC: T + S }, good).error, 'invalid_amount', 'negative amounts are refused');
eq(E.validateAllocation({ ...all('RA'), gold: 0 }, good).error, 'unknown_holding', 'only the five and cash can be held');
ok(E.validateAllocation(all('cash'), good).value, 'cash is allowed when the pick names someone else');
for (const o of C.WALL.destination.options) {
  const r = E.validateAllocation(all('cash'), { ...good, pick: o.key });
  eq(!!r.value, o.cashAllowed, `cash rule for pick "${o.key}"`);
}
eq(E.validateAllocation(all('cash'), null).error, 'cash_not_allowed', 'no statements means no cash');

// Every stage value is finite and non-negative; cash never moves.
for (const c of C.COMPANIES) for (const y of E.YEARS) {
  const v = c.stages[y].perShare / c.entry.price;
  ok(Number.isFinite(v) && v >= 0 && v < 1, `${c.key} ${y} is a loss and a real number`);
}
for (const y of E.YEARS) eq(E.fundAt(all('cash'), y).total, T, `cash holds its value in ${y}`);

// The agreed displayed values for $1M in one company.
const expected = {
  RA: ['$190K', '$80K', '$80K'], PS: ['$40K', '$20K', '$20K'], IC: ['$10K', 'under $10K', 'under $10K'],
  LS: ['under $10K', 'under $10K', '$0'], MS: ['under $10K', 'under $10K', '$0']
};
for (const [k, want] of Object.entries(expected)) {
  eq(E.YEARS.map(y => E.display(E.fundAt(all(k), y).total)), want, `${k} displays as agreed`);
}
eq(E.display(0), '$0', 'zero is a wipeout');
eq(E.display(1), 'under $10K', 'a dollar is under $10K');
eq(E.display(9999), 'under $10K', 'just under $10K');
eq(E.display(10000), '$10K', '$10K exactly');
eq(E.display(1000000), '$1.00M', 'a full fund shows in millions');

// Contradictions: money placed against your own destination.
const half = { ...all('RA'), RA: T / 2, cash: T / 2 };
eq(E.contradiction({ pick: 'buyers' }, half).share, 0.5, 'buyers pick with half in a marketplace is flagged');
eq(E.contradiction({ pick: 'marketplaces' }, half), null, 'marketplace pick backing a marketplace is consistent');
eq(E.contradiction({ pick: 'software' }, all('RA')).share, 1, 'software pick all in a marketplace is flagged');
eq(E.contradiction({ pick: 'buyers' }, all('cash')), null, 'cash is never a contradiction');
eq(E.contradiction(null, all('RA')), null, 'no statements, nothing to contradict');

// Aggregates.
const units = [
  { id: 'a', label: 'A', statements: good, allocation: all('RA') },
  { id: 'b', label: 'B', statements: { ...good, pick: 'marketplaces' }, allocation: Object.fromEntries(E.BUCKETS.map(k => [k, k === 'cash' ? 0 : T / 5])) },
  { id: 'c', label: 'C', statements: null, allocation: null }
];
const agg = E.aggregate(units, 2);
eq(agg.placed, 2, 'unplaced funds are not counted');
eq(agg.totals.RA, T + T / 5, 'room totals add up');
eq(agg.picks.buyers, 1, 'picks are counted');
eq(agg.concentrated[0].id, 'a', 'the all-in unit is the most concentrated');
eq(agg.spread[0].id, 'b', 'the five-way unit is the most spread');
eq(agg.contradictions.map(c => c.id), ['a'], 'only the contradicting unit is flagged');
eq(agg.stages.map(s => s.year), [2002, 2004], 'only released stages are aggregated');

console.log(`PASS engine-check: ${n} assertions`);
