'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { store, keys } = require('../lib/store');
const L = require('../lib/launch');
const C = require('../data/config');
const meta = require('../lib/meta');
process.env.LAUNCH_SECRET = 'integration-secret';
process.env.HEALTH_SECRET = 'diagnostics-secret';
process.env.FACULTY_CODES = 'Host:faculty-code,Other instructor:other-faculty-code';
process.env.ACCESS_CODE = 'guest-code';
process.env.PLATFORM_URL = 'https://platform.test';
process.env.SIM_URL = 'https://platform.test/simplus02';
let now = 1800000000000;
Date.now = () => now;
const db = new Map();
Object.assign(store, {
  configured: () => true,
  get: async k => db.has(k) ? JSON.parse(db.get(k)) : null,
  getMany: async ks => ks.map(k => db.has(k) ? JSON.parse(db.get(k)) : null),
  cas: async (k, prev, next) => {
    if ((db.get(k) || '') !== (prev == null ? '' : JSON.stringify(prev))) return false;
    db.set(k, JSON.stringify(next)); return true;
  },
});
const session = require('../api/session'), finish = require('../api/finish'), health = require('../api/health');
function token(p) {
  const raw = Buffer.from(JSON.stringify({ sim: C.id, role: 'student', sub: 'student', course: 'c1', iat: now, exp: now + 3600000, ...p })).toString('base64url');
  return raw + '.' + crypto.createHmac('sha256', process.env.LAUNCH_SECRET).update(raw).digest('base64url');
}
const auth = p => ({ 'x-launch-token': token(p) });
async function call(handler, body = {}, headers = {}, method = 'POST') {
  const res = { code: 200, payload: null, headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(v) { this.payload = v; return this; } };
  await handler({ method, headers, body }, res);
  return { status: res.code, body: res.payload, headers: res.headers };
}
let assertions = 0;
function eq(a,b,message) { assert.deepEqual(a,b,message); assertions++; }
const callbacks = [];
let registrationOk = false, completionOk = false, releaseCallback, callbackStarted;
global.fetch = async (url, options) => {
  assert.ok(url.startsWith(process.env.PLATFORM_URL + '/api/'));
  const payload = L.verifyLaunch(JSON.parse(options.body).token);
  assert.ok(payload, 'all callbacks are signed');
  callbacks.push({ url, payload });
  if (url.endsWith('/register')) return { ok: registrationOk, status: registrationOk ? 200 : 503, text: async () => 'fixture unavailable' };
  if (callbackStarted) { const started = callbackStarted; callbackStarted = null; started(); await new Promise(resolve => { releaseCallback = resolve; }); }
  return { ok: completionOk, status: completionOk ? 200 : 503, text: async () => 'fixture unavailable' };
};

(async () => {
  eq((await call(health, {}, {}, 'GET')).body, { ok: true, sim: C.id }, 'public liveness exposes no diagnostics');
  eq(callbacks.length, 0, 'health never registers or calls the platform');
  const diagnostic = await call(health, {}, { 'x-health-key': process.env.HEALTH_SECRET }, 'GET');
  eq(diagnostic.body.diagnostic, true);
  eq(diagnostic.body.registersAs, process.env.SIM_URL);
  eq(diagnostic.body.features.includes('self-register'), true);
  assert.ok(!JSON.stringify(diagnostic.body).includes(process.env.LAUNCH_SECRET));

  await Promise.all([L.announce(), L.announce()]);
  eq(callbacks.length, 1, 'concurrent announcements share one request');
  registrationOk = true;
  await L.announce(); await L.announce();
  eq(callbacks.length, 2, 'a failed registration retries, success is cached');
  eq([callbacks[1].payload.sim, callbacks[1].payload.number, callbacks[1].payload.title, callbacks[1].payload.minutes], [C.id, 102, meta.title, 65]);
  eq(callbacks[1].payload.detail, meta.detail);

  const owner = auth({ sub: 'teacher', role: 'faculty' });
  for (const invalid of [{ sim: 'rapid-05-approve', role: 'faculty' }, { role: 'admin' }, { sub: null, role: 'faculty' }, { role: 'faculty', exp: now - 1 }]) {
    eq((await call(session, { action: 'create' }, auth(invalid))).status, 401, 'wrong sim, role, account or expiry cannot create a room');
  }
  const made = await call(session, { action: 'create' }, owner);
  eq(made.status, 200);
  const code = made.body.code;
  eq((await store.get(keys.session(code))).courseId, 'c1');
  eq((await call(session, { action: 'entry' }, auth({ sub: 'student0' }))).body, { code }, 'course account finds its open room');
  eq((await call(session, { action: 'entry' }, auth({ course: 'c2' }))).body, { code: null });
  const before = await store.get(keys.session(code));
  for (const action of ['console', 'seat', 'phase', 'extend', 'notice', 'close', 'reveal']) {
    eq((await call(session, { action, code, to: 'briefing', on: true, skipWalkthrough: true }, auth({ sub: 'other-teacher', role: 'faculty' }))).status, 403, action + ' belongs to the creating instructor');
  }
  eq((await call(session, { action: 'console', code }, auth({ sub: 'teacher', role: 'faculty', course: 'c2' }))).status, 403);
  eq(await store.get(keys.session(code)), before, 'unauthorised faculty requests do not mutate the room');
  eq((await call(session, { action: 'join', code }, { 'x-access-code': 'guest-code' })).status, 403, 'guest code cannot enter a course room');
  eq((await call(session, { action: 'join', code }, auth({ course: 'c2' }))).status, 403, 'other course cannot join');
  const people = [];
  for (let i = 0; i < 4; i++) {
    const headers = auth({ sub: 'student' + i });
    const joined = await call(session, { action: 'join', code }, headers);
    eq(joined.status, 200);
    people.push({ ...joined.body, headers: { ...headers, 'x-participant-key': joined.body.participantKey } });
  }
  const me = people[0], input = { code, participantId: me.participantId };
  const rejoined = await call(session, { action: 'join', code }, auth({ sub: 'student0' }));
  eq(rejoined.body.participantId, me.participantId);
  eq(rejoined.body.participantKey, me.participantKey);
  eq(Object.keys(await store.get(keys.roster(code))).length, 4, 'account rejoin does not duplicate students');
  eq((await call(session, { action: 'seat', code }, owner)).body.tables, 1);
  eq((await call(session, { action: 'join', code }, auth({ sub: 'student0' }))).status, 200, 'existing owner can rejoin after seating');
  eq((await call(session, { action: 'join', code }, auth({ sub: 'late' }))).status, 409);
  for (const headers of [{ 'x-participant-key': me.participantKey }, { ...auth({ sub: 'intruder' }), 'x-participant-key': me.participantKey },
    { ...auth({ sub: 'student0', course: 'c2' }), 'x-participant-key': me.participantKey }]) {
    eq((await call(session, { action: 'view', ...input }, headers)).status, 403, 'a leaked key cannot replace account and course identity');
    eq((await call(session, { action: 'walkthrough', ...input, step: 1 }, headers)).status, 403, 'walkthrough acknowledgements require the participant identity');
    eq((await call(finish, input, headers)).body.reported || false, false);
  }
  eq((await call(session, { action: 'phase', code, to: 'briefing' }, owner)).status, 409, 'briefing waits for the untimed walkthrough');
  eq((await store.get(keys.session(code))).phaseEndsAt, null, 'waiting for readers does not start a clock');
  eq((await call(session, { action: 'walkthrough', ...input, step: 4 }, me.headers)).status, 400, 'cannot skip to the last screen');
  for (let step = 1; step <= 2; step++) eq((await call(session, { action: 'walkthrough', ...input, step }, me.headers)).status, 200);
  await call(session, { action: 'join', code }, auth({ sub: 'student0' }));
  eq((await call(session, { action: 'view', ...input }, me.headers)).body.walkthrough.step, 2, 'fresh account rejoin retains walkthrough progress');
  eq((await call(session, { action: 'walkthrough', ...input, step: 1 }, me.headers)).body.walkthrough.step, 2, 'retrying an earlier screen never rolls back progress');
  for (const person of people) {
    for (let step = person === me ? 3 : 1; step <= 4; step++) eq((await call(session, { action: 'walkthrough', code, participantId: person.participantId, step }, person.headers)).status, 200);
  }
  eq((await call(session, { action: 'console', code }, owner)).body.walkthrough, { finished: 4, pending: [] }, 'faculty sees actual joined participants ready');
  for (const to of ['briefing', 'openings', 'negotiation']) eq((await call(session, { action: 'phase', code, to }, owner)).status, 200);
  eq((await call(session, { action: 'walkthrough', ...input, step: 4 }, me.headers)).status, 409, 'timed play does not reopen the walkthrough');
  eq((await call(finish, input, me.headers)).status, 409, 'cannot report before the outcome');
  now += 45 * 60000;
  const started = new Promise(resolve => { callbackStarted = resolve; });
  const first = call(finish, input, me.headers);
  await started;
  const concurrent = await call(finish, input, me.headers);
  eq(concurrent.body.pending, true, 'concurrent completion shares the outstanding report');
  releaseCallback();
  eq((await first).body.reported, false, 'failed callback is not marked complete');
  eq((await store.get(keys.session(code))).phase, 'closed', 'finish can settle an expired negotiation before any poll');
  completionOk = true;
  eq((await call(finish, input, me.headers)).body.reported, true, 'failed callback retries');
  eq((await call(finish, input, me.headers)).body.already, true, 'successful callback is reported once');
  const reports = callbacks.filter(c => c.url.endsWith('/complete'));
  eq(reports.length, 2, 'one failed and one successful completion callback');
  eq([reports[1].payload.sub, reports[1].payload.course, reports[1].payload.sim], ['student0', 'c1', C.id]);
  eq(reports[1].payload.summary.seat, (await store.get(keys.roster(code)))[me.participantId].seat);

  // Two standalone instructors exercise every console action in both directions.
  const instructors = [{ 'x-faculty-code': 'faculty-code' }, { 'x-faculty-code': 'other-faculty-code' }];
  const rooms = [];
  for (const headers of instructors) {
    const room = await call(session, { action: 'create' }, headers);
    eq(room.status, 200); rooms.push(room.body.code);
    for (let i = 0; i < 4; i++) {
      const p = (await call(session, { action: 'join', code: room.body.code, name: 'Guest ' + i }, { 'x-access-code': 'guest-code' })).body;
      for (let step = 1; step <= 4; step++) eq((await call(session, { action: 'walkthrough', code: room.body.code, ...p, step }, { 'x-participant-key': p.participantKey })).status, 200);
    }
  }
  async function denyCrossAccess() {
    const snapshot = [...db.entries()];
    for (let i = 0; i < 2; i++) for (const action of ['console', 'seat', 'phase', 'extend', 'notice', 'close', 'reveal']) {
      const r = await call(session, { action, code: rooms[1 - i], to: 'briefing', tableId: 'T1', noticeId: 'closest', on: true, skipWalkthrough: true }, instructors[i]);
      eq([r.status, r.body.error], [403, 'not_session_owner'], `instructor ${i + 1} cannot ${action} the other's room`);
    }
    eq([...db.entries()], snapshot, 'cross-instructor calls cannot mutate sessions, rosters, tables or reports');
  }
  await denyCrossAccess();
  for (let i = 0; i < 2; i++) {
    const code = rooms[i], headers = instructors[i];
    eq((await call(session, { action: 'console', code }, headers)).status, 200);
    eq((await call(session, { action: 'seat', code }, headers)).status, 200);
    for (const to of ['briefing', 'openings', 'negotiation']) eq((await call(session, { action: 'phase', code, to }, headers)).status, 200);
    eq((await call(session, { action: 'notice', code, tableId: 'T1', noticeId: 'closest' }, headers)).status, 200);
    eq((await call(session, { action: 'extend', code }, headers)).status, 200);
    eq((await call(session, { action: 'reveal', code, on: true }, headers)).status, 200);
  }
  await denyCrossAccess();
  const beforeDeadline = now; now += 56 * 60000;
  await denyCrossAccess(); // Ownership is checked before lazy deadline settlement, too.
  now = beforeDeadline;
  for (let i = 0; i < 2; i++) eq((await call(session, { action: 'close', code: rooms[i] }, instructors[i])).body.phase, 'closed');

  const otherOwner = auth({ sub: 'other-teacher', role: 'faculty' });
  const otherCourseRoom = (await call(session, { action: 'create' }, otherOwner)).body.code;
  for (const [room, stranger] of [[code, otherOwner], [otherCourseRoom, owner]]) {
    for (const action of ['console', 'seat', 'phase', 'extend', 'notice', 'close', 'reveal']) {
      eq((await call(session, { action, code: room, to: 'briefing', tableId: 'T1', noticeId: 'closest', on: true }, stranger)).status, 403, 'distinct platform faculty in the same course cannot cross-access either room');
    }
  }

  // The owner may explicitly bypass missing readers without marking them complete.
  const readers = [];
  for (let i = 0; i < 4; i++) {
    const headers = auth({ sub: 'reader' + i, name: 'Reader ' + i });
    const joined = await call(session, { action: 'join', code: otherCourseRoom }, headers);
    eq(joined.status, 200);
    const person = { ...joined.body, headers: { ...headers, 'x-participant-key': joined.body.participantKey } };
    readers.push(person);
    for (let step = 1; step <= (i < 2 ? 4 : 1); step++) eq((await call(session, { action: 'walkthrough', code: otherCourseRoom, ...person, step }, person.headers)).status, 200);
  }
  eq((await call(session, { action: 'seat', code: otherCourseRoom }, otherOwner)).status, 200);
  const waitingRoom = await store.get(keys.session(otherCourseRoom));
  for (const skipWalkthrough of [undefined, false, 'true']) {
    eq((await call(session, { action: 'phase', code: otherCourseRoom, to: 'briefing', skipWalkthrough }, otherOwner)).status, 409, 'only an explicit override bypasses readers');
  }
  eq(await store.get(keys.session(otherCourseRoom)), waitingRoom, 'normal start does not alter the waiting room or clock');
  for (const stranger of [owner, readers[2].headers]) {
    eq((await call(session, { action: 'phase', code: otherCourseRoom, to: 'briefing', skipWalkthrough: true }, stranger)).status, stranger === owner ? 403 : 401, 'other faculty and students cannot override readiness');
  }
  eq((await call(session, { action: 'phase', code: otherCourseRoom, to: 'briefing', skipWalkthrough: true }, otherOwner)).status, 200);
  const overridden = await store.get(keys.session(otherCourseRoom));
  eq(overridden.phaseEndsAt, now + C.timing.briefing * 60000, 'confirmed override starts the normal briefing clock');
  eq(overridden.walkthroughOverride.participants, readers.slice(2).map((p, i) => ({ id: p.participantId, name: 'Reader ' + (i + 2) })), 'audit record names only the unfinished students');
  for (const person of readers.slice(2)) {
    const v = (await call(session, { action: 'view', code: otherCourseRoom, ...person }, person.headers)).body;
    eq(v.phase, 'briefing'); eq(v.walkthrough, undefined, 'unfinished readers enter their brief immediately');
    assert.ok(v.brief && v.brief.person);
    eq((await store.get(keys.roster(otherCourseRoom)))[person.participantId].walkthroughStep, 1, 'override does not claim the student finished reading');
  }
  const beforeRepeat = await store.get(keys.session(otherCourseRoom));
  eq((await call(session, { action: 'phase', code: otherCourseRoom, to: 'briefing', skipWalkthrough: true }, otherOwner)).status, 400, 'override cannot restart the briefing timer');
  eq(await store.get(keys.session(otherCourseRoom)), beforeRepeat);

  // A stored room from before the walkthrough version must remain playable.
  const legacyCode = (await call(session, { action: 'create' }, instructors[0])).body.code;
  const currentRoom = await store.get(keys.session(legacyCode)), legacyRoom = { ...currentRoom };
  delete legacyRoom.walkthroughVersion;
  await store.cas(keys.session(legacyCode), currentRoom, legacyRoom);
  let legacyParticipant;
  for (let i = 0; i < 4; i++) legacyParticipant = (await call(session, { action: 'join', code: legacyCode, name: 'Existing participant ' + i }, { 'x-access-code': 'guest-code' })).body;
  eq((await call(session, { action: 'seat', code: legacyCode }, instructors[0])).status, 200);
  eq((await call(session, { action: 'phase', code: legacyCode, to: 'briefing' }, instructors[0])).status, 200, 'legacy rooms can start briefing without a new prerequisite');
  eq((await call(session, { action: 'view', code: legacyCode, ...legacyParticipant }, { 'x-participant-key': legacyParticipant.participantKey })).body.walkthrough, undefined, 'legacy participants do not get pushed back into the new walkthrough');

  const guestRoom = await call(session, { action: 'create' }, instructors[0]);
  delete process.env.ACCESS_CODE;
  eq((await call(session, { action: 'join', code: guestRoom.body.code })).status, 401, 'missing access configuration fails closed');
  eq((await call(session, { action: 'console', code: guestRoom.body.code }, owner)).status, 403, 'platform faculty cannot take over a standalone instructor room');
  console.log(`All integration tests pass (${assertions} assertions).`);
})().catch(e => { console.error('FAIL', e.stack); process.exit(1); });
