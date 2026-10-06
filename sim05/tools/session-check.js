#!/usr/bin/env node
// Exercises the real /api/session and /api/finish handlers against an in-memory
// store that honours the same compare-and-set contract as the Redis scripts.
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const store = require('../lib/store.js');
const C = require('../config/content.js');

process.env.LAUNCH_SECRET = 'test-secret-not-real';
process.env.FACULTY_CODES = 'Tester:fac-code';
delete process.env.ACCESS_CODE;
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
const leaks = (obj, text, m) => ok(!JSON.stringify(obj).includes(text), m);

(async () => {
  // Authorisation and required choices.
  eq((await api({ action: 'create', mode: 'individual' })).status, 401, 'anonymous create refused');
  eq((await api({ action: 'create' }, fac)).status, 400, 'mode has no default');
  eq((await api({ action: 'create', mode: 'individual', intensity: 'extreme' }, fac)).status, 400, 'unknown intensity refused');
  eq((await api({ action: 'create', mode: 'individual' }, { 'x-launch-token': token({ sub: 's1' }) })).status, 401, 'student token cannot create');

  // Individual room.
  const created = await api({ action: 'create', mode: 'individual' }, fac);
  eq(created.status, 200, 'faculty create');
  const code = created.body.session.code;
  const j1 = await api({ action: 'join', code, name: 'Ana' });
  const j2 = await api({ action: 'join', code, name: 'Ben' });
  const a = j1.body.participantId, bn = j2.body.participantId;
  let s = await api({ action: 'state', code, participantId: a });
  eq(s.body.view.clock.phase, 'lobby', 'lobby before start');
  eq(s.body.view.rounds.length, 0, 'no rounds before start');
  eq((await api({ action: 'control', code, set: 'start' })).status, 401, 'student cannot start');
  eq((await api({ action: 'control', code, set: 'start' }, fac)).status, 200, 'faculty start');

  s = await api({ action: 'state', code, participantId: a });
  eq(s.body.view.clock.phase, 'briefing', 'briefing first');
  eq(s.body.view.rounds.length, 0, 'no round content during briefing');
  eq((await api({ action: 'vote', code, participantId: a, round: 1, decision: 'approve' })).status, 409, 'no voting in briefing');

  advance(60);
  s = await api({ action: 'state', code, participantId: a });
  eq(s.body.view.clock, { phase: 'decide', round: 1, remaining: 180, closedRounds: 0, openedRounds: 1, paused: false }, 'round 1 open');
  eq(s.body.view.rounds.length, 1, 'only round 1 sent');
  for (const r of C.ROUNDS.slice(1)) leaks(s.body, r.title, `round ${r.n} title not leaked early`);
  for (const inf of C.INFERENCES) for (const l of inf.levels) leaks(s.body, l.text, 'no reveal text before the round closes');
  ok(s.body.view.canVote, 'can vote');

  eq((await api({ action: 'vote', code, participantId: a, round: 1, decision: 'maybe' })).status, 400, 'invalid decision');
  eq((await api({ action: 'vote', code, participantId: a, round: 2, decision: 'approve' })).status, 409, 'future round refused');
  const v = await api({ action: 'vote', code, participantId: a, round: 1, decision: 'decline' });
  eq(v.status, 200, 'vote recorded');
  eq(v.body.view.rounds[0].result, undefined, 'no result until the round closes');
  eq((await api({ action: 'vote', code, participantId: a, round: 1, decision: 'approve' })).status, 409, 'votes are final');

  let f = await api({ action: 'faculty_state', code }, fac);
  eq(f.body.projector.live, { round: 1, decided: 1, of: 2 }, 'projector shows how many decided');
  leaks(f.body.projector, '"approve":1', 'projector never shows the split during a decision window');
  eq(f.body.projector.rounds, [], 'no round bars before close');

  // Pause freezes the clock and blocks votes.
  eq((await api({ action: 'control', code, set: 'pause' }, fac)).status, 200, 'pause');
  advance(600);
  s = await api({ action: 'state', code, participantId: bn });
  eq(s.body.view.clock.remaining, 180, 'clock frozen while paused');
  eq((await api({ action: 'vote', code, participantId: bn, round: 1, decision: 'approve' })).status, 409, 'no votes while paused');
  eq((await api({ action: 'control', code, set: 'resume' }, fac)).status, 200, 'resume');
  s = await api({ action: 'state', code, participantId: bn });
  eq(s.body.view.clock.remaining, 180, 'resume picks up where it stopped');

  // Ben never votes: his round 1 is a timeout, and it ships.
  advance(180);
  s = await api({ action: 'state', code, participantId: bn });
  eq(s.body.view.clock.phase, 'reveal', 'reveal after the window');
  eq(s.body.view.rounds[0].result.decision, 'timeout', 'silence is a timeout');
  ok(s.body.view.rounds[0].result.picture.some(p => p.id === 'routine'), 'a timeout ships the data');
  const sa = await api({ action: 'state', code, participantId: a });
  eq(sa.body.view.rounds[0].result.cost, C.ROUNDS[0].cost, 'decline shows its cost line');
  eq(sa.body.view.rounds[0].result.picture, [], 'decline shows the unchanged picture');
  leaks(sa.body, 'Ben', 'a student never sees another student');
  f = await api({ action: 'faculty_state', code }, fac);
  eq(f.body.projector.rounds[0].timeout, 1, 'timeout counted separately');
  eq(f.body.projector.rounds[0].decline, 1, 'decline counted');
  eq(f.body.projector.rounds[0].approve, 0, 'timeouts never merge into approvals');

  // A late joiner plays but stays out of the totals.
  const late = await api({ action: 'join', code, name: 'Cai' });
  f = await api({ action: 'faculty_state', code }, fac);
  eq(f.body.projector.late, 1, 'late joiner flagged');
  eq(f.body.projector.rounds[0].approve + f.body.projector.rounds[0].decline + f.body.projector.rounds[0].timeout, 2, 'late joiner not in totals');

  // Play out rounds 2 to 5: Ana approves everything left, Ben declines everything.
  advance(60);
  for (let r = 2; r <= 5; r++) {
    eq((await api({ action: 'vote', code, participantId: a, round: r, decision: 'approve' })).status, 200, `Ana round ${r}`);
    eq((await api({ action: 'vote', code, participantId: bn, round: r, decision: 'decline' })).status, 200, `Ben round ${r}`);
    advance(240);
  }
  const endA = (await api({ action: 'state', code, participantId: a })).body.view;
  eq(endA.clock.phase, 'ending', 'ending reached');
  ok(endA.ending.knows.some(k => k.id === 'health' && k.level === 'moderate'), 'Ana declined round 1 only: moderate estimate via sleep and grocery');
  eq(endA.ending.missing, [C.ROUNDS[0].missing], 'Ana missing column');
  const endB = (await api({ action: 'state', code, participantId: bn })).body.view;
  eq(endB.ending.knows.map(k => k.id), ['routine'], 'Ben: only the timeout shipped');
  f = await api({ action: 'faculty_state', code }, fac);
  eq(f.body.projector.headline, "1 of 2 students ended with Loopwell estimating a change in Dana's health. Of those, 1 declined at least one request.", 'projector headline');
  ok(f.body.projector.endings.length === 6, 'six ending groups on the projector');
  ok(late.status === 200, 'late join accepted');

  // Finish: only platform launches report, once.
  eq((await call(finish, { code, participantId: a })).body.reported, false, 'standalone runs are not reported');

  // Team room: private votes, majority, tie ships, teams fixed at start.
  const tc = (await api({ action: 'create', mode: 'team', intensity: 'lighter' }, fac)).body.session.code;
  const ids = [];
  for (const name of ['P1', 'P2', 'P3', 'P4']) ids.push((await api({ action: 'join', code: tc, name })).body.participantId);
  eq((await api({ action: 'control', code: tc, set: 'start' }, fac)).status, 409, 'cannot start with unassigned students');
  eq((await api({ action: 'group', code: tc, assign: Object.fromEntries(ids.map(i => [i, 'Red'])) }, fac)).status, 200, 'assign team');
  eq((await api({ action: 'control', code: tc, set: 'start' }, fac)).status, 200, 'team start');
  eq((await api({ action: 'group', code: tc, assign: { [ids[0]]: 'Blue' } }, fac)).status, 409, 'teams fixed after start');
  eq((await api({ action: 'join', code: tc, name: 'P5' })).status, 409, 'no new members after a team session starts');
  advance(60);
  await api({ action: 'vote', code: tc, participantId: ids[0], round: 1, decision: 'approve' });
  await api({ action: 'vote', code: tc, participantId: ids[1], round: 1, decision: 'approve' });
  await api({ action: 'vote', code: tc, participantId: ids[2], round: 1, decision: 'decline' });
  await api({ action: 'vote', code: tc, participantId: ids[3], round: 1, decision: 'decline' });
  const t3 = (await api({ action: 'state', code: tc, participantId: ids[2] })).body;
  eq(t3.view.rounds[0].result.decision, 'approve', 'a tie ships');
  eq(t3.view.rounds[0].myVote, 'decline', 'student sees their own vote beside the team result');
  leaks(t3, 'P1', 'team members never see each other');
  leaks(t3, '"split"', 'students never see whether the team split');
  f = await api({ action: 'faculty_state', code: tc }, fac);
  eq(f.body.projector.rounds[0].splitTeams, 1, 'projector counts split teams');
  eq(f.body.projector.debrief.teamPrompt, C.DEBRIEF.teamPrompt, 'team debrief prompt');
  advance(60 + 4 * 240);
  const tEnd = (await api({ action: 'state', code: tc, participantId: ids[0] })).body;
  ok(!/pregnan/i.test(JSON.stringify(tEnd)), 'lighter session never names pregnancy');
  const tHead = (await api({ action: 'faculty_state', code: tc }, fac)).body.projector.headline;
  ok(/change in Dana's health/.test(tHead) && !/pregnan/i.test(tHead), 'lighter headline');

  // Solo runs from a direct launch.
  eq((await api({ action: 'solo' })).status, 503, 'standalone solo closed without an access code');
  const solo = await api({ action: 'solo' }, { 'x-launch-token': token({ sub: 'u9', name: 'Dee' }) });
  eq(solo.status, 200, 'solo run from a launch');
  const u9 = { 'x-launch-token': token({ sub: 'u9' }) };
  eq((await api({ action: 'state', code: solo.body.code, participantId: solo.body.participantId }, u9)).body.view.clock.phase, 'lobby', 'solo waits for the walkthrough');
  eq((await api({ action: 'solo_start', code: solo.body.code, participantId: solo.body.participantId }, u9)).status, 200, 'student starts their own clock');
  eq((await api({ action: 'state', code: solo.body.code, participantId: solo.body.participantId }, u9)).body.view.clock.phase, 'briefing', 'solo recap after start');
  eq((await api({ action: 'solo_start', code: solo.body.code, participantId: solo.body.participantId }, u9)).status, 409, 'cannot start twice');
  eq((await api({ action: 'state', code: solo.body.code, participantId: solo.body.participantId }, { 'x-launch-token': token({ sub: 'other' }) })).status, 403, 'another account cannot read a solo run');
  ok([401, 403].includes((await api({ action: 'join', code: solo.body.code, name: 'Eve' })).status), 'nobody joins a solo run');
  eq((await api({ action: 'solo' }, { 'x-launch-token': token({ sub: 'u9', mode: 'session' }) })).status, 409, 'session launches use the session');
  eq((await api({ action: 'solo' }, { 'x-launch-token': token({ sub: 'u9', sim: 'rapid-03-midland' }) })).status, 403, 'another sim token refused');

  const soloTok = { 'x-launch-token': token({ sub: 'u9' }) };
  eq((await call(finish, { code: solo.body.code, participantId: solo.body.participantId }, soloTok)).status, 409, 'cannot finish before the ending');
  advance(60 + 5 * 240);
  process.env.PLATFORM_URL = 'https://platform.test';
  let callbackOk = false, callbacks = 0;
  global.fetch = async url => {
    if (url.endsWith('/api/complete')) { callbacks++; return { ok: callbackOk, status: callbackOk ? 200 : 503, json: async () => ({}) }; }
    return { ok: true };
  };
  const fin = await call(finish, { code: solo.body.code, participantId: solo.body.participantId }, soloTok);
  eq(fin.status, 200, 'finish at the ending');
  eq(fin.body.reported, false, 'failed callback stays unreported');
  callbackOk = true;
  eq((await call(finish, { code: solo.body.code, participantId: solo.body.participantId }, soloTok)).body.reported, true, 'failed callback retries successfully');
  eq((await call(finish, { code: solo.body.code, participantId: solo.body.participantId }, soloTok)).body.already, true, 'reported once only');
  eq(callbacks, 2, 'one failed attempt and one successful callback');

  const config = require('../api/config.js');
  const guestRoom = (await api({ action: 'create', mode: 'individual' }, fac)).body.session.code;
  eq((await call(config, { session: guestRoom })).status, 200, 'faculty code session link bypasses standalone gate');
  eq((await call(config, { session: 'ZZZZZ' })).status, 404, 'invalid room cannot bypass gate');
  const pf = { 'x-launch-token': token({ sub: 'faculty1', role: 'faculty', mode: 'session', course: 'class1' }) };
  const ps = { 'x-launch-token': token({ sub: 'student1', course: 'class1' }) };
  const classRoom = (await api({ action: 'create', mode: 'individual' }, pf)).body.session.code;
  eq((await call(config, { session: classRoom })).body.error, 'platform_signin_required', 'account session still requires signed account');
  eq((await call(config, { session: classRoom }, ps)).status, 200, 'signed class link needs no access code');
  const joined = await api({ action: 'join', code: classRoom }, ps);
  eq(joined.body.participantId, 'platform:student1', 'class link binds the student account');
  await api({ action: 'control', code: classRoom, set: 'start' }, pf);
  advance(60 + 5 * 240);
  eq((await call(finish, { code: classRoom, participantId: joined.body.participantId }, ps)).body.reported, true, 'class result reaches platform');
  eq((await api({ action: 'faculty_state', code: classRoom }, pf)).body.roster.length, 1, 'faculty sees the session participant');

  process.env.ACCESS_CODE = 'standalone-test';
  eq((await api({ action: 'solo', name: 'Guest' })).status, 401, 'direct solo requires access code');
  const direct = await api({ action: 'solo', name: 'Guest' }, { 'x-access-code': 'standalone-test' });
  eq(direct.status, 200, 'access code alone starts solo');
  eq((await call(config, { session: direct.body.code })).status, 403, 'private solo code cannot become class invitation');
  advance(60 + 5 * 240);
  const before = callbacks;
  eq((await call(finish, { code: direct.body.code, participantId: direct.body.participantId }, ps)).body.reason, 'standalone', 'standalone cannot be attached to faculty by adding a token');
  eq(callbacks, before, 'standalone never sends faculty completion');

  delete process.env.ACCESS_CODE;
  // Ready flags, early close and the instructor's advance.
  const ec = (await api({ action: 'create', mode: 'individual' }, fac)).body.session.code;
  const e1 = (await api({ action: 'join', code: ec, name: 'Uma' })).body.participantId;
  const e2 = (await api({ action: 'join', code: ec, name: 'Vic' })).body.participantId;
  eq((await api({ action: 'ready', code: ec, participantId: e1 })).status, 200, 'ready recorded');
  eq((await api({ action: 'faculty_state', code: ec }, fac)).body.projector.ready, 1, 'instructor sees who finished the walkthrough');
  eq((await api({ action: 'skip', code: ec, participantId: e1 })).status, 403, 'students cannot move a class clock');
  await api({ action: 'control', code: ec, set: 'start' }, fac);
  advance(60);
  await api({ action: 'vote', code: ec, participantId: e1, round: 1, decision: 'approve' });
  eq((await api({ action: 'state', code: ec, participantId: e1 })).body.view.clock.phase, 'decide', 'round stays open while someone is deciding');
  await api({ action: 'vote', code: ec, participantId: e2, round: 1, decision: 'decline' });
  let ev = (await api({ action: 'state', code: ec, participantId: e2 })).body.view;
  eq([ev.clock.phase, ev.clock.round, ev.clock.remaining], ['reveal', 1, 60], 'round closes early once everyone has decided');
  eq((await api({ action: 'control', code: ec, set: 'advance' }, fac)).status, 200, 'instructor opens the next round now');
  eq((await api({ action: 'state', code: ec, participantId: e1 })).body.view.clock.round, 2, 'round 2 open');
  await api({ action: 'vote', code: ec, participantId: e1, round: 2, decision: 'approve' });
  eq((await api({ action: 'control', code: ec, set: 'advance' }, fac)).status, 200, 'instructor closes the round now');
  ev = (await api({ action: 'state', code: ec, participantId: e2 })).body.view;
  eq(ev.rounds[1].result.decision, 'timeout', 'closing early makes an undecided vote a timeout');
  eq((await api({ action: 'control', code: ec, set: 'advance' })).status, 401, 'only faculty can advance');

  // Solo skip: never past an undecided round.
  const sk = (await api({ action: 'solo', name: 'Wren' }, { 'x-launch-token': token({ sub: 'w1' }) })).body;
  const w1 = { 'x-launch-token': token({ sub: 'w1' }) };
  await api({ action: 'solo_start', code: sk.code, participantId: sk.participantId }, w1);
  eq((await api({ action: 'skip', code: sk.code, participantId: sk.participantId }, w1)).body.view.clock.phase, 'decide', 'skip the recap');
  eq((await api({ action: 'skip', code: sk.code, participantId: sk.participantId }, w1)).status, 409, 'cannot skip a round before deciding');
  const sv = await api({ action: 'vote', code: sk.code, participantId: sk.participantId, round: 1, decision: 'approve' }, w1);
  eq(sv.body.view.clock.phase, 'reveal', 'solo result shows as soon as the student decides');
  eq((await api({ action: 'skip', code: sk.code, participantId: sk.participantId }, w1)).body.view.clock.round, 2, 'skip to the next round');
  eq((await api({ action: 'solo_start', code: sk.code, participantId: sk.participantId }, { 'x-launch-token': token({ sub: 'intruder' }) })).status, 403, 'another account cannot drive a solo run');

  // Course students imported ahead of time, who never arrive, are not team members.
  const jc = (await api({ action: 'create', mode: 'team' }, fac)).body.session.code;
  const here = (await api({ action: 'join', code: jc, name: 'Here' })).body.participantId;
  await store.addParticipant(jc, 'platform:absent', { id: 'platform:absent', name: 'Absent', groupId: null, teamLabel: '', joinedAt: null, votes: {} });
  await api({ action: 'group', code: jc, assign: { [here]: 'Red', 'platform:absent': 'Red' } }, fac);
  eq((await api({ action: 'control', code: jc, set: 'start' }, fac)).status, 200, 'start with an absent imported student');
  eq(sessions.get(jc).teams['team:red'], [here], 'only students who joined are frozen into the team');
  advance(60);
  await api({ action: 'vote', code: jc, participantId: here, round: 1, decision: 'decline' });
  const jv = (await api({ action: 'state', code: jc, participantId: here })).body.view;
  eq(jv.rounds[0].result.decision, 'decline', 'an absent student cannot outvote the team by silence');

  // Team names, rename in the lobby only, instructor progress, view-as-team, preview.
  const tn = (await api({ action: 'create', mode: 'team' }, fac)).body.session.code;
  const m = [];
  for (const nm of ['M1', 'M2', 'M3', 'M4']) m.push((await api({ action: 'join', code: tn, name: nm })).body.participantId);
  await api({ action: 'group', code: tn, assign: { [m[0]]: 'Team 1', [m[1]]: 'Team 1', [m[2]]: 'Team 2', [m[3]]: 'Team 2' } }, fac);
  let tv = (await api({ action: 'state', code: tn, participantId: m[0] })).body.view;
  eq(tv.team.label, 'Team 1', 'default team name');
  ok(tv.team.canRename, 'rename allowed in the lobby');
  eq((await api({ action: 'rename_team', code: tn, participantId: m[0], label: '  The   Rockets ' })).status, 200, 'student renames team');
  eq((await api({ action: 'state', code: tn, participantId: m[1] })).body.view.team.label, 'The Rockets', 'teammate sees the new name');
  eq((await api({ action: 'state', code: tn, participantId: m[2] })).body.view.team.label, 'Team 2', 'other team unaffected');
  eq((await api({ action: 'team_label', code: tn, groupId: 'team:team-1' })).status, 401, 'only faculty reset names');
  eq((await api({ action: 'team_label', code: tn, groupId: 'team:team-1' }, fac)).status, 200, 'faculty resets a name');
  eq((await api({ action: 'state', code: tn, participantId: m[1] })).body.view.team.label, 'Team 1', 'name back to default');
  await api({ action: 'rename_team', code: tn, participantId: m[0], label: 'Rockets' });
  await api({ action: 'control', code: tn, set: 'start' }, fac);
  eq((await api({ action: 'rename_team', code: tn, participantId: m[0], label: 'Later' })).status, 409, 'no renaming after start');
  advance(60);
  await api({ action: 'vote', code: tn, participantId: m[0], round: 1, decision: 'approve' });
  await api({ action: 'vote', code: tn, participantId: m[1], round: 1, decision: 'decline' });
  let fs = (await api({ action: 'faculty_state', code: tn }, fac)).body.projector.progress;
  const rockets = fs.teams.find(t => t.label === 'Rockets');
  eq(rockets.members.map(x => x.decided), [true, true], 'ticks show who has decided');
  leaks(fs, 'approve"', 'no vote direction while a round is open');
  eq(rockets.tallies, [], 'no tallies before the round closes');
  await api({ action: 'control', code: tn, set: 'advance' }, fac);
  fs = (await api({ action: 'faculty_state', code: tn }, fac)).body.projector.progress;
  eq(fs.teams.find(t => t.label === 'Rockets').tallies[0], { round: 1, approve: 1, decline: 1, missing: 0, decision: 'approve' }, 'tally after close: tie ships');
  leaks(fs.teams.map(t => t.tallies), 'M1', 'tallies never name voters');
  ok(fs.teams.every(t => t.members.every(x => !('vote' in x) && !('votes' in x))), 'members carry ticks, never votes');
  const view = (await api({ action: 'team_view', code: tn, groupId: rockets.groupId }, fac)).body.view;
  eq(view.rounds[0].result.decision, 'approve', 'view-as-team shows the team result');
  leaks(view, 'myVote', 'view-as-team never shows a member vote');
  ok(!view.canVote, 'view-as-team is read-only');
  eq((await api({ action: 'team_view', code: tn, groupId: rockets.groupId })).status, 401, 'students cannot view a team');
  const pv = (await api({ action: 'preview', code: tn }, fac)).body;
  eq(pv.round.n, 1, 'preview shows the current round');
  ok(pv.round.app && !pv.round.result, 'preview carries content, no results');
  const ind = (await api({ action: 'faculty_state', code: ec }, fac)).body.projector.progress;
  ok(Array.isArray(ind.students) && !('tallies' in ind), 'individual mode: ticks only, no tallies');
  eq((await api({ action: 'team_view', code: ec, groupId: 'team:x' }, fac)).status, 409, 'no view-as-student in individual mode');

  console.log(`PASS session-check: ${n} assertions`);
})().catch(e => { console.error(e); process.exit(1); });
