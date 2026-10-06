#!/usr/bin/env node
// Dependency-free checks for RapidSim 07. They drive the real API handlers with
// an in-memory store and a controllable clock.
process.env.W07_MEMORY_STORE = '1';
process.env.LAUNCH_SECRET = 'test-secret-only';
process.env.FACULTY_CODES = 'Tester:fac-123';
process.env.ACCESS_CODE = 'open-sesame';
delete process.env.PLATFORM_URL;

const assert = require('assert');
const crypto = require('crypto');
const store = require('../lib/store.js');
const session = require('../api/session.js');
const reveal = require('../api/reveal.js');
const config = require('../api/config.js');
const joinEntry = require('../api/join.js');
const finish = require('../api/finish.js');
const E = require('../lib/engine.js');
const { META, REVEAL, FORBIDDEN_PRE_REVEAL } = require('../data/config.js');

let clock = Date.parse('2026-10-01T15:00:00Z');
const realNow = Date.now;
Date.now = () => clock;
const advance = (ms) => { clock += ms; };

function res() {
  return { statusCode: 200, body: null, headers: {},
    status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; },
    setHeader(k, v) { this.headers[k] = v; }, end() { return this; }, redirect(n, url) { this.statusCode = n; this.location = url; return this; } };
}
async function call(handler, b, headers = {}, method = 'POST', query = {}) {
  const r = res(); await handler({ method, headers, body: b, query }, r); return r;
}
const S = (b, h) => call(session, b, h);
const fac = (b) => S({ ...b, facultyCode: 'fac-123' });
function token(p) {
  const body = Buffer.from(JSON.stringify({ iat: clock, exp: clock + 3600e3, ...p })).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', process.env.LAUNCH_SECRET).update(body).digest('base64url');
}

const results = [];
async function check(name, fn) {
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name + ' — ' + e.message]); }
}

(async () => {
  store._resetMemory();

  await check('anonymous create is refused', async () => {
    const r = await S({ action: 'create', mode: 'individual' });
    assert.strictEqual(r.statusCode, 401);
  });
  await check('mode is required with no default', async () => {
    const r = await fac({ action: 'create' });
    assert.strictEqual(r.statusCode, 400); assert.strictEqual(r.body.error, 'play_mode_required');
  });
  await check('faculty token for another sim is not faculty', async () => {
    const r = await S({ action: 'create', mode: 'individual' }, { 'x-launch-token': token({ sim: 'rapid-03-midland', role: 'faculty', sub: 'f1' }) });
    assert.strictEqual(r.statusCode, 401);
  });

  // ---------- individual session ----------
  const created = await fac({ action: 'create', mode: 'individual' });
  const code = created.body.session.code;
  const ids = {};
  for (const name of ['Asha Patel', 'Ben Ortiz', 'Chen Wu', 'Dee Lang']) {
    const j = await S({ action: 'join', code, name });
    ids[name] = j.body.participantId;
  }

  await check('students cannot decide before the session starts', async () => {
    const r = await S({ action: 'decide', code, participantId: ids['Asha Patel'], choice: 'buy', justification: 'a b c d e f g h i' });
    assert.strictEqual(r.statusCode, 409);
  });
  await fac({ action: 'control', code, set: 'start' });

  await check('short justification is rejected', async () => {
    const r = await S({ action: 'decide', code, participantId: ids['Asha Patel'], choice: 'buy', justification: 'too short' });
    assert.strictEqual(r.body.error, 'justification_too_short');
  });
  const ashaText = 'The price is about one percent of our revenue, so owning the option is cheap.';
  await check('a valid decision is recorded and locked', async () => {
    const r = await S({ action: 'decide', code, participantId: ids['Asha Patel'], choice: 'buy', justification: ashaText });
    assert.strictEqual(r.statusCode, 200); assert.strictEqual(r.body.me.choice, 'buy');
    const again = await S({ action: 'decide', code, participantId: ids['Asha Patel'], choice: 'decline', justification: ashaText });
    assert.strictEqual(again.body.error, 'decision_locked');
  });
  await S({ action: 'decide', code, participantId: ids['Ben Ortiz'], choice: 'decline', justification: 'They lose thirty million a year and pulled their public offering this summer.' });
  await S({ action: 'decide', code, participantId: ids['Chen Wu'], choice: 'decline', justification: 'Customers want the new release tonight and our stores are where that habit lives.' });

  await check('the split stays hidden while decisions are open', async () => {
    const r = await fac({ action: 'projector', code });
    assert.strictEqual(r.body.phase, 'deciding'); assert.strictEqual(r.body.split, undefined);
    assert.strictEqual(r.body.decided, 3);
  });
  await check('recognition is required before any reveal content', async () => {
    const r = await S({ action: 'state', code, participantId: ids['Asha Patel'] });
    assert.deepStrictEqual(r.body.stages, []); assert.strictEqual(r.body.stage, 0);
  });
  await S({ action: 'recognise', code, participantId: ids['Asha Patel'], answer: 'no' });
  await S({ action: 'recognise', code, participantId: ids['Ben Ortiz'], answer: 'yes' });

  // Clock runs out; Dee never decided.
  advance(10 * 60e3 + 30e3);
  await check('decisions after the clock and grace are refused as lapsed', async () => {
    const r = await S({ action: 'decide', code, participantId: ids['Dee Lang'], choice: 'buy', justification: 'I would have bought it for the online capability they have.' });
    assert.strictEqual(r.body.error, 'offer_lapsed');
  });
  await check('a lapsed student is asked for one line, recorded as a lapsed decline', async () => {
    const st = await S({ action: 'state', code, participantId: ids['Dee Lang'] });
    assert.strictEqual(st.body.needsLapseLine, true);
    const r = await S({ action: 'lapse', code, participantId: ids['Dee Lang'], justification: 'I was still reading the finance card.' });
    assert.strictEqual(r.body.me.choice, 'decline'); assert.strictEqual(r.body.me.lapsed, true);
  });
  await S({ action: 'recognise', code, participantId: ids['Dee Lang'], answer: 'unsure' });

  await check('projector payload carries no names and no participant ids', async () => {
    await fac({ action: 'pin', code, ids: [ids['Asha Patel'], ids['Ben Ortiz']] });
    const r = await fac({ action: 'projector', code });
    const blob = JSON.stringify(r.body);
    for (const [name, id] of Object.entries(ids)) {
      assert(!blob.includes(name), 'name leaked: ' + name);
      assert(!blob.includes(id), 'id leaked: ' + id);
      for (const part of name.split(' ')) assert(!blob.includes(part), 'name part leaked: ' + part);
    }
    assert.deepStrictEqual(r.body.split, { bought: 1, declined: 3, lapsed: 1 });
    assert.strictEqual(r.body.pinned.length, 2);
    assert.strictEqual(r.body.recognition.yes.decline, 1);
  });
  await check('suggest a pair returns one bought and one declined', async () => {
    const r = await fac({ action: 'suggest_pair', code });
    const list = E.responseList(await store.getSession(code), await store.getParticipants(code), Date.now());
    const [a, b] = r.body.pair.map(id => list.find(x => x.id === id).choice);
    assert.deepStrictEqual([a, b], ['buy', 'decline']);
  });

  await check('with a live console, stages move only when released, in order', async () => {
    await fac({ action: 'faculty_state', code }); // heartbeat
    for (let i = 0; i < 10; i++) { advance(30e3); await fac({ action: 'faculty_state', code }); } // five minutes of debrief
    await fac({ action: 'projector', code });
    let st = await S({ action: 'state', code, participantId: ids['Asha Patel'] });
    assert.strictEqual(st.body.stage, 0);
    const skip = await fac({ action: 'control', code, set: 'release', stage: 3 });
    assert.strictEqual(skip.body.error, 'stage_out_of_order');
    await fac({ action: 'control', code, set: 'release', stage: 1 });
    st = await S({ action: 'state', code, participantId: ids['Asha Patel'] });
    assert.strictEqual(st.body.stage, 1); assert.strictEqual(st.body.stages.length, 1);
  });
  await check('company names appear only at stage 3', async () => {
    await fac({ action: 'control', code, set: 'release', stage: 2 });
    let st = await S({ action: 'state', code, participantId: ids['Asha Patel'] });
    assert(!/Blockbuster|Netflix/.test(JSON.stringify(st.body)), 'names before stage 3');
    await fac({ action: 'control', code, set: 'release', stage: 3 });
    st = await S({ action: 'state', code, participantId: ids['Asha Patel'] });
    assert(/Blockbuster/.test(JSON.stringify(st.body)) && /Netflix/.test(JSON.stringify(st.body)));
    assert(st.body.stages[2].close, 'close copy missing at stage 3');
  });
  await check('the pinned justification is identical across every stage', async () => {
    const st = await S({ action: 'state', code, participantId: ids['Asha Patel'] });
    assert.strictEqual(st.body.me.justification, ashaText);
  });
  await check('a student who has not recognised still sees nothing, even at stage 3', async () => {
    const st = await S({ action: 'state', code, participantId: ids['Chen Wu'] });
    assert.deepStrictEqual(st.body.stages, []);
  });

  // ---------- auto-advance fallback ----------
  await check('without a console, stages auto-advance after the close', async () => {
    const c2 = (await fac({ action: 'create', mode: 'individual' })).body.session.code;
    const p = (await S({ action: 'join', code: c2, name: 'Solo' })).body.participantId;
    await fac({ action: 'control', code: c2, set: 'start' });
    await S({ action: 'decide', code: c2, participantId: p, choice: 'decline', justification: 'The losses are large and the market has turned against these companies.' });
    await S({ action: 'recognise', code: c2, participantId: p, answer: 'no' });
    advance(10 * 60e3 + 1000);
    let st = await S({ action: 'state', code: c2, participantId: p });
    assert.strictEqual(st.body.stage, 0);
    advance(91e3); st = await S({ action: 'state', code: c2, participantId: p }); assert.strictEqual(st.body.stage, 1);
    advance(90e3); st = await S({ action: 'state', code: c2, participantId: p }); assert.strictEqual(st.body.stage, 2);
    advance(900e3); st = await S({ action: 'state', code: c2, participantId: p }); assert.strictEqual(st.body.stage, 3);
  });

  await check('a console that drops out advances one stage per interval and never goes backwards', async () => {
    const c4 = (await fac({ action: 'create', mode: 'individual' })).body.session.code;
    const p = (await S({ action: 'join', code: c4, name: 'Lid' })).body.participantId;
    await fac({ action: 'control', code: c4, set: 'start' });
    await S({ action: 'decide', code: c4, participantId: p, choice: 'buy', justification: 'Owning the channel is cheaper than competing with it later on.' });
    await S({ action: 'recognise', code: c4, participantId: p, answer: 'no' });
    await fac({ action: 'control', code: c4, set: 'end_decisions' });
    advance(21e3);
    for (let i = 0; i < 10; i++) { advance(30e3); await fac({ action: 'faculty_state', code: c4 }); }
    let st = await S({ action: 'state', code: c4, participantId: p });
    assert.strictEqual(st.body.stage, 0, 'moved while the console was live');
    advance(185e3); // lid closed for just over two intervals
    st = await S({ action: 'state', code: c4, participantId: p });
    assert.strictEqual(st.body.stage, 2);
    const back = await fac({ action: 'faculty_state', code: c4 });
    assert.strictEqual(back.body.stage, 2, 'console return must not drop the stage');
    st = await S({ action: 'state', code: c4, participantId: p });
    assert.strictEqual(st.body.stage, 2);
  });

  // ---------- team mode ----------
  await check('team mode: majority decides and a tie declines', async () => {
    const c3 = (await fac({ action: 'create', mode: 'team' })).body.session.code;
    const t = {};
    for (const n of ['T1', 'T2', 'T3', 'T4', 'T5']) t[n] = (await S({ action: 'join', code: c3, name: n })).body.participantId;
    const start1 = await fac({ action: 'control', code: c3, set: 'start' });
    assert.strictEqual(start1.body.error, 'unassigned_participants');
    for (const [n, team] of [['T1', 1], ['T2', 1], ['T3', 2], ['T4', 2], ['T5', 2]]) await fac({ action: 'assign', code: c3, participantId: t[n], team });
    await fac({ action: 'control', code: c3, set: 'start' });
    const why = 'This is a long enough reason to count as a full sentence for the check.';
    await S({ action: 'decide', code: c3, participantId: t.T1, choice: 'buy', justification: why });
    await S({ action: 'decide', code: c3, participantId: t.T2, choice: 'decline', justification: why });
    await S({ action: 'decide', code: c3, participantId: t.T3, choice: 'buy', justification: why });
    await S({ action: 'decide', code: c3, participantId: t.T4, choice: 'buy', justification: why });
    await S({ action: 'decide', code: c3, participantId: t.T5, choice: 'decline', justification: why });
    await fac({ action: 'control', code: c3, set: 'end_decisions' });
    advance(21e3);
    const pj = await fac({ action: 'projector', code: c3 });
    const byLabel = Object.fromEntries(pj.body.teams.map(x => [x.label, x]));
    assert.strictEqual(byLabel['Team 1'].outcome, 'decline'); assert.strictEqual(byLabel['Team 1'].tie, true);
    assert.strictEqual(byLabel['Team 2'].outcome, 'buy');
    await S({ action: 'recognise', code: c3, participantId: t.T1, answer: 'no' });
    const st = await S({ action: 'state', code: c3, participantId: t.T1 });
    assert.strictEqual(st.body.me.choice, 'buy'); assert.strictEqual(st.body.team.outcome, 'decline');
  });

  // ---------- standalone reveal + config ----------
  await check('config needs access and contains no reveal content', async () => {
    const denied = await call(config, {}, {}, 'GET'); assert.strictEqual(denied.statusCode, 401);
    const ok = await call(config, {}, { 'x-access-code': 'open-sesame' }, 'GET');
    assert.strictEqual(ok.statusCode, 200);
    const blob = JSON.stringify(ok.body).toLowerCase();
    for (const f of FORBIDDEN_PRE_REVEAL) assert(!blob.includes(f.toLowerCase()), 'forbidden in config payload: ' + f);
    for (const s of REVEAL.stages) assert(!JSON.stringify(ok.body).includes(s.body[0]), 'reveal text in config');
  });
  await check('standalone reveal requires a full decision and recognition', async () => {
    const h = { 'x-access-code': 'open-sesame' };
    let r = await call(reveal, { choice: 'buy', justification: 'a long enough justification for the check here', stage: 1 }, h);
    assert.strictEqual(r.body.error, 'recognition_required');
    r = await call(reveal, { choice: 'buy', justification: 'short', recognised: 'no', stage: 1 }, h);
    assert.strictEqual(r.body.error, 'justification_too_short');
    r = await call(reveal, { choice: 'buy', justification: 'a long enough justification for the check here', recognised: 'no', stage: 2 }, h);
    assert.strictEqual(r.body.stages.length, 2);
  });
  await check('student launch token for another sim is refused', async () => {
    const r = await call(config, {}, { 'x-launch-token': token({ sim: 'rapid-05-approve', role: 'student', sub: 's1' }) }, 'GET');
    assert.strictEqual(r.statusCode, 403);
  });
  await check('catalogue identity is stable', async () => {
    assert.strictEqual(META.id, 'rapid-07-bought');
    assert(!['rapid-03-bench'].includes(META.id));
  });

  await check('guest invitations open without the standalone access code', async () => {
    assert.strictEqual((await call(config, {}, {}, 'GET', { session: code })).statusCode, 200);
    assert.strictEqual((await call(joinEntry, {}, {}, 'GET', { session: code })).location, '../index.html?session=' + code + '&guest=1');
    assert.strictEqual((await call(finish, { sessionCode: code, participantId: ids['Asha Patel'] })).body.reported, false);
  });
  await check('class entry enforces account, course and participant identity', async () => {
    const faculty = { 'x-launch-token': token({ sim: META.id, sub: 'teacher', name: 'Teacher', role: 'faculty', mode: 'session', course: 'course-a' }) };
    const c = (await S({ action: 'create', mode: 'individual' }, faculty)).body.session.code;
    const student = { 'x-launch-token': token({ sim: META.id, sub: 'pupil', name: 'Pupil', role: 'student', course: 'course-a' }) };
    assert.strictEqual((await call(config, {}, {}, 'GET', { session: c })).body.error, 'platform_signin_required');
    assert.strictEqual((await call(config, {}, student, 'GET', { session: c })).statusCode, 200);
    const wrong = { 'x-launch-token': token({ sim: META.id, sub: 'pupil', role: 'student', course: 'wrong' }) };
    assert.strictEqual((await call(config, {}, wrong, 'GET', { session: c })).statusCode, 403);
    const url = new URL((await call(joinEntry, {}, {}, 'GET', { session: c })).location);
    assert.deepStrictEqual([url.searchParams.get('sim'), url.searchParams.get('course')], [META.id, 'course-a']);
    const pid = (await S({ action: 'join', code: c }, student)).body.participantId;
    assert.strictEqual(pid, 'platform:pupil');
    assert.strictEqual((await S({ action: 'state', code: c, participantId: 'platform:someone-else' }, student)).statusCode, 403);
    assert.strictEqual((await call(finish, { sessionCode: code, participantId: ids['Asha Patel'] }, student)).body.reason, 'standalone');
  });
  await check('class completion waits for the ending and retries failed callbacks', async () => {
    const faculty = { 'x-launch-token': token({ sim: META.id, sub: 'teacher', name: 'Teacher', role: 'faculty', mode: 'session', course: 'course-a' }) };
    const pupil = { 'x-launch-token': token({ sim: META.id, sub: 'pupil', name: 'Pupil', role: 'student', course: 'course-a' }) };
    const c = (await S({ action: 'create', mode: 'individual' }, faculty)).body.session.code;
    const pid = (await S({ action: 'join', code: c }, pupil)).body.participantId;
    await S({ action: 'control', code: c, set: 'start' }, faculty);
    await S({ action: 'decide', code: c, participantId: pid, choice: 'buy', justification: 'The acquisition gives us an affordable option to try a different way of doing business.' }, pupil);
    await S({ action: 'recognise', code: c, participantId: pid, answer: 'no' }, pupil);
    const payload = { sessionCode: c, participantId: pid, choice: 'decline' };
    assert.strictEqual((await call(finish, payload, pupil)).body.error, 'not_finished');
    await S({ action: 'control', code: c, set: 'end_decisions' }, faculty); advance(21e3);
    for (const stage of [1, 2, 3]) await S({ action: 'control', code: c, set: 'release', stage }, faculty);
    const oldFetch = global.fetch;
    process.env.PLATFORM_URL = 'https://platform.test';
    let reports = 0, callback = null;
    global.fetch = async (url, options) => {
      assert.strictEqual(url, 'https://platform.test/api/complete');
      reports++; callback = require('../lib/launch.js').verifyLaunch(JSON.parse(options.body).token);
      return { ok: reports > 1, status: reports > 1 ? 200 : 503, json: async () => ({}) };
    };
    try {
      assert.strictEqual((await call(finish, payload, pupil)).body.reported, false);
      assert(!(await store.getParticipants(c))[pid].reportedAt);
      assert.strictEqual((await call(finish, payload, pupil)).body.reported, true);
      assert.deepStrictEqual([callback.sub, callback.sim, callback.course, callback.metrics.choice], ['pupil', META.id, 'course-a', 'buy']);
      assert.strictEqual((await call(finish, payload, pupil)).body.already, true);
      assert.strictEqual(reports, 2);
    } finally { global.fetch = oldFetch; delete process.env.PLATFORM_URL; }
  });
  await check('only an account launch can use the platform access gate', async () => {
    const h = { 'x-launch-token': token({ sim: META.id, kind: 'register' }) };
    assert.strictEqual((await call(config, {}, h, 'GET')).statusCode, 401);
    assert(/^[a-f0-9]{32}$/.test(ids['Asha Patel']));
  });

  await check('demo requires verified faculty access, never a student code or token', async () => {
    const h = { 'x-demo-mode': '1' };
    assert.strictEqual((await call(config, {}, h, 'GET')).statusCode, 401);
    assert.strictEqual((await call(config, {}, { ...h, 'x-access-code': 'open-sesame' }, 'GET')).statusCode, 401);
    for (const payload of [
      { sim: META.id, sub: 's1', role: 'student' },
      { sim: 'rapid-08-later', sub: 'f1', role: 'faculty' },
      { sim: META.id, role: 'faculty' },
      { sim: META.id, sub: 'f1', role: 'faculty', exp: clock - 1 }
    ]) {
      const r = await call(config, {}, { ...h, 'x-launch-token': token(payload) }, 'GET');
      assert([401, 403].includes(r.statusCode));
    }
    assert.strictEqual((await call(config, {}, { ...h, 'x-faculty-code': 'wrong' }, 'GET')).statusCode, 401);
  });
  await check('faculty demo is separate from normal play and class sessions', async () => {
    for (const credentials of [
      { 'x-faculty-code': 'fac-123' },
      { 'x-launch-token': token({ sim: META.id, sub: 'f1', role: 'faculty' }) },
      { 'x-launch-token': token({ sim: META.id, sub: 'f1', role: 'faculty_preview' }) }
    ]) {
      const h = { 'x-demo-mode': '1', ...credentials };
      const r = await call(config, {}, h, 'GET');
      assert.strictEqual(r.statusCode, 200); assert.strictEqual(r.body.demo, true);
      assert.strictEqual((await call(config, {}, h, 'GET', { session: code })).statusCode, 400);
    }
    const normal = await call(config, {}, { 'x-access-code': 'open-sesame' }, 'GET');
    assert.strictEqual(normal.body.demo, false);
  });
  await check('demo reveals retain decision validation and skip completion reporting', async () => {
    const h = { 'x-demo-mode': '1', 'x-faculty-code': 'fac-123' };
    const b = { choice: 'buy', justification: ashaText, recognised: 'no', stage: 3 };
    assert.strictEqual((await call(reveal, b, h)).body.stage, 3);
    assert.strictEqual((await call(reveal, { ...b, justification: 'short' }, h)).statusCode, 400);
    assert.strictEqual((await call(reveal, b, { 'x-demo-mode': '1', 'x-access-code': 'open-sesame' })).statusCode, 401);
    const r = await call(finish, b, { 'x-demo-mode': '1', 'x-launch-token': token({ sim: META.id, sub: 'f1', role: 'faculty' }) });
    assert.strictEqual(r.body.reported, false); assert.strictEqual(r.body.reason, 'faculty_demo');
  });

  await check('a platform account cannot control a standalone session by matching the facilitator name', async () => {
    const own = await fac({ action: 'create', mode: 'individual' });
    const c5 = own.body.session.code;
    const other = token({ sim: 'rapid-07-bought', role: 'faculty', sub: 'someone-else', name: 'Tester', course: 'c9' });
    const r = await S({ action: 'control', code: c5, set: 'start' }, { 'x-launch-token': other });
    assert.strictEqual(r.statusCode, 403);
    const pj = await S({ action: 'projector', code: c5 }, { 'x-launch-token': other });
    assert.strictEqual(pj.statusCode, 403);
  });
  await check('one platform faculty cannot control another faculty session', async () => {
    const a = token({ sim: 'rapid-07-bought', role: 'faculty', sub: 'fac-a', name: 'Same Name', course: 'c1' });
    const b = token({ sim: 'rapid-07-bought', role: 'faculty', sub: 'fac-b', name: 'Same Name', course: 'c1' });
    const c6 = (await S({ action: 'create', mode: 'individual' }, { 'x-launch-token': a })).body.session.code;
    const r = await S({ action: 'faculty_state', code: c6 }, { 'x-launch-token': b });
    assert.strictEqual(r.statusCode, 403);
  });
  await check('the untimed intro is served with the pre-reveal config', async () => {
    const ok = await call(config, {}, { 'x-access-code': 'open-sesame' }, 'GET');
    assert(ok.body.intro && ok.body.intro.points.length >= 3);
  });

  Date.now = realNow;
  let failed = 0;
  for (const [s, n] of results) { console.log(`${s}  ${n}`); if (s === 'FAIL') failed++; }
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(failed ? 1 : 0);
})();
