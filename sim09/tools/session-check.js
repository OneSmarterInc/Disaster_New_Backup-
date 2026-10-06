#!/usr/bin/env node
// Exercises the real /api/session and /api/finish handlers against an in-memory
// store that honours the same compare-and-set contract as the Redis scripts.
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const store = require('../lib/store.js');
const C = require('../config/content.js');

process.env.LAUNCH_SECRET = 'test-secret-not-real';
process.env.FACULTY_CODES = 'Tester:fac-code';
process.env.ACCESS_CODE = 'open-sesame';
delete process.env.PLATFORM_URL;

let clockMs = 1_800_000_000_000;
Date.now = () => clockMs;
const advance = (s) => { clockMs += s * 1000; };

const sessions = new Map(), people = new Map();
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
store.configured = () => true;
store.putSession = async (c, v) => { sessions.set(c, structuredClone(v)); return v; };
store.getSession = async (c) => structuredClone(sessions.get(c) || null);
store.getParticipants = async (c) => structuredClone(people.get(c) || {});
store.addParticipant = async (c, id, v) => { const m = people.get(c) || {}; m[id] = structuredClone(v); people.set(c, m); };
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

const session = require('../api/session.js');
const finish = require('../api/finish.js');

function token({ sub, name = 'Student', role = 'student', mode = 'play', course = null, sim = C.META.id }) {
  const p = { sub, name, role, sim, mode, course, iat: Date.now(), exp: Date.now() + 3600e3 };
  const body = Buffer.from(JSON.stringify(p)).toString('base64url');
  return body + '.' + createHmac('sha256', process.env.LAUNCH_SECRET).update(body).digest('base64url');
}
async function call(handler, body, headers = {}) {
  const res = { statusCode: 200, payload: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; },
    json(v) { this.payload = v; return this; }, end() { return this; } };
  await handler({ method: 'POST', headers, body }, res);
  return { status: res.statusCode, body: res.payload };
}
const api = (b, h) => call(session, b, h);
const fac = { 'x-faculty-code': 'fac-code' };
let n = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const ok = (c, m) => { assert.ok(c, m); n++; };

// Strings that must never reach a student before their stage is released.
const stageSecrets = C.REVEAL.stages.map(s => [s.direction, s.destination, ...Object.values(s.companies)]);
const nameSecrets = Object.values(C.REVEAL.names);
const leaks = (obj, texts) => texts.filter(t => JSON.stringify(obj).includes(JSON.stringify(t).slice(1, -1)));

const T = C.FUND.total, S = C.FUND.step;
const good = { direction: 'Purchasing between businesses moves onto the internet over the next four years.', pick: 'buyers', reason: 'Suppliers bid prices down in auctions and the buyer keeps the difference.' };
const toMarket = { ...good, pick: 'marketplaces' };
const alloc = (m) => Object.fromEntries(['RA', 'IC', 'LS', 'MS', 'PS', 'cash'].map(k => [k, m[k] || 0]));

(async () => {
  // Authorisation and the required mode choice.
  eq((await api({ action: 'create', mode: 'individual' })).status, 401, 'anonymous create refused');
  eq((await api({ action: 'create' }, fac)).status, 400, 'mode has no default');
  eq((await api({ action: 'create', mode: 'individual' }, { 'x-launch-token': token({ sub: 's1' }) })).status, 401, 'student token cannot create');

  // ---------- Individual room ----------
  const created = await api({ action: 'create', mode: 'individual' }, fac);
  eq(created.status, 200, 'faculty creates an individual room');
  const code = created.body.session.code;
  const ann = await api({ action: 'join', code, name: 'Ann' });
  const bob = await api({ action: 'join', code, name: 'Bob' });
  const A = ann.body.participantId, Bb = bob.body.participantId;
  const st = async (pid) => (await api({ action: 'state', code, participantId: pid })).body.view;

  eq((await st(A)).clock.phase, 'lobby', 'students wait in the lobby');
  eq((await api({ action: 'control', code, set: 'release' }, fac)).status, 409, 'nothing to release before start');
  eq((await api({ action: 'control', code, set: 'start' }, fac)).status, 200, 'instructor starts');
  eq((await st(A)).clock.phase, 'briefing', 'play opens on the briefing');
  eq((await api({ action: 'statements', code, participantId: A, statements: good })).body.error, 'statements_closed', 'no statements during the briefing');

  // Pause freezes the clock and blocks writes.
  await api({ action: 'control', code, set: 'pause' }, fac);
  advance(C.CLOCK.briefingSeconds + 5);
  eq((await st(A)).clock.phase, 'briefing', 'a paused clock does not move');
  await api({ action: 'control', code, set: 'resume' }, fac);
  eq((await api({ action: 'control', code, set: 'advance' }, fac)).status, 200, 'instructor can skip the rest of the briefing');
  eq((await st(A)).clock.phase, 'wall', 'the wall is open');
  ok((await st(A)).canWriteStatements, 'students can write statements');

  // The wall.
  eq((await api({ action: 'statements', code, participantId: A, statements: { ...good, direction: 'online' } })).body.error, 'direction_too_short', 'thin direction refused');
  eq((await api({ action: 'statements', code, participantId: A, statements: good })).status, 200, 'Ann locks her statements');
  eq((await api({ action: 'statements', code, participantId: A, statements: toMarket })).body.error, 'statements_locked', 'statements cannot be rewritten');
  eq((await api({ action: 'statements', code, participantId: Bb, statements: toMarket })).status, 200, 'Bob locks his');
  eq((await api({ action: 'allocate', code, participantId: A, allocation: alloc({ cash: T }) })).body.error, 'allocation_closed', 'no money moves during the wall');

  // The projector shows counts, never positions, until allocation closes.
  const during = (await api({ action: 'faculty_state', code }, fac)).body.projector;
  eq(during.statementsIn, 2, 'projector counts locked statements');
  eq(during.room, null, 'projector shows no positions while the wall is open');

  advance(C.CLOCK.wallSeconds);
  const v = await st(A);
  eq(v.clock.phase, 'allocate', 'allocation opens');
  eq(v.canWriteStatements, false, 'statements are locked once allocation opens');
  ok(v.cashAllowed, 'Ann picked buyers, so she may hold cash');
  ok(!(await st(Bb)).cashAllowed, 'Bob picked marketplaces, so he may not');
  eq((await api({ action: 'allocate', code, participantId: Bb, allocation: alloc({ RA: T - S, cash: S }) })).body.error, 'cash_not_allowed', 'cash refused when the pick names one of the five');
  const short = await api({ action: 'allocate', code, participantId: A, allocation: alloc({ RA: T - S }) });
  eq([short.body.error, short.body.left], ['fund_not_fully_placed', S], 'an unplaced step is refused and reported');
  eq((await api({ action: 'allocate', code, participantId: A, allocation: alloc({ RA: T / 2, cash: T / 2 }) })).status, 200, 'Ann commits half to one company, half cash');
  eq((await api({ action: 'allocate', code, participantId: A, allocation: alloc({ cash: T }) })).body.error, 'allocation_locked', 'an allocation is final');
  const during2 = (await api({ action: 'faculty_state', code }, fac)).body.projector;
  eq([during2.allocationsIn, during2.room], [1, null], 'projector counts allocations but shows none while allocation is open');

  // Early close needs every unit committed, or a deliberate force.
  eq((await api({ action: 'control', code, set: 'close_allocation' }, fac)).body.error, 'allocations_outstanding', 'early close refused while someone is still deciding');
  eq((await api({ action: 'control', code, set: 'release' }, fac)).body.error, 'allocation_still_open', 'history cannot arrive while money can still move');
  eq((await api({ action: 'allocate', code, participantId: Bb, allocation: alloc({ RA: T / 5, IC: T / 5, LS: T / 5, MS: T / 5, PS: T / 5 }) })).status, 200, 'Bob spreads across all five');
  eq((await api({ action: 'control', code, set: 'close_allocation' }, fac)).status, 200, 'early close once everyone has committed');

  // Held: the room sees positions and statements; students still see no history.
  const held = (await api({ action: 'faculty_state', code }, fac)).body.projector;
  eq(held.clock.phase, 'held', 'history is held for the disagreement');
  eq(held.room.placed, 2, 'both funds are on the wall');
  eq(held.room.concentrated.length, 0, 'half in one company is not a concentrated bet at the agreed threshold');
  eq(held.room.contradictions.map(c => c.id), [A], 'Ann said buyers and put half into a marketplace');
  eq(held.room.stages, [], 'no stage values before release');
  eq(held.room.names, null, 'no names before the last stage');
  let sv = await st(A);
  eq([sv.stages.length, sv.names], [0, null], 'students see no history while held');
  eq(leaks(sv, stageSecrets.flat().concat(nameSecrets)), [], 'no stage or name text reaches a student before release');

  // Staged release.
  eq((await api({ action: 'control', code, set: 'release' }, fac)).status, 200, '2002 released');
  sv = await st(A);
  eq(sv.stages.map(s => s.year), [2002], 'only 2002 is visible');
  eq(leaks(sv, stageSecrets[1].concat(stageSecrets[2], nameSecrets)), [], 'nothing from 2004, 2010 or the names leaks early');
  eq(sv.stages[0].fund, '$600K', 'Ann: $500K cash plus half a fund in the reverse-auction firm');
  eq(sv.stages[0].companies.find(c => c.key === 'RA').value, '$100K', 'her position shows its own value');
  eq(sv.statements.pick, 'buyers', 'her own statements come back beside history');
  eq((await st(Bb)).stages[0].fund, '$50K', 'Bob: a fifth in each, by 2002');
  eq((await api({ action: 'faculty_state', code }, fac)).body.projector.room.stages.length, 1, 'the projector aggregates the released stage');
  eq((await api({ action: 'finish', code, participantId: A })).status, 400, 'finish is a separate endpoint');
  await api({ action: 'control', code, set: 'release' }, fac);
  await api({ action: 'control', code, set: 'release' }, fac);
  sv = await st(A);
  eq(sv.stages.map(s => s.fund), ['$600K', '$540K', '$540K'], 'Ann’s fund at each stage');
  eq(sv.names.list.length, 5, 'names arrive with the last stage');
  eq((await api({ action: 'control', code, set: 'release' }, fac)).body.error, 'history_complete', 'there is no fourth stage');
  const last = (await api({ action: 'faculty_state', code }, fac)).body.projector;
  ok(last.room.names && last.debrief.epilogue, 'names and the epilogue reach the projector at the end');
  eq((await api({ action: 'control', code, set: 'close' }, fac)).status, 200, 'instructor closes');
  eq((await api({ action: 'join', code, name: 'Late' })).status, 410, 'a closed room refuses joins');

  // ---------- Team room ----------
  const t = (await api({ action: 'create', mode: 'team' }, fac)).body.session.code;
  const m = {};
  for (const nm of ['Cy', 'Di', 'Ed']) m[nm] = (await api({ action: 'join', code: t, name: nm })).body.participantId;
  eq((await api({ action: 'control', code: t, set: 'start' }, fac)).body.error, 'unassigned_participants', 'every student needs a team');
  eq((await api({ action: 'group', code: t, assign: { [m.Cy]: 'Red', [m.Di]: 'Red', [m.Ed]: 'Blue' } }, fac)).status, 200, 'teams assigned');
  eq((await api({ action: 'control', code: t, set: 'start' }, fac)).status, 200, 'team room starts');
  eq((await api({ action: 'join', code: t, name: 'Fay' })).body.error, 'teams_locked', 'no new members once teams are fixed');
  advance(C.CLOCK.briefingSeconds);
  eq((await api({ action: 'statements', code: t, participantId: m.Cy, statements: good })).status, 200, 'Cy writes for Red');
  const di = (await api({ action: 'state', code: t, participantId: m.Di })).body.view;
  eq([di.statements.pick, di.statementsBy, di.canWriteStatements], ['buyers', 'Cy', false], 'Di sees the team’s statements and cannot overwrite them');
  eq((await api({ action: 'statements', code: t, participantId: m.Di, statements: toMarket })).body.error, 'statements_locked', 'first press wins');
  const roster = (await api({ action: 'faculty_state', code: t }, fac)).body.roster;
  eq(roster.map(r => r.name).sort(), ['Cy', 'Di', 'Ed'], 'the team record never appears as a student');
  eq((await api({ action: 'state', code: t, participantId: 'team:red' })).body.error, 'not_joined', 'a team record cannot be used as a participant');
  advance(C.CLOCK.wallSeconds);
  eq((await api({ action: 'allocate', code: t, participantId: m.Di, allocation: alloc({ PS: T }) })).status, 200, 'Di commits for Red');
  eq((await api({ action: 'allocate', code: t, participantId: m.Ed, allocation: alloc({ cash: T }) })).body.error, 'cash_not_allowed', 'Blue wrote no statements, so no cash');
  advance(C.CLOCK.allocateSeconds);
  const tp = (await api({ action: 'faculty_state', code: t }, fac)).body.projector;
  eq([tp.clock.phase, tp.units, tp.room.placed], ['held', 2, 1], 'time ran out; Blue’s fund stayed unplaced');
  eq(tp.room.concentrated.map(c => c.label), ['Red'], 'Red went all in');
  await api({ action: 'control', code: t, set: 'release' }, fac);
  eq((await api({ action: 'state', code: t, participantId: m.Cy })).body.view.stages[0].fund, '$40K', 'the whole team sees the team’s fund');
  eq((await api({ action: 'state', code: t, participantId: m.Ed })).body.view.stages[0].fund, null, 'an unplaced fund has no value line');

  // ---------- Solo run ----------
  eq((await api({ action: 'solo', name: 'Gil' })).status, 401, 'solo needs the access code');
  eq((await api({ action: 'create', mode: 'individual' }, { 'x-launch-token': token({ role: 'faculty' }) })).status, 401, 'faculty launch requires an account');
  for (const [claim, status] of [[{ sub: 's', sim: null }, 403], [{ role: 'student' }, 401], [{ sub: 's', role: 'admin' }, 401]]) {
    eq((await api({ action: 'solo' }, { 'x-launch-token': token(claim) })).status, status, 'solo rejects incomplete or invalid launch claims');
  }
  const solo = (await api({ action: 'solo', name: 'Gil' }, { 'x-access-code': 'open-sesame' })).body;
  const sp = { code: solo.code, participantId: solo.participantId };
  eq((await api({ action: 'join', code: solo.code, name: 'Hal' })).body.error, 'private_session', 'nobody joins a private run');
  eq((await api({ action: 'advance', ...sp, participantId: 'someone-else' })).body.error, 'not_your_session', 'only the player moves the run');
  eq((await api({ action: 'advance', ...sp })).status, 200, 'the player skips the briefing');
  eq((await api({ action: 'advance', ...sp })).body.error, 'cannot_advance', 'the wall cannot be skipped without statements');
  await api({ action: 'statements', ...sp, statements: { ...good, pick: 'nobody' } });
  eq((await api({ action: 'advance', ...sp })).status, 200, 'then it moves to allocation');
  const done = await api({ action: 'allocate', ...sp, allocation: alloc({ cash: T }) });
  eq(done.body.view.clock.phase, 'held', 'committing ends a solo allocation');
  for (let i = 0; i < 3; i++) eq((await api({ action: 'advance', ...sp })).status, 200, `solo stage ${i + 1}`);
  const end = (await api({ action: 'state', ...sp })).body.view;
  eq(end.stages.map(s => s.fund), ['$1.00M', '$1.00M', '$1.00M'], 'cash held its value');
  eq((await api({ action: 'advance', ...sp })).body.error, 'cannot_advance', 'nothing after the last stage');
  eq((await api({ action: 'control', code: solo.code, set: 'release' }, fac)).body.error, 'not_your_session', 'faculty cannot drive a private run');

  // ---------- Completion report ----------
  const pc = (await api({ action: 'create', mode: 'individual' }, fac)).body.session.code;
  const lt = token({ sub: 'u9', name: 'Ivy' });
  const iv = (await api({ action: 'join', code: pc, name: 'x' }, { 'x-launch-token': lt })).body.participantId;
  eq(iv, 'platform:u9', 'platform students join as their account');
  const fin = await call(finish, { code: pc, participantId: iv }, { 'x-launch-token': lt });
  eq(fin.body.reported, false, 'a standalone room reports nothing');

  console.log(`PASS session-check: ${n} assertions`);
})().catch(e => { console.error(e); process.exit(1); });
