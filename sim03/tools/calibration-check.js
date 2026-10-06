#!/usr/bin/env node
// Properties of the real outcome engine, plus compatibility at API boundaries.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../lib/scenario');
const K = require('../lib/calibration');
let checks = 0;
const eq = (a, b, message) => { assert.deepEqual(a, b, message); checks++; };
const ok = (value, message) => { assert.ok(value, message); checks++; };
const t = K.DEFAULT_THRESHOLDS;
eq([t.budgetPerYear, t.runFloor, t.perLineCap], [9, 4, 3], 'provisional pilot defaults');
const analysis = K.analyzeCalibration(t);
ok(analysis.slack <= 0, 'a full run cannot cover every top band with slack');
ok(analysis.winningRuns > 0 && analysis.winningRuns <= K.MAX_WINNING_RUNS, 'all top outcomes remain possible but rare');
for (const [event, bands] of Object.entries(analysis.counts)) {
  eq(Object.values(bands).reduce((a, b) => a + b, 0), analysis.totalRuns, `${event} tiles all legal runs`);
  for (const [band, n] of Object.entries(bands)) ok(n > 0, `${event}/${band} is reachable`);
}
for (const a of K.legalAllocations(t)) ok(S.validateAllocation(a, t).ok, 'the sweep includes only legal allocations');
eq(K.validateThresholds(t).ok, true);
for (const invalid of [{ runFloor: 3 }, { runFloor: 5 }, { perLineCap: 2 },
  { year1ConnectStrong: 1 }, { heatUptimeMiddle: 0 }, { year3CapacityStrong: 0 },
  { competitorConnectPilotMax: 2 }, { year3ConnectPilotMax: 2 }, { heatUptimeStrong: 0 },
  { budgetPerYear: 31 }, { runFloor: -1 }, { perLineCap: 7 }]) {
  eq(K.validateThresholds({ ...t, ...invalid }).ok, false, JSON.stringify(invalid));
}
for (const key of Object.keys(t)) for (const value of [null, '', ' ', 'abc', true, [], {}, 1.5, Infinity])
  eq(K.validateThresholds({ ...t, [key]: value }).ok, false, `${key} must reject ${JSON.stringify(value)}`);
for (const invalid of ['bad', [], 7]) eq(K.validateThresholds(invalid).ok, false);
const loose = K.analyzeCalibration({ ...t, runFloor: 3 });
ok(loose.slack > 0 && loose.winningRuns > K.MAX_WINNING_RUNS, 'the pre-pilot regression is caught');
eq(K.analyzeCalibration({ ...t, runFloor: 5 }).winningRuns, 0, 'an impossible perfect run is caught');
eq(K.analyzeCalibration({ ...t, perLineCap: 2 }).counts.year3.strong, 0, 'an unreachable Year 3 top band is caught');
const custom = { ...t, budgetPerYear: 10, runFloor: 5 };
eq(K.validateThresholds(custom).ok, true, 'budget can change without changing the authored trade-off');
const a = { run: 5, uptime: 2, capacity: 1, connect: 2, features: 0 };
eq(S.validateAllocation(a, custom).ok, true);
eq(S.publicConfig(custom).annualBudget, 10);
eq(S.publicConfig(custom).runMinimum, 5);
ok(S.publicConfig(custom).position.includes('$10 million'), 'public rules use the effective session budget');
for (const key of K.OUTCOME_KEYS) ok(!JSON.stringify(S.publicConfig()).includes(key), `${key} stays server-side`);
const old = { run: 3, uptime: 2, capacity: 1, connect: 2, features: 1 };
eq(S.validateAllocation(old).error, 'run_minimum_4');
eq(S.validateAllocation(old, K.sessionThresholds({ thresholds: {} })).ok, true, 'pre-pilot sessions retain floor 3');
const saved = { thresholds: { year1ConnectStrong: 3 } }, before = structuredClone(saved);
eq(K.sessionThresholds(saved).year1ConnectStrong, 3); eq(saved, before, 'normalization never rewrites historical sessions');
eq(K.standaloneThresholds().runFloor, 3, 'already-open pre-pilot pages retain the old contract');
eq(K.standaloneThresholds(K.CALIBRATION_ID).runFloor, 4);
assert.throws(() => K.standaloneThresholds('unknown'), e => e.status === 409 && e.code === 'calibration_changed'); checks++;
const mutable = K.analyzeCalibration(); mutable.counts.year3.strong = 0;
ok(K.analyzeCalibration().counts.year3.strong > 0, 'callers cannot mutate cached reachability');
const client = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
for (const marker of ['C.annualBudget', 'C.runMinimum', 'C.lineMaximum', 'S.session.allocationRules', 'calibrationId:C?.calibrationId']) ok(client.includes(marker), marker);
console.log(`Calibration properties passed (${checks} assertions). ${analysis.winningRuns}/${analysis.totalRuns} legal runs reach all top event outcomes; all authored bands are reachable.`);
