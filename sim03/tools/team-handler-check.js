// Exercises real HTTP handlers with isolated storage; the scenario engine keeps
// its existing, separate regression suite. Snapshot reads model Redis rather
// than returning shared mutable objects that can hide lost-update bugs.
const assert = require('node:assert/strict');
const store = require('../lib/store.js');
const handler = require('../api/session.js');
const outcome = require('../api/outcome.js');
const finish = require('../api/finish.js');
const originalStore = { ...store };
const originalEnv = { FACULTY_CODE: process.env.FACULTY_CODE, FACULTY_CODES: process.env.FACULTY_CODES, LAUNCH_SECRET: process.env.LAUNCH_SECRET, ACCESS_CODE: process.env.ACCESS_CODE };
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const sessions = new Map(), participants = new Map(), runs = new Map();
let beforeCAS = null, assertions = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
store.configured = () => true;
store.getSession = async code => copy(sessions.get(code) || null);
store.putSession = async (code, value) => { sessions.set(code, copy(value)); return value; };
store.getParticipants = async code => copy(participants.get(code) || {});
store.getRuns = async code => copy(runs.get(code) || {});
store.setParticipant = async (code, id, value) => { participants.set(code, { ...(participants.get(code) || {}), [id]: copy(value) }); };
store.addParticipant = store.setParticipant;
require('./roster-fixture.js').installRosterTransactions(store, sessions, participants);
store.setRun = async (code, id, value) => { runs.set(code, { ...(runs.get(code) || {}), [id]: copy(value) }); };
store.compareAndSetRun = async (code, id, previous, next, session, roster) => {
  if (beforeCAS) { const hook = beforeCAS; beforeCAS = null; await hook(); }
  if (JSON.stringify(sessions.get(code)) !== JSON.stringify(session) ||
      JSON.stringify(participants.get(code) || {}) !== JSON.stringify(roster) ||
      JSON.stringify((runs.get(code) || {})[id] || null) !== JSON.stringify(previous)) return false;
  await store.setRun(code, id, next);
  return true;
};
async function invoke(body, endpoint = handler, headers = {}) {
  const req = { method: 'POST', headers, body };
  const res = { statusCode: 200, payload: null, status(n) { this.statusCode = n; return this; }, json(value) { this.payload = value; return this; }, end() { return this; } };
  await endpoint(req, res);
  return { status: res.statusCode, body: res.payload };
}
const faculty = { facultyCode: 'faculty-secret' };
const y1 = { run: 4, uptime: 2, capacity: 1, connect: 2, features: 0 };
const y2 = { run: 4, uptime: 1, capacity: 1, connect: 2, features: 1 };
let code;
const state = async id => (await invoke({ action: 'state', code, participantId: id })).body;
const submit = (id, patch, revision) => invoke({ action: 'submit', code, participantId: id, runnerRevision: revision, ...patch });
async function assign(lead, target) {
  const current = await state(lead);
  return invoke({ action: 'set_runner', code, participantId: lead, runnerId: target,
    expectedRunnerId: current.runnerId, runnerRevision: current.runnerRevision });
}
(async () => {
  try {
    process.env.FACULTY_CODE = 'faculty-secret'; delete process.env.FACULTY_CODES; delete process.env.LAUNCH_SECRET;
    let r = await invoke({ action: 'create', mode: 'team', name: 'Runner regression', ...faculty });
    check(r.status, 200); code = r.body.session.code;
    for (const id of ['ann', 'ben', 'cal', 'deb']) {
      r = await invoke({ action: 'join', code, participantId: id, name: id });
      check([r.status, r.body.me.groupId, r.body.me.isCaptain], [200, null, false]);
    }
    check((await invoke({ action: 'control', code, set: 'start', ...faculty })).body.error, 'unassigned_participants');
    check((await invoke({ action: 'group', code, assign: { ann: 'Alpha', ben: 'Alpha', cal: 'Alpha', deb: 'Beta' }, ...faculty })).status, 200);
    let s = await state('ann');
    check([s.canSubmit, s.canAssignRunner, s.runnerId, s.runnerRevision], [true, true, 'ann', 0]);
    check((await state('ben')).canSubmit, false);
    check((await assign('ben', 'ben')).status, 403, 'ordinary members cannot take control');
    check((await assign('ann', 'deb')).body.error, 'runner_must_be_teammate');
    check((await invoke({ action: 'claim_lead', code, participantId: 'ben' })).body.error, 'runner_assignment_required');
    check((await assign('ann', 'ben')).status, 200);
    s = await state('ann');
    check([s.me.isCaptain, s.canSubmit, s.runnerId, s.runnerRevision], [true, false, 'ben', 1], 'delegating must not change the lead');
    check([(await state('ben')).me.isCaptain, (await state('ben')).canSubmit], [false, true]);
    check((await invoke({ action: 'rename_team', code, groupId: 'team:alpha', teamLabel: 'Architecture A', ...faculty })).status, 200);
    check((await state('ben')).me.teamLabel, 'Architecture A');
    check((await invoke({ action: 'control', code, set: 'start', ...faculty })).status, 200);

    for (const patch of [{ strategicView: 'Not allowed' }, { year1: y1 }, { year2: y2 }, { screen: 1 }, { year2Event: 1 }]) {
      check((await submit('ann', patch, 1)).body.error, 'runner_only');
    }
    check((await submit('ben', { strategicView: 'Build a resilient service platform.' }, 0)).body.error, 'runner_changed');
    check((await submit('ben', { strategicView: 'Build a resilient service platform.' }, 1)).status, 200);
    check((await submit('ben', { year1: y1 }, 1)).status, 200);
    check((await submit('ben', { screen: 6 }, 1)).status, 200);
    check((await invoke({ sessionCode: code, participantId: 'ann', stage: 'year1' }, outcome)).body.error, 'runner_only');
    check((await invoke({ sessionCode: code, participantId: 'ben', stage: 'year1' }, outcome)).status, 200);
    check((await submit('ann', { done: true }, 1)).body.error, 'runner_only');
    check((await invoke({ sessionCode: code, participantId: 'ann', done: true }, finish)).body.error, 'runner_only');

    check((await assign('ann', 'cal')).status, 200, 'handoff is allowed during play');
    s = await state('cal');
    check([s.canSubmit, s.run.screen, s.run.year1, s.runnerRevision], [true, 6, y1, 2]);
    check((await submit('ben', { year2: y2 }, 1)).body.error, 'runner_only');
    check((await assign('ann', 'ben')).status, 200);
    check((await submit('ben', { year2: y2 }, 1)).body.error, 'runner_changed', 'an old request stays stale even when the same person regains control');

    // A handoff wins just before the old runner's Redis CAS. The old request
    // must reread authorization, not retry blindly with its previous permission.
    beforeCAS = async () => { check((await assign('ann', 'cal')).status, 200); };
    check((await submit('ben', { year2: y2 }, 3)).body.error, 'runner_only');
    check((await state('cal')).run.year2, null, 'handoff must not accept the previous runner\'s in-flight decision');
    s = await state('ann');
    const payload = { action: 'set_runner', code, participantId: 'ann', expectedRunnerId: s.runnerId, runnerRevision: s.runnerRevision };
    const concurrent = await Promise.all([invoke({ ...payload, runnerId: 'ben' }), invoke({ ...payload, runnerId: 'ann' })]);
    check(concurrent.map(x => x.status).sort(), [200, 409], 'two simultaneous assignments cannot both win');
    const current = await state('ann');
    const runner = current.runnerId, rev = current.runnerRevision;
    check((await submit(runner, { year2: y2 }, rev)).status, 200);
    check((await submit(runner, { year2Event: 1, screen: 8 }, rev)).status, 200);
    check((await state(runner)).run.screen, 8);
    check(Object.keys(runs.get(code)), ['team:alpha'], 'one shared run, not one run per member');
    check((await submit(runner, { year1: { ...y1, uptime: 1, capacity: 2 } }, rev)).body.error, 'year1_locked');

    check((await invoke({ action: 'control', code, set: 'pause', ...faculty })).status, 200);
    check((await submit(runner, { screen: 9 }, rev)).body.error, 'session_paused');
    check((await invoke({ action: 'control', code, set: 'resume', ...faculty })).status, 200);
    // Direct /finish goes through the same shared-run transaction.
    check((await invoke({ sessionCode: code, participantId: runner, runnerRevision: rev, reflection1: 'Runner one', reflection2: 'Runner two' }, finish)).status, 200);
    check((await state(runner)).run.done, true);
    const members = ['ann', 'ben', 'cal'].filter(id => id !== runner);
    check((await state(members[0])).run.done, true, 'runner completion finishes the shared run for teammates');
    check((await state(members[0])).run.reflection1, 'Runner one', 'teammates see the same submitted team summary');
    check((await invoke({ sessionCode: code, participantId: members[0], reflection1: `${members[0]} one`, reflection2: `${members[0]} two`, done: true }, finish)).status, 200, 'member completion endpoint is idempotent after runner submits');
    check(runs.get(code)['team:alpha'].done, true);
    check(Object.keys(runs.get(code)['team:alpha'].finishedBy).sort(), ['ann', 'ben', 'cal']);
    check((await assign('ann', 'cal')).body.error, 'run_already_completed');

    // Moving the selected student out of the team falls back to its lead. Team
    // names, allocations and faculty lead selection remain instructor-managed.
    runs.set(code, { 'team:alpha': { runId: 'team:alpha', runnerId: 'ben', runnerRevision: 1, phase: 0 } });
    check((await invoke({ action: 'group', code, assign: { ben: '__unassigned__' }, ...faculty })).status, 200);
    check((await state('ann')).runnerId, 'ann');
    check((await state('ben')).canSubmit, false);
    check((await invoke({ action: 'control', code, set: 'close', ...faculty })).status, 200);
    check((await assign('ann', 'cal')).body.error, 'session_closed');

    for (const endpoint of [outcome, finish]) {
      check((await invoke({ sessionCode: code, year1: y1, year2: y2 }, endpoint)).body.error, 'session_identity_required', 'partial session identity must not fall back to standalone');
    }
    process.env.ACCESS_CODE = 'standalone-test';
    for (const endpoint of [outcome, finish]) {
      check((await invoke({ participantId: 'remembered-student', stage: 'year1', year1: y1, year2: y2 }, endpoint, { 'x-access-code': 'standalone-test' })).status, 200, 'remembered participant identity must not break a standalone launch');
    }
    const individual = await invoke({ action: 'create', mode: 'individual', ...faculty });
    code = individual.body.session.code;
    await invoke({ action: 'join', code, participantId: 'solo', name: 'Solo' });
    await invoke({ action: 'control', code, set: 'start', ...faculty });
    check((await submit('solo', { year1: y1, year2: y2, reflection1: 'Solo response', done: true })).status, 200);
    check((await invoke({ sessionCode: code, participantId: 'solo', reflection1: 'Solo response' }, finish)).status, 200, 'completion report after saved individual completion is idempotent');
    check((await state('solo')).run.reflection1, 'Solo response');
    check((await submit('solo', { year1: y2 })).body.error, 'run_already_completed');
    console.log(`RapidSim 03 team runner handler checks passed (${assertions} assertions).`);
  } finally {
    Object.assign(store, originalStore);
    for (const [key, value] of Object.entries(originalEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
