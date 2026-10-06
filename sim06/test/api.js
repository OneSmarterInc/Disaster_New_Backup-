'use strict';
// Exercises api/session.js end to end: auth, mode rule, room clock, first-press-wins,
// no leakage to students, reveal gating, completion reporting, projector privacy.
const assert = require('assert');
const path = require('path');

process.env.LAUNCH_SECRET = 'test-secret';
process.env.FACULTY_CODES = 'Tester:fac123,Other:fac999';
process.env.KV_REST_API_URL = 'memory';
process.env.KV_REST_API_TOKEN = 'memory';
delete process.env.PLATFORM_URL;
process.env.SIM_URL = 'https://example.test/sim06';

// In-memory store: same interface, same compare-by-serialised-value semantics as the Lua.
const db = { sess: {}, p: {}, run: {} };
const S = v => (v == null ? '' : JSON.stringify(v));
const mem = {
  configured: () => true,
  async getSession(c) { return db.sess[c] ? JSON.parse(db.sess[c]) : null; },
  async putSession(c, o) { db.sess[c] = JSON.stringify(o); return o; },
  async compareAndSetSession(c, prev, next) { if ((db.sess[c] || '') !== S(prev)) return false; db.sess[c] = S(next); return true; },
  async getParticipants(c) { return Object.fromEntries(Object.entries(db.p[c] || {}).map(([k, v]) => [k, JSON.parse(v)])); },
  async compareAndSetParticipant(c, id, prev, next) {
    if (!db.sess[c]) return false; db.p[c] ||= {};
    if ((db.p[c][id] || '') !== S(prev)) return false; db.p[c][id] = S(next); return true;
  },
  async getParticipant(c, id) { const v = (db.p[c] || {})[id]; return v ? JSON.parse(v) : null; },
  async getRun(c, id) { const v = (db.run[c] || {})[id]; return v ? JSON.parse(v) : null; },
  async getRuns(c) { return Object.fromEntries(Object.entries(db.run[c] || {}).map(([k, v]) => [k, JSON.parse(v)])); },
  async compareAndSetRun(c, id, prev, next) {
    if (!db.sess[c]) return false; db.run[c] ||= {};
    if ((db.run[c][id] || '') !== S(prev)) return false; db.run[c][id] = S(next); return true;
  },
};
require.cache[path.resolve(__dirname, '../lib/store.js')] = { id: 'store', filename: 'store', loaded: true, exports: mem };

// Capture completion reports instead of posting them.
const launchMod = require('../lib/launch.js');
const reports = [];
let reportOk = true;
launchMod.reportCompletion = async x => { reports.push(x); return { ok: reportOk }; };

const handler = require('../api/session.js');
const cfgHandler = require('../api/config.js');
const cfg = require('../data/config.js');
let clock = 5_000_000;
handler._now = () => clock;

function call(h, bodyObj, headers = {}) {
  return new Promise(resolve => {
    const res = { code: 200, headers: {}, status(n) { this.code = n; return this; }, setHeader(k, v) { this.headers[k] = v; },
      json(v) { resolve({ status: this.code, body: v }); return this; }, end() { resolve({ status: this.code, body: null }); return this; } };
    h({ method: 'POST', headers, body: bodyObj }, res);
  });
}
const post = (b, h) => call(handler, b, h);
const tok = (payload) => launchMod.signBack({ exp: Date.now() + 3600e3, iat: Date.now(), ...payload });

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; } catch (e) { fail++; console.error(`FAIL ${name}\n  ${e.stack.split('\n').slice(0, 3).join('\n  ')}`); } }

(async () => {
  let code;
  await t('peek tells the join screen the mode and nothing else', async () => {
    const c = (await post({ action: 'create', mode: 'team', facultyCode: 'fac123' })).body.session.code;
    const r = await post({ action: 'peek', code: c });
    assert.deepStrictEqual(Object.keys(r.body).sort(), ['closed', 'mode', 'phase']);
    assert.strictEqual(r.body.mode, 'team');
    assert.strictEqual((await post({ action: 'peek', code: 'bad' })).status, 400);
  });
  await t('create needs faculty', async () => {
    const r = await post({ action: 'create', mode: 'individual' });
    assert.strictEqual(r.status, 401);
  });
  await t('create needs a mode', async () => {
    const r = await post({ action: 'create', facultyCode: 'fac123' });
    assert.strictEqual(r.body.error, 'play_mode_required');
  });
  await t('create individual', async () => {
    const r = await post({ action: 'create', mode: 'individual', facultyCode: 'fac123' });
    assert.strictEqual(r.status, 200); code = r.body.session.code;
  });

  let a, b2;
  await t('students join and see the lobby with no reports', async () => {
    a = (await post({ action: 'join', code, name: 'Ana' })).body.participantId;
    b2 = (await post({ action: 'join', code, name: 'Ben' })).body.participantId;
    const s = await post({ action: 'state', code, participantId: a });
    assert.strictEqual(s.body.session.phase, 'lobby');
    assert.deepStrictEqual(s.body.view.reports, []);
  });
  await t('no decision before the clock starts', async () => {
    const r = await post({ action: 'decide', code, participantId: a, choice: 'switch', reason: 'x' });
    assert.strictEqual(r.status, 400);
  });
  await t('document opened in the lobby is recorded', async () => {
    clock += 1000;
    assert.strictEqual((await post({ action: 'open_doc', code, participantId: a, docId: 'northline' })).status, 200);
    assert.strictEqual((await post({ action: 'open_doc', code, participantId: a, docId: 'nope' })).status, 400);
  });
  await t('instructor starts the room clock', async () => {
    clock += 1000;
    const r = await post({ action: 'control', code, set: 'start', facultyCode: 'fac123' });
    assert.strictEqual(r.body.session.phase, 'playing');
    const again = await post({ action: 'control', code, set: 'start', facultyCode: 'fac123' });
    assert.strictEqual(again.status, 409);
  });
  await t('everyone sees the same report at the same moment', async () => {
    clock += 50_000;
    const x = await post({ action: 'state', code, participantId: a });
    const y = await post({ action: 'state', code, participantId: b2 });
    assert.strictEqual(x.body.view.reports.length, 2);
    assert.deepStrictEqual(x.body.view.reports, y.body.view.reports);
  });
  await t('student state never carries reveal content', async () => {
    const s = JSON.stringify((await post({ action: 'state', code, participantId: a })).body);
    assert.ok(!s.includes('Route 4 exchange') && !s.includes('12:40') && !s.includes(cfg.reveal.caption));
  });
  await t('reveal locked during play', async () => {
    assert.strictEqual((await post({ action: 'reveal', code, participantId: a })).status, 409);
  });
  await t('decide once, never twice', async () => {
    clock += 5000;
    const r = await post({ action: 'decide', code, participantId: a, choice: 'stay', reason: 'Meridian is in both documents' });
    assert.strictEqual(r.body.decision.choice, 'stay');
    const r2 = await post({ action: 'decide', code, participantId: a, choice: 'switch', reason: 'changed my mind' });
    assert.strictEqual(r2.status, 409);
  });
  await t('projector during play: aggregates, no names, no reasons', async () => {
    const r = await post({ action: 'faculty_state', code, facultyCode: 'fac123' });
    assert.strictEqual(r.body.projector.counts.stayed, 1);
    assert.strictEqual(r.body.projector.counts.stillDeciding, 1);
    assert.strictEqual(r.body.debrief, null, 'debrief prompts stay hidden until the clock ends');
    const s = JSON.stringify(r.body);
    assert.ok(!s.includes('Ana') && !s.includes('Meridian is in both') && !s.includes(a));
  });
  await t('another faculty member cannot see or control this session', async () => {
    assert.strictEqual((await post({ action: 'faculty_state', code, facultyCode: 'fac999' })).status, 403);
    assert.strictEqual((await post({ action: 'control', code, set: 'close', facultyCode: 'fac999' })).status, 403);
    const fac2 = tok({ sub: 'u-other', role: 'faculty', sim: cfg.sim.id, course: 'c9', mode: 'session' });
    assert.strictEqual((await post({ action: 'faculty_state', code, launchToken: fac2 })).status, 403);
  });
  await t('someone else cannot read the projector', async () => {
    const r = await post({ action: 'faculty_state', code, facultyCode: 'wrong' });
    assert.strictEqual(r.status, 401);
  });
  await t('a platform faculty account cannot claim a standalone room by display name', async () => {
    const sameName = tok({ sub: 'u-tester', name: 'Tester', role: 'faculty', sim: cfg.sim.id, mode: 'session' });
    assert.strictEqual((await post({ action: 'faculty_state', code, launchToken: sameName })).status, 403);
    assert.strictEqual((await post({ action: 'control', code, set: 'close', launchToken: sameName })).status, 403);
    assert.strictEqual((await post({ action: 'faculty_state', code, facultyCode: 'fac123' })).status, 200);
  });
  await t('a standalone room without an owner cannot be read or controlled', async () => {
    const c = (await post({ action: 'create', mode: 'individual', facultyCode: 'fac123' })).body.session.code;
    const sess = await mem.getSession(c);
    await mem.putSession(c, { ...sess, owner: null });
    for (const facultyCode of ['fac123', 'fac999']) {
      assert.strictEqual((await post({ action: 'faculty_state', code: c, facultyCode })).status, 403);
      assert.strictEqual((await post({ action: 'control', code: c, set: 'start', facultyCode })).status, 403);
    }
  });
  await t('legacy platform ownership requires a matching platform account and course', async () => {
    const fac = tok({ sub: 'legacy-owner', name: 'Tester', role: 'faculty', sim: cfg.sim.id, course: 'legacy-course', mode: 'session' });
    const c = (await post({ action: 'create', mode: 'individual', launchToken: fac })).body.session.code;
    const sess = await mem.getSession(c);
    await mem.putSession(c, { ...sess, ownerId: null });
    assert.strictEqual((await post({ action: 'faculty_state', code: c, launchToken: fac })).status, 200);
    assert.strictEqual((await post({ action: 'faculty_state', code: c, facultyCode: 'fac123' })).status, 403);
    for (const p of [{ name: 'Other', course: 'legacy-course' }, { name: 'Tester', course: 'wrong-course' }]) {
      const other = tok({ sub: 'another-owner', role: 'faculty', sim: cfg.sim.id, mode: 'session', ...p });
      assert.strictEqual((await post({ action: 'control', code: c, set: 'start', launchToken: other })).status, 403);
    }
    await mem.putSession(c, { ...sess, ownerId: null, owner: null });
    assert.strictEqual((await post({ action: 'faculty_state', code: c, launchToken: fac })).status, 403);
    assert.strictEqual((await post({ action: 'control', code: c, set: 'start', launchToken: fac })).status, 403);
  });
  await t('after the clock: reveal, no decision recorded for the undecided', async () => {
    clock += 700_000;
    const ra = await post({ action: 'reveal', code, participantId: a });
    assert.ok(ra.body.reveal.decisionLine.includes('committed to staying on Northline at report 2'));
    assert.strictEqual(ra.body.reveal.reading.northline, true);
    const rb = await post({ action: 'reveal', code, participantId: b2 });
    assert.strictEqual(rb.body.reveal.decisionLine, cfg.reveal.decisionLines.none);
    const late = await post({ action: 'decide', code, participantId: b2, choice: 'switch', reason: 'late' });
    assert.strictEqual(late.status, 400);
    const fs = (await post({ action: 'faculty_state', code, facultyCode: 'fac123' })).body;
    assert.deepStrictEqual(fs.projector.counts, { switched: 0, stayed: 1, noDecision: 1, stillDeciding: 0 });
    assert.strictEqual(fs.debrief[0].step, 'Disagreement');
  });

  await t('a returning student gets back in after the session is closed', async () => {
    await post({ action: 'control', code, set: 'close', facultyCode: 'fac123' });
    const r = await post({ action: 'join', code, name: 'Ana', participantId: a });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.participantId, a);
    assert.strictEqual((await call(cfgHandler, { session: code, participantId: a })).status, 200);
    assert.strictEqual((await call(cfgHandler, { session: code })).status, 410);
    assert.strictEqual((await call(cfgHandler, { session: code, participantId: 'not-joined' })).status, 410);
    const n = await post({ action: 'join', code, name: 'Newcomer' });
    assert.strictEqual(n.body.error, 'session_closed');
  });
  await t('nobody new joins after the clock ends', async () => {
    const c2 = (await post({ action: 'create', mode: 'individual', facultyCode: 'fac123' })).body.session.code;
    await post({ action: 'control', code: c2, set: 'start', facultyCode: 'fac123' });
    clock += 700_000;
    const r = await post({ action: 'join', code: c2, name: 'Late' });
    assert.strictEqual(r.body.error, 'session_ended');
    const p = (await post({ action: 'faculty_state', code: c2, facultyCode: 'fac123' })).body.projector;
    assert.strictEqual(p.counts.noDecision, 0);
  });

  // ---- Team mode
  let tc;
  await t('team session: join needs a team name', async () => {
    tc = (await post({ action: 'create', mode: 'team', facultyCode: 'fac123' })).body.session.code;
    const r = await post({ action: 'join', code: tc, name: 'Cy' });
    assert.strictEqual(r.body.error, 'team_name_required');
  });
  await t('team: first press wins, second gets the team decision', async () => {
    const c1 = (await post({ action: 'join', code: tc, name: 'Cy', teamName: 'Blue ' })).body.participantId;
    const c2 = (await post({ action: 'join', code: tc, name: 'Di', teamName: 'blue' })).body.participantId;
    await post({ action: 'control', code: tc, set: 'start', facultyCode: 'fac123' });
    clock += 200_000;
    const [r1, r2] = await Promise.all([
      post({ action: 'decide', code: tc, participantId: c1, choice: 'switch', reason: 'firmware' }),
      post({ action: 'decide', code: tc, participantId: c2, choice: 'stay', reason: 'wait' }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    assert.deepStrictEqual(statuses, [200, 409]);
    const loser = r1.status === 409 ? r1 : r2;
    assert.ok(loser.body.decision.by);
    const s = await post({ action: 'state', code: tc, participantId: c2 });
    assert.strictEqual(s.body.me.mates, 2);
    const fs = (await post({ action: 'faculty_state', code: tc, facultyCode: 'fac123' })).body;
    assert.strictEqual(fs.teams, 1);
  });

  // ---- Platform identity and completion reporting
  await t('platform session: student bound to token, completion reported once', async () => {
    const fac = tok({ sub: 'u-fac', role: 'faculty', sim: cfg.sim.id, course: 'c1', mode: 'session', name: 'Prof' });
    const pc = (await post({ action: 'create', mode: 'individual', launchToken: fac })).body.session.code;
    const stu = tok({ sub: 'u-stu', role: 'student', sim: cfg.sim.id, course: 'c1', name: 'Eve' });
    const other = tok({ sub: 'u-x', role: 'student', sim: cfg.sim.id, course: 'c2', name: 'Mal' });
    assert.strictEqual((await post({ action: 'join', code: pc, launchToken: other })).body.error, 'session_course_mismatch');
    const j = await post({ action: 'join', code: pc, launchToken: stu });
    assert.strictEqual(j.body.participantId, 'platform:u-stu');
    assert.strictEqual((await post({ action: 'state', code: pc, participantId: 'platform:u-stu' })).status, 401);
    const wrongSim = tok({ sub: 'u-fac', role: 'faculty', sim: 'rapid-03-midland', course: 'c1', mode: 'session' });
    assert.strictEqual((await post({ action: 'faculty_state', code: pc, launchToken: wrongSim })).status, 401);
    const sameCourseOther = tok({ sub: 'u-fac2', role: 'faculty', sim: cfg.sim.id, course: 'c1', mode: 'session' });
    assert.strictEqual((await post({ action: 'control', code: pc, set: 'start', launchToken: sameCourseOther })).status, 403);
    await post({ action: 'control', code: pc, set: 'start', launchToken: fac });
    clock += 700_000;
    reports.length = 0;
    await post({ action: 'reveal', code: pc, participantId: 'platform:u-stu', launchToken: stu });
    await post({ action: 'reveal', code: pc, participantId: 'platform:u-stu', launchToken: stu });
    assert.strictEqual(reports.length, 1);
    assert.strictEqual(reports[0].metrics.choice, 'none');
  });

  // ---- Public config
  await t('public config strips reveal highlights and carries no reports', async () => {
    const r = await call(cfgHandler, {}, { 'x-access-code': 'x' });
    assert.strictEqual(r.status, 503); // standalone closed when ACCESS_CODE unset
    process.env.ACCESS_CODE = 'open';
    const ok = await call(cfgHandler, {}, { 'x-access-code': 'open' });
    const s = JSON.stringify(ok.body);
    assert.ok(!s.includes('revealHighlight'));
    assert.ok(!s.includes(cfg.reports[0].text));
    assert.ok(!s.includes(cfg.reveal.caption));
    assert.ok(s.includes('Meridian Transit Networks')); // the fine print is still there to find
    assert.strictEqual(ok.body.walkthrough.length, 4);
    assert.ok(!JSON.stringify(ok.body.walkthrough).includes('Meridian'));
  });

  await t('standalone access code creates a private run with a student-controlled start', async () => {
    assert.strictEqual((await post({ action: 'solo', name: 'Guest' })).status, 401);
    const direct = await post({ action: 'solo', name: 'Guest' }, { 'x-access-code': 'open' });
    assert.strictEqual(direct.status, 200);
    const c = direct.body.session.code, pid = direct.body.participantId;
    assert.strictEqual(direct.body.session.solo, true);
    assert.strictEqual(direct.body.session.phase, 'lobby');
    assert.strictEqual((await post({ action: 'join', code: c, name: 'Stranger' })).status, 403);
    assert.strictEqual((await post({ action: 'start_solo', code: c, participantId: 'wrong' })).status, 403);
    assert.strictEqual((await post({ action: 'start_solo', code: c, participantId: pid })).body.session.phase, 'playing');
    assert.strictEqual((await post({ action: 'start_solo', code, participantId: a })).status, 403);
    assert.strictEqual((await call(cfgHandler, { session: c })).status, 403);
    clock += 30_000;
    assert.strictEqual((await post({ action: 'decide', code: c, participantId: pid, choice: 'stay', reason: 'Read both documents' })).status, 200);
    clock += 700_000;
    const before = reports.length;
    const withToken = tok({ sub: 'unrelated', role: 'student', sim: cfg.sim.id });
    const end = await post({ action: 'reveal', code: c, participantId: pid, launchToken: withToken });
    assert.strictEqual(end.status, 200);
    assert.strictEqual(end.body.completionRequired, false);
    assert.strictEqual(reports.length, before);
    assert.strictEqual((await post({ action: 'faculty_state', code: c, facultyCode: 'fac123' })).status, 403);
  });

  await t('class links bypass access code while preserving account and course checks', async () => {
    const guest = (await post({ action: 'create', mode: 'individual', facultyCode: 'fac123' })).body.session.code;
    delete process.env.ACCESS_CODE;
    assert.strictEqual((await call(cfgHandler, { session: guest })).status, 200);
    assert.strictEqual((await call(cfgHandler, { session: 'ZZZZZ' })).status, 404);
    const fac = tok({ sub: 'f2', role: 'faculty', sim: cfg.sim.id, course: 'c2', mode: 'session', name: 'Faculty' });
    const pc = (await post({ action: 'create', mode: 'individual', launchToken: fac })).body.session.code;
    const stu = tok({ sub: 's2', role: 'student', sim: cfg.sim.id, course: 'c2', name: 'Student' });
    const wrong = tok({ sub: 's2', role: 'student', sim: cfg.sim.id, course: 'wrong' });
    assert.strictEqual((await call(cfgHandler, { session: pc })).body.error, 'platform_signin_required');
    assert.strictEqual((await call(cfgHandler, { session: pc }, { 'x-launch-token': wrong })).status, 403);
    assert.strictEqual((await call(cfgHandler, { session: pc }, { 'x-launch-token': stu })).status, 200);
    const pid = (await post({ action: 'join', code: pc, launchToken: stu })).body.participantId;
    await post({ action: 'control', code: pc, set: 'start', launchToken: fac });
    clock += 700_000;
    reportOk = false;
    assert.strictEqual((await post({ action: 'reveal', code: pc, participantId: pid, launchToken: stu })).body.completionReported, false);
    reportOk = true;
    const before = reports.length;
    assert.strictEqual((await post({ action: 'reveal', code: pc, participantId: pid, launchToken: stu })).body.completionReported, true);
    await post({ action: 'reveal', code: pc, participantId: pid, launchToken: stu });
    assert.strictEqual(reports.length, before + 1);
    assert.strictEqual(reports.at(-1).launch.course, 'c2');
    await post({ action: 'control', code: pc, set: 'close', launchToken: fac });
    assert.strictEqual((await call(cfgHandler, { session: pc }, { 'x-launch-token': stu })).status, 200);
    assert.strictEqual((await call(cfgHandler, { session: pc })).status, 401);
    assert.strictEqual((await call(cfgHandler, { session: pc }, { 'x-launch-token': wrong })).status, 403);
    const newcomer = tok({ sub: 'not-joined', role: 'student', sim: cfg.sim.id, course: 'c2' });
    assert.strictEqual((await call(cfgHandler, { session: pc }, { 'x-launch-token': newcomer })).status, 410);
  });

  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
