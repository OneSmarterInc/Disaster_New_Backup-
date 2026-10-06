// Historical floor-3 fixtures intentionally preserve the authored narrative/buyer regressions.
const assert = require('assert');
const S = require('../lib/scenario.js');

const valid = (x) => {
  const v = S.validateAllocation(x, S.LEGACY_THRESHOLDS);
  assert.equal(v.ok, true, JSON.stringify(v));
  return v.allocation;
};

const y1Weak = valid({ run: 3, uptime: 2, capacity: 2, connect: 0, features: 2 });
const y1Mid = valid({ run: 3, uptime: 2, capacity: 1, connect: 1, features: 2 });
const y1Strong = valid({ run: 3, uptime: 1, capacity: 1, connect: 2, features: 2 });

assert.equal(S.evaluateYear1(y1Weak).band, 'weak');
assert.equal(S.evaluateYear1(y1Mid).band, 'middle');
assert.equal(S.evaluateYear1(y1Strong).band, 'strong');

assert.equal(S.validateAllocation({ run: 2, uptime: 2, capacity: 2, connect: 2, features: 1 }).ok, false);
assert.equal(S.validateAllocation({ run: 3, uptime: 4, capacity: 0, connect: 1, features: 1 }).ok, false);
assert.equal(S.validateAllocation({ run: 3, uptime: 1, capacity: 1, connect: 1, features: 1 }).ok, false);

const a = valid({ run: 3, uptime: 2, capacity: 1, connect: 2, features: 1 });
const b = valid({ run: 3, uptime: 1, capacity: 1, connect: 2, features: 2 });
const y2 = S.evaluateYear2(a, b);
assert.equal(y2.heat.band, 'strong');
assert.equal(y2.competitor.band, 'strong');

const strong3a = valid({ run: 3, uptime: 0, capacity: 1, connect: 3, features: 2 });
const strong3b = valid({ run: 3, uptime: 0, capacity: 1, connect: 2, features: 3 });
assert.equal(S.evaluateYear3(strong3a, strong3b).band, 'strong');

const pilot3a = valid({ run: 3, uptime: 1, capacity: 1, connect: 2, features: 2 });
const pilot3b = valid({ run: 3, uptime: 1, capacity: 1, connect: 1, features: 3 });
assert.equal(S.evaluateYear3(pilot3a, pilot3b).band, 'pilot');

const weak3a = valid({ run: 3, uptime: 2, capacity: 1, connect: 1, features: 2 });
const weak3b = valid({ run: 3, uptime: 2, capacity: 1, connect: 1, features: 2 });
assert.equal(S.evaluateYear3(weak3a, weak3b).band, 'weak');

const dataNoRoomA = valid({ run: 3, uptime: 3, capacity: 0, connect: 3, features: 0 });
const dataNoRoomB = valid({ run: 3, uptime: 0, capacity: 0, connect: 3, features: 3 });
const dataNoRoom3 = S.evaluateYear3(dataNoRoomA, dataNoRoomB);
assert.equal(dataNoRoom3.band, 'data_no_room');
assert.equal(dataNoRoom3.calibrationGap, undefined);
assert.equal(dataNoRoom3.internalBand, undefined);
assert.ok(dataNoRoom3.narrative.includes('three years of fault history and nowhere to put it'));

const buyerCarrolton = S.evaluateBuyers(dataNoRoomA, dataNoRoomB);
assert.equal(buyerCarrolton.carrolton.interest, 'qualified');
assert.equal(buyerCarrolton.corven.interest, 'high');
assert.equal(buyerCarrolton.ridge_hollow.interest, 'qualified');

const ridgeHighA = valid({ run: 3, uptime: 2, capacity: 1, connect: 2, features: 1 });
const ridgeHighB = valid({ run: 3, uptime: 2, capacity: 1, connect: 2, features: 1 });
assert.equal(S.evaluateBuyers(ridgeHighA, ridgeHighB).ridge_hollow.interest, 'high');

const ridgeLowA = valid({ run: 6, uptime: 0, capacity: 0, connect: 0, features: 3 });
const ridgeLowB = valid({ run: 6, uptime: 0, capacity: 0, connect: 0, features: 3 });
const ridgeLow = S.evaluateBuyers(ridgeLowA, ridgeLowB);
assert.equal(ridgeLow.ridge_hollow.interest, 'low');
assert.equal(ridgeLow.corven.interest, 'low');

const corvenQualifiedA = valid({ run: 3, uptime: 2, capacity: 1, connect: 2, features: 1 });
const corvenQualifiedB = valid({ run: 3, uptime: 2, capacity: 1, connect: 1, features: 2 });
assert.equal(S.evaluateBuyers(corvenQualifiedA, corvenQualifiedB).corven.interest, 'qualified');

// Retuning must keep values between thresholds in the intended middle band.
const raisedYear1 = { ...S.DEFAULT_THRESHOLDS, year1ConnectStrong: 3 };
assert.equal(S.evaluateYear1(y1Strong, raisedYear1).band, 'middle');

const heatA = valid({ run: 3, uptime: 2, capacity: 1, connect: 1, features: 2 });
const heatB = valid({ run: 3, uptime: 1, capacity: 1, connect: 1, features: 3 });
const raisedHeat = { ...S.DEFAULT_THRESHOLDS, heatUptimeStrong: 4, heatUptimeMiddle: 2 };
assert.equal(S.evaluateYear2(heatA, heatB, raisedHeat).heat.band, 'middle');

assert.equal(S.validateThresholds(S.DEFAULT_THRESHOLDS).ok, true);
assert.equal(S.validateThresholds({ ...S.DEFAULT_THRESHOLDS, heatUptimeStrong: 2, heatUptimeMiddle: 2 }).ok, false);
assert.equal(S.validateThresholds({ ...S.DEFAULT_THRESHOLDS, competitorConnectStrong: 5, competitorConnectPilotMax: 3 }).ok, false);
assert.equal(S.validateThresholds({ ...S.DEFAULT_THRESHOLDS, year3ConnectStrong: 6, year3ConnectPilotMax: 4 }).ok, false);

const publicText = JSON.stringify(S.publicConfig());
for (const key of Object.keys(S.DEFAULT_THRESHOLDS)) {
  assert.equal(publicText.includes(key), false, `public config leaked threshold key ${key}`);
}
assert.equal(S.META.id, 'rapid-03-midland');
assert.deepEqual(S.META.replaces, []);
assert.match(S.META.detail.roomIntro, /Four people.*\$9 million budget/);
assert.equal(S.META.detail.cast.length, 4);
assert.deepEqual(S.META.detail.cast.map(x => x.name), ['Dale Brenner','Renata Oyelaran','Tom Vasquez','Sam Achterberg']);
assert.deepEqual(S.META.detail.cast.map(x => x.line), ['Run','Uptime','Features','Connect']);
assert.equal(S.META.detail.cast.some(x => x.line === 'Capacity'), false);
const inc1 = S.publicConfig();
assert.equal(inc1.room.cast.length, 4);
assert.equal(inc1.lines.find(x => x.id === 'capacity').description, 'Headroom for growth and for anything that needs to compute.');
assert.equal(inc1.lines.find(x => x.id === 'connect').description, 'Gets data back from units in the field automatically.');
assert.equal(inc1.lines.find(x => x.id === 'run').advocate.name, 'Dale Brenner');
assert.equal(inc1.lines.find(x => x.id === 'uptime').advocate.name, 'Renata Oyelaran');
assert.equal(inc1.lines.find(x => x.id === 'connect').advocate.name, 'Sam Achterberg');
assert.equal(inc1.lines.find(x => x.id === 'features').advocate.name, 'Tom Vasquez');
assert.equal(inc1.lines.find(x => x.id === 'capacity').advocate, null);
assert.equal(inc1.coldOpen[0].startsWith('Midland sells and services the big rooftop heating and cooling units'), true);
assert.equal(inc1.position.startsWith('You have $9 million'), true);

console.log('RapidSim 03 checks passed.');
