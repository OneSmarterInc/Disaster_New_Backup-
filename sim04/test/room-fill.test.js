'use strict';
// Group formation: email join, Unassigned, faculty divide and moves, no minimum,
// empty groups dropped at start, late joiners, examples on a small projector.
const assert = require('node:assert/strict');
const room = require('../lib/room');
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('ok ' + name); };
const make = (mode, groupSize) => room.createSession({ code: 'ABCDE', owner: 'F', mode, groupSize, now: 0 });
const joinMany = (s, n, from = 0) => { for (let i = from; i < from + n; i++) s = room.join(s, 'p' + i, `p${i}@school.edu`, 0); return s; };
const seeded = (seed = 7) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

check('joiners wait in Unassigned; nobody is placed automatically', () => {
  const s = joinMany(make('team', 4), 5);
  assert.equal(s.slots.length, 0);
  assert.ok(Object.values(s.participants).every(p => p.slotId === null));
  assert.equal(room.studentView(s, 'p0', 0).group, null);
});
check('23 people in groups of 4 divide as 4,4,4,4,4,3', () => {
  const s = room.divide(joinMany(make('team', 4), 23), 4, seeded());
  assert.deepEqual(s.slots.map(x => x.memberIds.length), [4, 4, 4, 4, 4, 3]);
});
check('group size 1 is allowed', () => {
  const s = room.divide(joinMany(make('team', 1), 3), 1, seeded());
  assert.deepEqual(s.slots.map(x => x.memberIds.length), [1, 1, 1]);
});
check('dividing is random: two seeds give different groups', () => {
  const a = room.divide(joinMany(make('team', 2), 6), 2, seeded(3));
  const b = room.divide(joinMany(make('team', 2), 6), 2, seeded(11));
  assert.notDeepEqual(a.slots.map(x => x.memberIds), b.slots.map(x => x.memberIds));
});
check('faculty can move people, make a new group, or send someone back to Unassigned', () => {
  let s = room.divide(joinMany(make('team', 2), 4), 2, seeded());
  const who = s.slots[0].memberIds[0];
  s = room.move(s, who, 'new');
  assert.equal(s.slots.length, 3);
  s = room.move(s, who, 'unassigned');
  assert.equal(room.slotFor(s, who), undefined);
  assert.equal(s.slots.length, 2, 'emptied group disappears in the lobby');
});
check('one group is enough to start', () => {
  let s = joinMany(make('team', 4), 1);
  s = room.start(room.move(s, 'p0', 'new'), 1);
  assert.deepEqual(s.slots.map(x => x.sheetId), ['A']);
});
check('start refused with nobody in a group', () => {
  assert.throws(() => room.start(joinMany(make('team', 4), 3), 1), /at least one person/);
});
check('no sheet before the clock, and none for an unassigned person after it', () => {
  let s = joinMany(make('team', 1), 3);
  s = room.move(s, 'p0', 'new');
  assert.equal(room.studentView(s, 'p0', 0).data, null);
  s = room.start(s, 1);
  assert.equal(room.studentView(s, 'p0', 2).data.sheet.lines.length, 5);
  assert.equal(room.studentView(s, 'p1', 2).data, null);
});
check('late joiner can be placed after start, but nobody can be moved out of a group', () => {
  let s = room.start(room.move(joinMany(make('team', 2), 1), 'p0', 'new'), 1);
  s = joinMany(s, 1, 1);
  s = room.move(s, 'p1', s.slots[0].id);
  assert.equal(room.slotFor(s, 'p1').sheetId, 'A');
  assert.throws(() => room.move(s, 'p0', 'unassigned'), /only place someone/);
  assert.throws(() => room.move(s, 'p0', 'new'), /only place someone/);
});
check('groupmates see each other by short name', () => {
  let s = joinMany(make('team', 2), 2);
  s = room.move(room.move(s, 'p0', 'new'), 'p1', 'slot-1');
  assert.deepEqual(room.studentView(s, 'p0', 0).groupmates, ['p1']);
});
check('one group: projector fills the other four definitions as labelled examples', () => {
  let s = room.start(room.move(joinMany(make('team', 1), 1), 'p0', 'new'), 1);
  s = room.commit(s, 'p0', 90, 5, 2);
  s = room.advance(room.advance(s, 3), 3);
  const p = room.projector(s, 3);
  assert.deepEqual(p.numbers.map(n => [n.example, n.number]),
    [[false, '90.0'], [true, '69.6'], [true, '75.0'], [true, '80.0'], [true, '85.0']]);
  assert.equal(p.reveal.length, 5);
  assert.equal(p.reveal.filter(r => r.example).length, 4);
});
check('five or more groups: no examples', () => {
  let s = room.start(room.divide(joinMany(make('team', 1), 5), 1, seeded()), 1);
  s = room.advance(s, 1 + s.clockMinutes * 60000);
  assert.equal(room.projector(s, 1 + s.clockMinutes * 60000).numbers.filter(n => n.example).length, 0);
});
check('email names only on the projector; full emails on the private check', () => {
  const s = room.divide(joinMany(make('team', 2), 2), 2, seeded());
  assert.ok(!JSON.stringify(room.projector(s, 0)).includes('@'));
  assert.ok(JSON.stringify(room.privateCheck(s)).includes('p0@school.edu'));
});
console.log(`${passed} group-formation checks passed, 0 failed`);
