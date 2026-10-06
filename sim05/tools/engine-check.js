#!/usr/bin/env node
// Exhaustive engine check: all 3^5 = 243 approve/decline/timeout paths in both
// intensities, plus the specific behaviours agreed in design.
const assert = require('node:assert/strict');
const E = require('../lib/engine.js');
const C = require('../config/content.js');

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };

const A = 'approve', D = 'decline', T = 'timeout';
const levelOf = (pic, id) => (pic.find(p => p.id === id) || {}).level || null;

// Every path, both intensities.
const all = [];
(function walk(prefix) {
  if (prefix.length === 5) { all.push(prefix); return; }
  for (const d of [A, D, T]) walk([...prefix, d]);
})([]);
eq(all.length, 243, 'path count');

for (const intensity of ['standard', 'lighter']) {
  for (const path of all) {
    const e = E.ending(path, intensity);
    ok(e.decisions.length === 5, 'five decisions on the ending');
    ok(e.group >= 1 && e.group <= 6, 'ending group in range');
    eq(e.missing.length, path.filter(x => x === D).length, 'one missing line per decline');
    for (let r = 1; r <= 5; r++) {
      const res = E.roundResult(path, r, intensity);
      if (res.decision === D) {
        ok(res.cost, 'decline shows its cost line');
        eq(res.changed, [], 'a decline never changes the picture');
      } else {
        ok(res.cost === null, 'approval and timeout show no cost line');
      }
    }
    if (intensity === 'lighter') {
      const words = JSON.stringify([e.knows, ...[1, 2, 3, 4, 5].map(r => E.roundResult(path, r, 'lighter'))]);
      ok(!/pregnan/i.test(words), 'lighter setting never names pregnancy');
    }
  }
}

// Monotonic: approving more can never make Loopwell know less.
for (const p of all) {
  for (let i = 0; i < 5; i++) {
    if (p[i] !== D) continue;
    const more = p.slice(); more[i] = A;
    const lo = E.ending(p).knows, hi = E.ending(more).knows;
    for (const inf of C.INFERENCES) {
      const a = E.LEVEL_RANK[levelOf(lo, inf.id)] || 0, b = E.LEVEL_RANK[levelOf(hi, inf.id)] || 0;
      ok(b >= a, `approving round ${i + 1} cannot lower ${inf.id}`);
    }
  }
}

// Agreed behaviours from design.
eq(E.ending([A, A, A, A, A]).group, 1, 'all approved reaches high-confidence estimate');
eq(levelOf(E.ending([A, A, A, A, D]).knows, 'health'), 'moderate', 'declining round 5 alone only lowers the estimate');
eq(levelOf(E.ending([A, A, A, D, D]).knows, 'health'), null, 'declining rounds 4 and 5 blocks it');
eq(levelOf(E.ending([A, A, D, D, D]).knows, 'places'), 'high', 'declining sleep after GPS still leaves home and work');
eq(levelOf(E.ending([D, D, A, D, D]).knows, 'places'), 'moderate', 'sleep alone estimates home only');
eq(levelOf(E.ending([A, A, D, D, D]).knows, 'second'), null, 'without sleep there is no second address');
eq(E.ending([A, A, D, D, D]).group, 4, 'GPS and activity alone end at home and workplace');
eq(levelOf(E.ending([D, D, D, A, D]).knows, 'health'), 'low', 'grocery alone gives a low estimate');
eq(E.ending([D, D, D, D, D]).group, 6, 'declining everything');
eq(E.ending([D, D, D, D, D]).knows, [], 'declining everything leaves nothing known');
eq(E.ending([D, D, D, D, A]).group, 6, 'heart rate alone reveals nothing');
eq(E.ending([T, T, T, T, T]).group, 1, 'timeouts ship: all-timeout equals all-approve');
eq(E.ending([A, D, D, D, D]).group, 5, 'routine only');
eq(E.ending([D, A, D, D, D]).group, 4, 'home and workplace only');
eq(E.ending([A, A, A, D, D]).group, 3, 'second address, no estimate');

// Round 5 on the main path updates an existing line rather than adding one.
eq(E.roundResult([A, A, A, A, A], 5).added, [], 'round 5 updates the health line');
eq(E.roundResult([A, A, A, A, A], 5).changed, ['health'], 'round 5 changes the health line');
eq(E.roundResult([A, A, A, A, A], 2).added, ['places'], 'round 2 adds home and workplace only');
eq(E.roundResult([A, A, A, A, A], 3).added, ['second'], 'round 3 reveals the second address fresh');
// Main path: every approved round reveals something new.
for (let r = 1; r <= 5; r++) {
  ok(E.roundResult([A, A, A, A, A], r).changed.length > 0, `main path round ${r} reveals something new`);
}

// Team votes.
const team = ['p1', 'p2', 'p3', 'p4'];
eq(E.teamDecision(team, { p1: A, p2: A, p3: D, p4: D }).decision, 'approve', 'a tie ships');
eq(E.teamDecision(team, { p1: D, p2: D, p3: D, p4: A }).decision, 'decline', 'majority decline');
eq(E.teamDecision(team, { p1: D, p2: D }).decision, 'timeout', 'two declines and two silent ships, as a timeout');
eq(E.teamDecision(team, { p1: A, p2: D }).decision, 'approve', 'one approval plus silence ships as an approval');
eq(E.teamDecision(team, {}).decision, 'timeout', 'nobody voting is a timeout');
eq(E.teamDecision(['p1', 'p2', 'p3'], { p1: D, p2: D, p3: A }).decision, 'decline', 'odd team majority decline');
ok(E.teamDecision(team, { p1: A, p2: D }).split, 'split is flagged');
ok(!E.teamDecision(team, { p1: A, p2: A }).split, 'unanimous is not split');

// Clock: one-minute recap, five rounds of 3 + 1 minutes, three-minute ending.
eq(E.totalSeconds(), 1440, 'twenty-four minutes of play');
eq(E.phaseAt(0).phase, 'briefing', 'starts with the recap');
eq(E.phaseAt(60), { phase: 'decide', round: 1, remaining: 180 }, 'round 1 opens at one minute');
eq(E.phaseAt(240), { phase: 'reveal', round: 1, remaining: 60 }, 'round 1 reveal');
eq(E.phaseAt(60 + 4 * 240), { phase: 'decide', round: 5, remaining: 180 }, 'round 5 opens');
eq(E.phaseAt(1260).phase, 'ending', 'ending after round 5');
eq(E.phaseAt(1440).phase, 'closed', 'closed at the end');

// Aggregates.
const agg = E.aggregate([
  { decisions: [A, A, A, A, A] },
  { decisions: [A, A, A, A, D] },
  { decisions: [A, A, A, D, D] },
  { decisions: [A, D, T, A, A] },
  { decisions: [A, A] } // unfinished run counts in rounds, not endings
]);
eq(agg.complete, 4, 'only complete runs reach endings');
eq(agg.rounds[0], { round: 1, title: C.ROUNDS[0].title, approve: 5, decline: 0, timeout: 0, splitTeams: 0 }, 'round 1 counts');
eq(agg.rounds[2].timeout, 1, 'timeouts counted separately');
eq(agg.reached, 3, 'three reached an estimate');
eq(agg.reachedAndDeclined, 2, 'two of them declined something');
eq(agg.headline, "3 of 4 students ended with Loopwell estimating a change in Dana's health. Of those, 2 declined at least one request.", 'headline text');
eq(E.aggregate([{ decisions: [A, A, A, A, A] }], 'standard', { mode: 'team' }).headline, "1 of 1 team ended with Loopwell estimating a change in Dana's health. None of them declined a request.", 'one team, none declined');
eq(E.aggregate([{ decisions: [D, D, D, D, D] }, { decisions: [A, D, D, D, D] }]).headline, "None of the 2 students ended with Loopwell estimating a change in Dana's health.", 'nobody reached it');
ok(!/^\d/.test(E.aggregate([{ decisions: [D, D, D, D, D] }]).headline.split('. ')[1] || ''), 'second sentence never starts with a numeral');
// Team mode: disagreement inside teams is found even when every team agrees with every other.
const tAgg = E.aggregate([{ decisions: [A, A, A, A, A], splits: [false, false, false, true, true] }], 'standard', { mode: 'team' });
eq(tAgg.disagreement, 'Round 4 split 1 team internally. Ask its members where they disagreed.', 'team split prompt');
eq(E.aggregate([{ decisions: [A, A, A, A, A] }]).disagreement, 'No round divided the class. Ask who hesitated longest, and at which round.', 'no disagreement fallback');
ok(agg.mostDivided === 4 || agg.mostDivided === 5, 'most divided round found');
ok(/^Round \d split \d–\d\. Find one of each\.$/.test(agg.disagreement), 'disagreement prompt filled');
ok(!E.aggregate([], 'standard').headline, 'no headline for an empty room');
eq(E.aggregate([{ decisions: [D, D, D, A, D] }]).reached, 0, 'a low estimate does not count toward the headline');
eq(E.aggregate([{ decisions: [A, D, D, D, A] }]).reached, 1, 'a moderate estimate counts toward the headline');
ok(!/pregnan/i.test(E.aggregate([{ decisions: [A, A, A, A, A] }], 'lighter').headline), 'lighter headline never names pregnancy');
// Only the high-confidence line names pregnancy, in either setting.
for (const p of all) for (const k of E.ending(p).knows) if (k.id === 'health' && k.level !== 'high') ok(!/pregnan/i.test(k.text + k.label), 'lower levels never name pregnancy');

console.log(`PASS engine-check: ${n} assertions across ${all.length} paths × 2 intensities`);
