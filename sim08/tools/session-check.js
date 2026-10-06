#!/usr/bin/env node
// Exercises the real /api/session and /api/finish handlers against an in-memory
// store that honours the same compare-and-set contract as the Redis scripts.
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const store = require('../lib/store.js');
const C = require('../config/content.js');
const E = require('../lib/engine.js');

process.env.LAUNCH_SECRET = 'test-secret-not-real';
process.env.FACULTY_CODES = 'Tester:fac-code';
delete process.env.ACCESS_CODE;
delete process.env.PLATFORM_URL;

let clockMs = 1_800_000_000_000;
Date.now = () => clockMs;
const advance = (s) => { clockMs += s * 1000; };

const sessions = new Map(), people = new Map(), runsBy = new Map();
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
store.configured = () => true;
store.putSession = async (c, v) => { sessions.set(c, structuredClone(v)); return v; };
store.getSession = async (c) => structuredClone(sessions.get(c) || null);
store.getParticipants = async (c) => structuredClone(people.get(c) || {});
store.addParticipant = async (c, id, v) => { const m = people.get(c) || {}; m[id] = structuredClone(v); people.set(c, m); };
store.getRuns = async (c) => structuredClone(runsBy.get(c) || {});
store.compareAndSetSession = async (c, prev, next) => {
  if (!same(sessions.get(c), prev)) return false; sessions.set(c, structuredClone(next)); return true;
};
store.compareAndSetParticipant = async (c, id, prev, next, sess) => {
  if (!same(sessions.get(c), sess)) return false;
  const m = people.get(c) || {};
  if (!same(m[id], prev)) return false;
  m[id] = structuredClone(next); people.set(c, m); return true;
};
store.compareAndSetRoster = async (c, prev, next, sess) => {
  if (!same(sessions.get(c), sess) || !same(people.get(c) || {}, prev)) return false;
  people.set(c, structuredClone(next)); return true;
};
let casRunCalls = 0, forceRunConflict = 0;
store.compareAndSetRun = async (c, runId, prev, next, sess, participants) => {
  casRunCalls++;
  if (forceRunConflict > 0) { forceRunConflict--; return false; }
  if (!same(sessions.get(c), sess) || !same(people.get(c) || {}, participants)) return false;
  const m = runsBy.get(c) || {};
  if (!same(m[runId], prev)) return false;
  m[runId] = structuredClone(next); runsBy.set(c, m); return true;
};

const session = require('../api/session.js');
const finish = require('../api/finish.js');
const config = require('../api/config.js');
const joinEntry = require('../api/join.js');

function token({ sub, name = 'Student', role = 'student', mode = 'play', course = null, sim = C.META.id }) {
  const p = { sub, name, role, sim, mode, course, iat: Date.now(), exp: Date.now() + 3600e3 };
  const body = Buffer.from(JSON.stringify(p)).toString('base64url');
  return body + '.' + createHmac('sha256', process.env.LAUNCH_SECRET).update(body).digest('base64url');
}
async function call(handler, body, headers = {}, method = 'POST', query = {}) {
  const res = { statusCode: 200, payload: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; },
    redirect(n, url) { this.statusCode = n; this.location = url; return this; },
    json(v) { this.payload = v; return this; }, end() { return this; } };
  await handler({ method, headers, body, query }, res);
  return { status: res.statusCode, body: res.payload, location: res.location };
}
const api = (b, h) => call(session, b, h);
const fac = { 'x-faculty-code': 'fac-code' };
let n = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const ok = (c, m) => { assert.ok(c, m); n++; };
const hides = (obj, text, m) => ok(!JSON.stringify(obj).includes(text), m);

const answer = (id, v) => C.QUESTIONS.find(q => q.id === id).answers[v];
const startAt = {};
const goto = (code, phase) => { clockMs = startAt[code] + E.phaseStart(phase) * 1000 + 1000; };

(async () => {
  // Authorisation and required choices.
  eq((await api({ action: 'create', mode: 'individual' })).status, 401, 'anonymous create refused');
  eq((await api({ action: 'create' }, fac)).status, 400, 'mode has no default');
  eq((await api({ action: 'create', mode: 'individual' }, { 'x-launch-token': token({ sub: 's1' }) })).status, 401, 'student token cannot create');

  // ---------- Individual room ----------
  const created = await api({ action: 'create', mode: 'individual' }, fac);
  eq(created.status, 200, 'faculty create');
  const code = created.body.session.code;
  const a = (await api({ action: 'join', code, name: 'Ana' })).body.participantId;
  const bn = (await api({ action: 'join', code, name: 'Ben' })).body.participantId;
  let s = await api({ action: 'state', code, participantId: a });
  eq(s.body.view.clock.phase, 'lobby', 'lobby before start');
  hides(s.body.view, answer('q10', 'kestrel'), 'no answers in the lobby');
  eq((await api({ action: 'control', code, set: 'start' })).status, 401, 'student cannot start');
  eq((await api({ action: 'control', code, set: 'start' }, fac)).status, 200, 'faculty start');
  startAt[code] = clockMs;

  s = await api({ action: 'state', code, participantId: a });
  eq(s.body.view.clock.phase, 'briefing', 'briefing first');
  ok(!s.body.view.menu, 'no menu during the briefing');
  ok(!s.body.view.demos, 'no demos during the briefing');
  eq((await api({ action: 'ask', code, participantId: a, question: 'q10' })).status, 409, 'cannot ask during the briefing');

  goto(code, 'demos');
  s = await api({ action: 'state', code, participantId: a });
  eq(s.body.view.demos.length, 3, 'three prepared demos');
  eq((await api({ action: 'ask', code, participantId: a, question: 'q10' })).status, 409, 'cannot ask during demos');

  goto(code, 'questions');
  s = await api({ action: 'state', code, participantId: a });
  eq(s.body.view.menu.length, 16, 'sixteen questions on the menu');
  ok(s.body.view.menu.every(q => !('group' in q) && !('answers' in q) && !('routes' in q)), 'menu carries no groups, answers or routes');
  for (const q of C.QUESTIONS) for (const v of E.VENDOR_KEYS) hides(s.body.view, q.answers[v], 'no unspent answer reaches the student');
  for (const p of C.PLANS) hides(s.body.view, p.text, 'no plan during questions');
  eq(s.body.view.left, 6, 'six to spend');

  let r = await api({ action: 'ask', code, participantId: a, question: 'q10' });
  eq(r.status, 200, 'ask q10');
  eq(r.body.view.asked[0].answers.map(x => x.text), E.VENDOR_KEYS.map(v => answer('q10', v)), 'all three vendors answer');
  eq(r.body.view.asked[0].by, '', 'individual answers carry no asker name');
  eq((await api({ action: 'ask', code, participantId: a, question: 'q10' })).status, 409, 'same question twice refused');
  eq((await api({ action: 'ask', code, participantId: a, question: 'q99' })).status, 400, 'unknown question refused');
  forceRunConflict = 2;
  const before = casRunCalls;
  eq((await api({ action: 'ask', code, participantId: a, question: 'q01' })).status, 200, 'ask survives two write conflicts');
  ok(casRunCalls - before === 3, 'the ask was retried after each conflict');
  for (const q of ['q02', 'q03', 'q04', 'q05']) eq((await api({ action: 'ask', code, participantId: a, question: q })).status, 200, 'ask ' + q);
  r = await api({ action: 'ask', code, participantId: a, question: 'q11' });
  eq([r.status, r.body.error], [409, 'budget_spent'], 'seventh question refused');
  s = await api({ action: 'state', code, participantId: bn });
  hides(s.body.view, answer('q10', 'kestrel'), 'another student never sees my answers');
  eq(s.body.view.left, 6, 'budgets are per student');
  eq((await api({ action: 'ask', code, participantId: bn, question: 'q15' })).status, 200, 'Ben asks');

  // Pause holds the clock.
  eq((await api({ action: 'control', code, set: 'pause' }, fac)).status, 200, 'pause');
  eq((await api({ action: 'ask', code, participantId: bn, question: 'q16' })).status, 409, 'cannot ask while paused');
  advance(600);
  s = await api({ action: 'state', code, participantId: a });
  eq(s.body.view.clock.phase, 'questions', 'paused clock stays in questions');
  eq((await api({ action: 'control', code, set: 'resume' }, fac)).status, 200, 'resume');
  startAt[code] += 600 * 1000;

  // A late joiner plays but stays out of the comparison.
  const late = (await api({ action: 'join', code, name: 'Cal' })).body.participantId;

  goto(code, 'commit');
  eq((await api({ action: 'ask', code, participantId: bn, question: 'q16' })).status, 409, 'questions closed');
  s = await api({ action: 'state', code, participantId: a });
  for (const p of C.PLANS) hides(s.body.view, p.text, 'no plan before the vendor locks');
  eq((await api({ action: 'vote', code, participantId: a, kind: 'plan', choice: 'cover' })).status, 409, 'plan vote refused during commit');
  eq((await api({ action: 'vote', code, participantId: a, kind: 'vendor', choice: 'acme' })).status, 400, 'unknown vendor refused');
  eq((await api({ action: 'vote', code, participantId: a, kind: 'vendor', choice: 'kestrel' })).status, 200, 'Ana commits to Kestrel');
  eq((await api({ action: 'vote', code, participantId: a, kind: 'vendor', choice: 'pawtime' })).status, 409, 'vendor vote is final');

  goto(code, 'plan');
  s = await api({ action: 'state', code, participantId: bn });
  eq(s.body.view.vendor, { key: 'pawtime', name: 'Pawtime', boardChose: true }, 'Ben did not commit: the board chose on price');
  eq(s.body.view.plans.length, 4, 'four plans once the vendor locks');
  hides(s.body.view, C.REPORTS.pawtime.adopted.text, 'no report before the report phase');
  eq((await api({ action: 'vote', code, participantId: a, kind: 'plan', choice: 'cover' })).status, 200, 'Ana funds cover');
  eq((await api({ action: 'vote', code, participantId: bn, kind: 'plan', choice: 'multisite' })).status, 200, 'Ben buys multi-site');

  // Projector during play: counts only.
  let f = await api({ action: 'faculty_state', code }, fac);
  eq(f.body.projector.rows, null, 'no per-run rows before the report');
  eq(f.body.projector.live.kind, 'plan', 'live plan count');
  eq((await api({ action: 'control', code, set: 'reveal', step: 1 }, fac)).status, 409, 'cannot reveal before the report');
  eq((await call(finish, { code, participantId: a })).body.reported, false, 'a run without a platform launch is not reported');

  goto(code, 'report');
  s = await api({ action: 'state', code, participantId: a });
  eq(s.body.view.report.vendor, 'Kestrel Practice Suite', 'Ana bought Kestrel');
  eq(s.body.view.report.text, C.REPORTS.kestrel.adopted.text, 'q10 plus cover: adopted');
  for (const w of Object.values(C.DEBRIEF.tierLabels)) hides(s.body.view, w, 'no tier label reaches the student');
  s = await api({ action: 'state', code, participantId: bn });
  eq(s.body.view.report.text, C.REPORT_NOTES.boardChose + ' ' + C.REPORTS.pawtime.adopted.text, 'Ben found the Pawtime risk through q15');

  f = await api({ action: 'faculty_state', code }, fac);
  eq(f.body.projector.rows.map(x => x.label), ['Player 1', 'Player 2'], 'late joiner out of the comparison; anonymous labels');
  eq(f.body.projector.late, 1, 'late joiner counted');
  ok(!JSON.stringify(f.body.projector.rows).includes('Ana'), 'projector rows carry no student names');
  eq((await api({ action: 'control', code, set: 'reveal', step: 1 })).status, 401, 'students cannot reveal');
  eq((await api({ action: 'control', code, set: 'reveal', step: 9 }, fac)).status, 400, 'no step nine');
  eq((await api({ action: 'control', code, set: 'reveal', step: 2 }, fac)).status, 200, 'reveal step 2');
  f = await api({ action: 'faculty_state', code }, fac);
  eq(f.body.projector.revealStep, 2, 'reveal step stored for every screen');

  // ---------- Team room ----------
  const t = await api({ action: 'create', mode: 'team' }, fac);
  const tc = t.body.session.code;
  const ids = {};
  for (const nm of ['Ada', 'Bo', 'Cy', 'Di', 'Ed']) ids[nm] = (await api({ action: 'join', code: tc, name: nm })).body.participantId;
  eq((await api({ action: 'control', code: tc, set: 'start' }, fac)).status, 409, 'team start refused with unassigned students');
  eq((await api({ action: 'group', code: tc, assign: { [ids.Ada]: 'Red', [ids.Bo]: 'Red', [ids.Cy]: 'Red', [ids.Di]: 'Blue', [ids.Ed]: 'Blue' } }, fac)).status, 200, 'teams assigned');
  eq((await api({ action: 'control', code: tc, set: 'start' }, fac)).status, 200, 'team start');
  startAt[tc] = clockMs;
  eq((await api({ action: 'join', code: tc, name: 'Fay' })).status, 409, 'team session closed to newcomers');

  goto(tc, 'questions');
  eq((await api({ action: 'ask', code: tc, participantId: ids.Ada, question: 'q11' })).status, 200, 'Ada spends one for Red');
  s = await api({ action: 'state', code: tc, participantId: ids.Bo });
  eq(s.body.view.asked[0].by, 'Ada', 'Bo sees who asked');
  eq(s.body.view.left, 5, 'the budget is shared');
  eq((await api({ action: 'ask', code: tc, participantId: ids.Bo, question: 'q11' })).status, 409, 'a teammate cannot re-ask');
  for (const [who, q] of [['Bo', 'q01'], ['Cy', 'q02'], ['Ada', 'q03'], ['Bo', 'q04'], ['Cy', 'q06']]) {
    eq((await api({ action: 'ask', code: tc, participantId: ids[who], question: q })).status, 200, `${who} asks ${q}`);
  }
  eq((await api({ action: 'ask', code: tc, participantId: ids.Ada, question: 'q12' })).body.error, 'budget_spent', 'shared cap of six');
  s = await api({ action: 'state', code: tc, participantId: ids.Di });
  eq(s.body.view.left, 6, 'Blue has its own six');
  hides(s.body.view, answer('q11', 'tailwind'), "Blue never sees Red's answers");
  for (const q of ['q01', 'q02', 'q03', 'q04', 'q06', 'q08']) await api({ action: 'ask', code: tc, participantId: ids.Di, question: q });

  goto(tc, 'commit');
  for (const nm of ['Ada', 'Bo']) await api({ action: 'vote', code: tc, participantId: ids[nm], kind: 'vendor', choice: 'tailwind' });
  await api({ action: 'vote', code: tc, participantId: ids.Cy, kind: 'vendor', choice: 'kestrel' });
  await api({ action: 'vote', code: tc, participantId: ids.Di, kind: 'vendor', choice: 'tailwind' });
  goto(tc, 'plan');
  s = await api({ action: 'state', code: tc, participantId: ids.Cy });
  eq(s.body.view.vendor.key, 'tailwind', 'Red majority: Tailwind');
  eq(s.body.view.vendor.boardChose, false, 'majority is not the board');
  s = await api({ action: 'state', code: tc, participantId: ids.Ed });
  eq(s.body.view.vendor.key, 'tailwind', 'Blue: one vote carries it');
  for (const nm of ['Ada', 'Cy']) await api({ action: 'vote', code: tc, participantId: ids[nm], kind: 'plan', choice: 'owner' });
  await api({ action: 'vote', code: tc, participantId: ids.Di, kind: 'plan', choice: 'owner' });
  await api({ action: 'vote', code: tc, participantId: ids.Ed, kind: 'plan', choice: 'parallel' });

  goto(tc, 'report');
  s = await api({ action: 'state', code: tc, participantId: ids.Bo });
  eq(s.body.view.report.text, C.REPORTS.tailwind.adopted.text, 'Red: asked q11 and named an owner');
  s = await api({ action: 'state', code: tc, participantId: ids.Di });
  eq(s.body.view.report.text, C.REPORT_NOTES.noPlan + ' ' + C.REPORTS.tailwind.shadow.text, 'Blue: plan tie funds nothing; diligence found nothing');
  f = await api({ action: 'faculty_state', code: tc }, fac);
  eq(f.body.projector.rows.map(x => [x.label, x.vendor, x.tier]).sort(), [['Blue', 'tailwind', 'shadow'], ['Red', 'tailwind', 'adopted']], 'projector rows');
  ok(/Tailwind Scheduling/.test(f.body.projector.disagreement) && /Red/.test(f.body.projector.disagreement) && /Blue/.test(f.body.projector.disagreement), 'disagreement names the two Tailwind teams');
  ok(f.body.projector.rows.find(x => x.label === 'Red').questions.find(q => q.id === 'q11').route === 'direct', 'route marked for step 4');

  // Completion report for a platform participant.
  const solo = await api({ action: 'solo' }, { 'x-launch-token': token({ sub: 'p1', name: 'Pat' }) });
  eq(solo.status, 200, 'platform solo run');
  const sc = solo.body.code, sp = solo.body.participantId;
  startAt[sc] = clockMs;
  const lt = { 'x-launch-token': token({ sub: 'p1', name: 'Pat' }) };
  eq((await call(finish, { code: sc, participantId: sp }, lt)).status, 409, 'not finished before the report');
  goto(sc, 'report');
  // A missing platform or transient callback failure must never mark a run done.
  r = await call(finish, { code: sc, participantId: sp }, lt);
  eq(r.body.reported, false, 'unconfigured platform is not acknowledged');
  ok(!(await store.getParticipants(sc))[sp].reportedAt, 'failed completion remains retryable');
  process.env.PLATFORM_URL = 'https://platform.test';
  const realFetch = global.fetch;
  let reports = 0, callback = null;
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://platform.test/api/complete');
    reports++;
    callback = require('../lib/launch.js').verifyLaunch(JSON.parse(options.body).token);
    return { ok: reports > 1, status: reports > 1 ? 200 : 503, json: async () => ({}) };
  };
  eq((await call(finish, { code: sc, participantId: sp }, lt)).body.reported, false, '503 callback retried');
  eq((await call(finish, { code: sc, participantId: sp }, lt)).body.reported, true, 'successful callback acknowledged');
  eq([callback.sub, callback.sim], ['p1', C.META.id], 'completion uses signed identity');
  eq((await call(finish, { code: sc, participantId: sp }, lt)).body.already, true, 'reported once');
  eq(reports, 2, 'completed run is not sent twice');
  global.fetch = realFetch;
  delete process.env.PLATFORM_URL;

  // Guest invitations bypass only the standalone gate; signed class access is preserved.
  eq((await call(config, {}, {}, 'GET', { session: code })).status, 200, 'guest class config needs no access code');
  eq((await call(joinEntry, {}, {}, 'GET', { session: code })).location, '../index.html?session=' + code + '&guest=1', 'guest link opens guest class');
  const facultyToken = { 'x-launch-token': token({ sub: 'teacher', role: 'faculty', mode: 'session', course: 'course-a' }) };
  const pc = (await api({ action: 'create', mode: 'individual' }, facultyToken)).body.session.code;
  const pupil = { 'x-launch-token': token({ sub: 'pupil', course: 'course-a' }) };
  eq((await call(config, {}, {}, 'GET', { session: pc })).body.error, 'platform_signin_required', 'signed room requires account');
  eq((await call(config, {}, pupil, 'GET', { session: pc })).status, 200, 'signed invitation opens without access code');
  eq((await call(config, {}, { 'x-launch-token': token({ sub: 'pupil', course: 'wrong' }) }, 'GET', { session: pc })).status, 403, 'wrong course refused');
  const entryUrl = new URL((await call(joinEntry, {}, {}, 'GET', { session: pc })).location);
  eq([entryUrl.searchParams.get('sim'), entryUrl.searchParams.get('course')], [C.META.id, 'course-a'], 'join bridge preserves sim and course');
  eq((await api({ action: 'join', code: pc }, pupil)).body.participantId, 'platform:pupil', 'participant uses account identity');
  eq((await call(config, {}, {}, 'GET', { session: sc })).body.error, 'private_session', 'solo config is not a class invitation');
  eq((await call(joinEntry, {}, {}, 'GET', { session: sc })).body.error, 'private_session', 'solo cannot be shared');
  eq((await api({ action: 'faculty_state', code: sc }, lt)).status, 401, 'student cannot inspect private room as faculty');
  eq((await call(finish, { code, participantId: a }, pupil)).body.reason, 'standalone', 'guest work is never attached to an unrelated account');
  process.env.ACCESS_CODE = 'solo-access';
  const guestSolo = await api({ action: 'solo', name: 'Standalone' }, { 'x-access-code': 'solo-access' });
  eq(guestSolo.status, 200, 'access code opens private play without a class code');
  eq(guestSolo.body.session.solo, true, 'standalone room is private');
  ok(/^[a-f0-9]{32}$/.test(guestSolo.body.participantId), 'guest participant credential has sufficient entropy');
  delete process.env.ACCESS_CODE;

  // Closing early freezes the room where it stood.
  const e = await api({ action: 'create', mode: 'individual' }, fac);
  const ec = e.body.session.code;
  const ep = (await api({ action: 'join', code: ec, name: 'Eve' })).body.participantId;
  await api({ action: 'control', code: ec, set: 'start' }, fac); startAt[ec] = clockMs;
  goto(ec, 'questions');
  await api({ action: 'control', code: ec, set: 'close' }, fac);
  advance(3600);
  s = await api({ action: 'state', code: ec, participantId: ep });
  eq([s.body.view.clock.phase, s.body.view.clock.closed, s.body.view.canAsk], ['questions', true, false], 'closed early stays frozen and inert');
  ok(!s.body.view.report, 'no report for a session closed early');

  console.log(`PASS session-check: ${n} assertions`);
})().catch(e => { console.error(e); process.exit(1); });
