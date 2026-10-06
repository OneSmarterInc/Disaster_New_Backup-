'use strict';
// Runs the real handlers end to end against an in-memory store honouring the same compare-and-set contract.
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { store } = require('../lib/store');
const C = require('../data/config');
const { seatBriefs } = require('../data/content');

process.env.LAUNCH_SECRET = 'test-secret-not-real';
process.env.FACULTY_CODES = 'Tester:fac-code';
process.env.ACCESS_CODE = 'room-code';
delete process.env.PLATFORM_URL;

let clock = 1_800_000_000_000; Date.now = () => clock; const advance = m => { clock += m * 60000; };
const db = new Map();
Object.assign(store, {
  configured: () => true,
  get: async k => db.has(k) ? JSON.parse(db.get(k)) : null,
  getMany: async ks => ks.map(k => db.has(k) ? JSON.parse(db.get(k)) : null),
  cas: async (k, prev, next) => {
    const cur = db.has(k) ? db.get(k) : '';
    if (cur !== (prev == null ? '' : JSON.stringify(prev))) return false;
    db.set(k, JSON.stringify(next)); return true;
  },
});
const session = require('../api/session');
const finish = require('../api/finish');

async function call(h, b, headers = {}) {
  const res = { statusCode: 200, payload: null, setHeader() {}, status(n) { this.statusCode = n; return this; }, json(v) { this.payload = v; return this; } };
  await h({ method: 'POST', headers, body: b }, res);
  return { status: res.statusCode, body: res.payload };
}
const fac = b => call(session, b, { 'x-faculty-code': 'fac-code' });
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

(async () => {
  // Auth
  ok((await call(session, { action: 'create' })).status === 401, 'create needs faculty');
  const { body: { code } } = await fac({ action: 'create' });
  ok(/^[A-Z2-9]{5}$/.test(code), 'code shape');
  ok((await call(session, { action: 'join', code, name: 'X' })).status === 401, 'join needs access code');

  // 30 students join
  const people = [];
  for (let i = 0; i < 30; i++) {
    const r = await call(session, { action: 'join', code, name: `Student ${i + 1}` }, { 'x-access-code': 'room-code' });
    people.push({ ...r.body, h: { 'x-participant-key': r.body.participantKey } });
  }
  ok(people.every(p => p.participantId), 'all joined');
  const v0 = await call(session, { action: 'view', code, participantId: people[0].participantId }, people[0].h);
  ok(v0.body.seated === false, 'unseated before seating');
  ok((await call(session, { action: 'view', code, participantId: people[0].participantId }, { 'x-participant-key': 'wrong' })).status === 403, 'wrong key rejected');

  // Seat and advance
  ok((await fac({ action: 'phase', code, to: 'briefing' })).status === 400, 'cannot brief before seating');
  ok((await fac({ action: 'seat', code })).body.tables === 7, '7 tables');
  ok((await call(session, { action: 'join', code, name: 'Late' }, { 'x-access-code': 'room-code' })).status === 409, 'late join blocked');
  for (const p of people) for (let step = 1; step <= 4; step++) {
    ok((await call(session, { action: 'walkthrough', code, participantId: p.participantId, step }, p.h)).status === 200, 'walkthrough screen acknowledged');
  }
  for (const to of ['briefing', 'openings']) ok((await fac({ action: 'phase', code, to })).status === 200, to);

  const views = await Promise.all(people.map(p => call(session, { action: 'view', code, participantId: p.participantId }, p.h)));
  ok(views.every(v => v.body.seated), 'everyone seated');
  // Leak check: each view carries its own floor and no other seat's
  for (const v of views) for (const [seat, b] of Object.entries(seatBriefs)) {
    const has = JSON.stringify(v.body).includes(b.floor);
    ok(seat === v.body.seat ? has : !has, `floor leak check ${v.body.seat}/${seat}`);
  }
  ok(views.every(v => v.body.editable === false), 'read-only during openings');
  const mover = people[views.findIndex(v => v.body.seat === 'developer')];
  ok((await call(session, { action: 'move', code, participantId: mover.participantId, dial: 'top', value: 70 }, mover.h)).status === 409, 'no moves in openings');

  // Negotiate
  await fac({ action: 'phase', code, to: 'negotiation' });
  const at = (table, seat) => people[views.findIndex(v => v.body.table === table && v.body.seat === seat)];
  const act = (p, b) => call(session, { code, participantId: p.participantId, ...b }, p.h);

  // T1 settles everything inside the zone
  const T1 = { top: 75, term: 14, exit: 0, coll: 0, threshold: 50 };
  const zoneCheck = require('../engine/model').floors(T1);
  ok(Object.values(zoneCheck).every(Boolean), 'T1 package clears all four floors');
  for (const [d, v] of Object.entries(T1)) await act(at('T1', 'utility'), { action: 'move', dial: d, value: v });
  for (const seat of ['utility', 'developer', 'manufacturers', 'advocate']) for (const d of Object.keys(T1)) await act(at('T1', seat), { action: 'sign', dial: d });
  const t1 = (await act(at('T1', 'advocate'), { action: 'view' })).body;
  ok(t1.sheet.locked.money && t1.sheet.locked.threshold, 'T1 fully locked');

  // T2 settles threshold only
  await act(at('T2', 'manufacturers'), { action: 'move', dial: 'threshold', value: 60 });
  for (const seat of ['utility', 'developer', 'manufacturers', 'advocate']) await act(at('T2', seat), { action: 'sign', dial: 'threshold' });
  ok((await act(at('T2', 'developer'), { action: 'move', dial: 'top', value: 72 })).status === 400, 'off-step move rejected');

  // Concurrency: all four T3 seats move at once; every write lands
  await Promise.all([['utility', 'top', 90], ['developer', 'term', 8], ['manufacturers', 'threshold', 55], ['advocate', 'coll', 30]]
    .map(([s, d, v]) => act(at('T3', s), { action: 'move', dial: d, value: v })));
  const t3 = (await act(at('T3', 'utility'), { action: 'view' })).body;
  ok(t3.sheet.dials.top === 90 && t3.sheet.dials.term === 8 && t3.sheet.dials.threshold === 55 && t3.sheet.dials.coll === 30, 'concurrent moves all land');
  ok(t3.log.filter(e => e.action === 'move').length === 4, 'four moves logged');

  // Notice, stall flag, extension
  await fac({ action: 'notice', code, tableId: 'T4', noticeId: 'closest' });
  advance(11);
  const con = (await fac({ action: 'console', code })).body;
  ok(con.tables.find(t => t.id === 'T4').stalled, 'T4 flagged stalled');
  ok(!JSON.stringify(con).includes(seatBriefs.advocate.floor), 'console carries no floor');
  const t4v = (await act(at('T4', 'advocate'), { action: 'view' })).body;
  ok(t4v.notices.length === 1 && /closest/.test(t4v.notices[0].text + t4v.notices[0].id), 'notice reaches the table');
  ok((await fac({ action: 'extend', code })).status === 200, 'extend once');
  ok((await fac({ action: 'extend', code })).status === 400, 'extend twice rejected');

  // Deadline passes: first request closes everything
  advance(60);
  const late = await act(at('T1', 'developer'), { action: 'move', dial: 'top', value: 60 });
  ok(late.status === 409, 'moves after deadline rejected');
  const after = (await fac({ action: 'console', code })).body;
  ok(after.phase === 'closed' && after.results.length === 7, 'all tables closed');
  const r1 = after.results.find(r => r.id === 'T1'), r2 = after.results.find(r => r.id === 'T2');
  ok(r1.imposed.length === 0 && r1.freezeMonths === 0, 'T1 nothing imposed');
  ok(r2.settled.includes('threshold') && r2.terms.threshold === 60 && r2.imposed.length === 4, 'T2 threshold stands, money imposed');
  ok(after.results.filter(r => r.settled.length === 0).every(r => r.imposed.length === 5), 'unsettled tables fully imposed');

  // Student outcome
  const out = (await act(at('T2', 'advocate'), { action: 'view' })).body.outcome;
  ok(out && out.arrives && out.misses, 'outcome both scenarios');
  ok(!/score|rank/i.test(JSON.stringify(out)), 'no score or rank in outcome');

  // Finish: non-platform run reports nothing; platform run reports once
  ok((await call(finish, { code, participantId: people[0].participantId }, people[0].h)).body.reported === false, 'standalone not reported');
  const tokenFor = sub => { const p = { sub, name: 'L', role: 'student', sim: C.id, iat: Date.now(), exp: Date.now() + 3600e3 };
    const b = Buffer.from(JSON.stringify(p)).toString('base64url'); return b + '.' + createHmac('sha256', process.env.LAUNCH_SECRET).update(b).digest('base64url'); };
  const p0 = people[0];
  const denied = await call(finish, { code, participantId: p0.participantId }, { ...p0.h, 'x-launch-token': tokenFor('u1') });
  ok(denied.status === 403, 'a platform account cannot claim a standalone participant completion');

  // Debrief and reveal
  ok((await fac({ action: 'phase', code, to: 'debrief' })).status === 200, 'debrief');
  ok((await fac({ action: 'reveal', code, on: true })).status === 200 && (await fac({ action: 'console', code })).body.reveal, 'reveal on');

  console.log(`All API tests pass (${n} assertions).`);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
