'use strict';
const assert = require('node:assert/strict');
const sheets = require('../data/sheets');
const config = require('../data/config');
const room = require('../lib/room');
const gate = require('../build');
const store = require('../lib/store');
const { signBack } = require('../lib/launch');
const fs = require('node:fs');
const path = require('node:path');
const canonicalSimUrl = fs.readFileSync(path.join(__dirname, '../.env.example'), 'utf8').match(/^SIM_URL=(.+)$/m)[1];

let passed = 0;
function check(name, fn) { return Promise.resolve().then(fn).then(() => { passed++; console.log('ok', name); }); }
const NOW = 1_780_000_000_000;
let now = NOW;
const realDateNow = Date.now, realFetch = global.fetch, oldEnv = { ...process.env };
Date.now = () => now;
Object.assign(process.env, {
  LAUNCH_SECRET: 'test-secret-not-for-production', PLATFORM_URL: 'https://platform.test',
  SIM_URL: canonicalSimUrl, FACULTY_CODES: 'Pat:private-instructor,Lee:other-instructor', ACCESS_CODE: 'private-student'
});
const sessions = new Map(), requests = [];
global.fetch = async (url, options) => {
  requests.push({ url, payload: JSON.parse(Buffer.from(JSON.parse(options.body).token.split('.')[0], 'base64url').toString('utf8')) });
  return { ok: true, status: 200, text: async () => '' };
};
store.configured = () => true;
store.createSession = async (code, session) => {
  if (sessions.has(code)) return false;
  sessions.set(code, structuredClone(session)); return true;
};
store.getSession = async code => sessions.has(code) ? structuredClone(sessions.get(code)) : null;
store.courseSessions = async courseId => [...sessions.values()]
  .filter(session => !session.practice && session.platformAuth && session.courseId === courseId && session.state !== 'complete' && session.stage < 3)
  .map(({ code, name, mode, state, stage }) => ({ code, name, mode, state, stage }));
store.compareAndSetSession = async (code, previous, next) => {
  if (JSON.stringify(sessions.get(code)) !== JSON.stringify(previous)) return false;
  sessions.set(code, structuredClone(next)); return true;
};

const handler = require('../api/session');
const token = (sub, role) => signBack({ sub, name: sub, email: `${sub}@school.edu`, role, sim: config.simId,
  course: 'course-4', mode: role === 'student' ? 'play' : 'session', iat: now, exp: now + 600000 });
const teacher = token('instructor', 'faculty');
const students = ['ada', 'ben', 'cy'].map(id => token(id, 'student'));
async function call(payload, launch = teacher, extraHeaders = {}) {
  const result = { status: 200, body: null };
  const res = { setHeader() {}, status(n) { result.status = n; return this; }, json(b) { result.body = b; return this; } };
  await handler({ method: 'POST', body: payload,
    headers: { ...(launch ? { 'x-launch-token': launch } : {}), ...extraHeaders } }, res);
  return result;
}

(async () => {
  await check('mode required; group size must be 1 to 50', () => {
    assert.throws(() => room.createSession({ code: 'ABCDE', now }), /Choose team or individual/);
    assert.throws(() => room.createSession({ code: 'ABCDE', mode: 'team', groupSize: 0, now }), /1 to 50/);
    assert.equal(room.createSession({ code: 'ABCDE', mode: 'team', groupSize: 1, now }).groupSize, 1);
  });
  await check('seven groups cycle A, E, D, C, B, A, E', () => {
    let seven = room.createSession({ code: 'ABCDEFG', mode: 'individual', now });
    for (let i = 0; i < 7; i++) seven = room.join(seven, 'p' + i, `p${i}@school.edu`, now);
    seven = room.start(room.divide(seven, 1), now);
    assert.deepEqual(seven.slots.map(x => x.sheetId), ['A', 'E', 'D', 'C', 'B', 'A', 'E']);
  });
  const rejected = await call({ action: 'create', mode: 'team', groupSize: 0 });
  await check('API refuses a group size of zero', () => assert.equal(rejected.status, 400));
  const studentGate = { 'x-access-code': 'private-student' };
  await check('student access code cannot unlock instructor controls', async () => {
    assert.equal((await call({ action: 'faculty_access' }, null, studentGate)).status, 401);
    assert.equal((await call({ action: 'create', mode: 'team', count: 3 }, null, studentGate)).status, 401);
    assert.equal((await call({ action: 'faculty_access' }, students[0])).status, 401);
  });
  await check('instructor code alone unlocks instructor controls', async () => {
    assert.equal((await call({ action: 'faculty_access', facultyCode: 'private-instructor' }, null)).status, 200);
  });
  const direct = await call({ action: 'create', mode: 'individual', count: 3,
    facultyCode: 'private-instructor' }, null);
  assert.equal(direct.status, 200);
  await check('student code joins a standalone room without instructor code', async () => {
    const joined = await call({ action: 'join', code: direct.body.session.code, email: 'Solo@School.edu' }, null, studentGate);
    assert.equal(joined.status, 200);
    assert.equal(joined.body.view.group, null, 'joiners wait unassigned');
    assert.equal(joined.body.view.you, 'solo');
    assert.equal(joined.body.view.data, null);
    const twice = await call({ action: 'join', code: direct.body.session.code, email: 'solo@school.edu' }, null, studentGate);
    assert.equal(twice.status, 409, 'one email joins once');
    const noEmail = await call({ action: 'join', code: direct.body.session.code, email: 'not an email' }, null, studentGate);
    assert.equal(noEmail.status, 409);
  });
  await check('standalone invitation returns to the student access gate', async () => {
    const redirect = {};
    const res = { setHeader() {}, status(n) { redirect.status = n; return this; },
      json(b) { redirect.body = b; return this; },
      redirect(n, path) { redirect.status = n; redirect.path = path; return this; } };
    await require('../api/join')({ method: 'GET', query: { session: direct.body.session.code } }, res);
    assert.equal(redirect.status, 302);
    assert.equal(redirect.path, '../launch.html?session=' + direct.body.session.code + '&guest=1');
  });
const created = await call({ action: 'create', mode: 'team', groupSize: 1, clockMinutes: 1 });
assert.equal(created.status, 200);
const code = created.body.session.code;
await check('student course launch lists only open rooms for its course', async () => {
  const listed = await call({ action: 'course_sessions' }, students[0]);
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.sessions.map(session => session.code), [code]);
  const otherCourse = signBack({ sub: 'other', name: 'other', role: 'student', sim: config.simId,
    course: 'different-course', mode: 'play', iat: now, exp: now + 600000 });
  assert.deepEqual((await call({ action: 'course_sessions' }, otherCourse)).body.sessions, []);
  assert.equal((await call({ action: 'course_sessions' }, teacher)).status, 403);
});
await check('registration states explicit identity, number and canonical route', () => {
    const r = requests.find(x => x.url === 'https://platform.test/api/register');
    assert.equal(r.payload.sim, config.simId); assert.equal(r.payload.number, 4);
    assert.equal(r.payload.launchUrl, process.env.SIM_URL);
  });
  for (let i = 0; i < 3; i++) {
    const joined = await call({ action: 'join', code }, students[i]);
    assert.equal(joined.status, 200);
    assert.equal(joined.body.view.data, null);
    assert.equal(joined.body.view.group, null);
  }
  for (const who of ['ada', 'ben', 'cy']) {
    const moved = await call({ action: 'move', code, participantId: `platform:${who}`, target: 'new' });
    assert.equal(moved.status, 200);
  }
  await check('a second instructor cannot see or run this room', async () => {
    for (const action of ['faculty_state', 'divide', 'start', 'private_check']) {
      const r = await call({ action, code, facultyCode: 'other-instructor' }, null);
      assert.equal(r.status, 403, action);
    }
  });
  await check('projector console carries short names, never emails', async () => {
    const state = await call({ action: 'faculty_state', code });
    assert.deepEqual(state.body.projector.groups.map(g => g.members[0].name), ['ada', 'ben', 'cy']);
    assert.ok(!JSON.stringify(state.body).includes('@school.edu'));
  });
  const started = await call({ action: 'start', code });
  assert.equal(started.status, 200);
  await check('started room clears lobby status and starts its minute clock', async () => {
    const state = await call({ action: 'state', code }, students[0]);
    assert.equal(state.body.view.state, 'running');
    assert.equal(state.body.view.clock.remaining, 60);
  });
  for (let i = 0; i < 3; i++) {
    const response = await call({ action: 'state', code }, students[i]);
    await check(`real student API response ${i + 1} has only its own sheet`, () => {
      assert.equal(response.status, 200);
      assert.deepEqual(gate.studentLeaks(response.body, ['A', 'E', 'D'][i]), []);
      assert.ok(response.body.view.data.sheet.lines.includes(sheets.contested[['A', 'E', 'D'][i]]));
      assert.equal(response.body.view.data.accounts.length, 43);
      assert.equal(response.body.view.data.tickets.length, 53);
    });
  }
  const forbidden = await call({ action: 'private_check', code }, students[0]);
  await check('private error check requires faculty authorization', () => assert.equal(forbidden.status, 401));
  const first = await call({ action: 'commit', code, number: 90.0, confidence: 4 }, students[0]);
  const repeated = await call({ action: 'commit', code, number: 85.0, confidence: 2 }, students[0]);
  await check('commit is final', () => { assert.equal(first.status, 200); assert.equal(repeated.status, 409); });
  const wrong = await call({ action: 'commit', code, number: 20.0, confidence: 1 }, students[1]);
  assert.equal(wrong.status, 200);
  const prereveal = await call({ action: 'faculty_state', code });
  await check('projector before reveal has only names and commitment status', () => {
    assert.equal(prereveal.body.projector.numbers, undefined);
    assert.equal(prereveal.body.projector.reveal, undefined);
    assert.deepEqual(prereveal.body.projector.groups.map(g => g.committed), [true, true, false]);
  });
  await check('cannot reveal while the third group is still working', async () => {
    const early = await call({ action: 'advance', code }); assert.equal(early.status, 409);
  });
  now += 61000;
  const stage1 = await call({ action: 'advance', code });
  await check('stage 1 reveals all figures, including no number, without sheets', () => {
    assert.equal(stage1.status, 200);
    const p = room.projector(sessions.get(code), now);
    assert.deepEqual(p.numbers.filter(n => !n.example).map(n => n.number), ['90.0', '20.0', null]);
    assert.deepEqual(p.numbers.filter(n => n.example).map(n => n.number), ['80.0', '85.0']);
    assert.equal(p.reveal, undefined);
    assert.ok(!JSON.stringify(p).includes(sheets.contested.E));
  });
  const checkResult = await call({ action: 'private_check', code });
  await check('private check flags a wrong report and leaves no report unscored', () => {
    assert.deepEqual(checkResult.body.checks.groups.map(c => c.status), ['ok', 'mismatch', 'none']);
    assert.equal(checkResult.body.checks.groups[1].correct, 69.6);
    assert.deepEqual(checkResult.body.checks.groups[0].members, ['ada@school.edu']);
  });
  await call({ action: 'advance', code });
  await check('stage 2 groups same sheets and derives numbers from the engine', () => {
    const p = room.projector(sessions.get(code), now);
    assert.equal(p.reveal.length, 5);
    assert.deepEqual(p.reveal.map(r => r.example), [false, false, false, true, true]);
    assert.ok(p.reveal[0].derivation.at(-1).includes('90.0%'));
    assert.ok(p.reveal[1].derivation.at(-1).includes('69.6%'));
    assert.equal(p.reveal[0].contestedIndex, 3);
    assert.equal(p.reveal[0].department, 'Sales');
  });
  const stillPrivate = await call({ action: 'state', code }, students[0]);
  await check('student remains on its own locked report through stage 2', () => {
    assert.equal(stillPrivate.body.view.commit.number, '90.0');
    assert.deepEqual(gate.studentLeaks(stillPrivate.body, 'A'), []);
    assert.equal(stillPrivate.body.view.canCommit, false);
  });
  const original = room.studentView;
  room.studentView = (...args) => ({ ...original(...args), injected: sheets.contested.E });
  const planted = await call({ action: 'state', code }, students[0]);
  room.studentView = original;
  await check('leak guard catches a planted fault in the real API path', () => {
    assert.ok(gate.studentLeaks(planted.body, 'A').some(s => s.includes('another sheet')));
  });
  const complete = await call({ action: 'advance', code });
  await check('completion reports all three launched participants to the platform', () => {
    assert.equal(complete.body.session.stage, 3);
    const completions = requests.filter(x => x.url === 'https://platform.test/api/complete');
    assert.deepEqual(completions.map(x => x.payload.sub).sort(), ['ada', 'ben', 'cy']);
    assert.equal(complete.body.completion.sent, 3);
    assert.equal(completions[2].payload.sim, config.simId);
  });
  await check('build guards catch planted student content', () => {
    const fs = require('node:fs'), path = require('node:path');
    const pages = ['launch.html','index.html','student.js','instructor.html','instructor.js','private-check.html','private-check.js'];
    const source = Object.fromEntries(pages.map(p => ['public/' + p, fs.readFileSync(path.join(__dirname, '../public', p), 'utf8')]));
    source['public/student.js'] += '\n// TODO missing text';
    assert.ok(gate.checkSource(source).some(s => s.includes('placeholder')));
    source['public/student.js'] += '\n// ' + sheets.reveal.E.purpose;
    assert.ok(gate.checkSource(source).some(s => s.includes('reveal')));
  });
  await check('spoiler guards catch planted wording in student, console and catalogue copy', () => {
    const fs = require('node:fs'), path = require('node:path');
    const pages = ['launch.html','index.html','student.js','instructor.html','instructor.js','private-check.html','private-check.js'];
    const clean = Object.fromEntries(pages.map(p => ['public/' + p, fs.readFileSync(path.join(__dirname, '../public', p), 'utf8')]));
    assert.deepEqual(gate.checkSpoilers(clean), []);
    const plant = (file, text) => ({ ...clean, [file]: clean[file] + '\n' + text });
    assert.ok(gate.checkSpoilers(plant('public/student.js', "li.className = 'contested'")).some(s => s.includes('student bundle')));
    assert.ok(gate.checkSpoilers(plant('public/index.html', 'Your private sheet')).some(s => s.includes('student bundle')));
    assert.ok(gate.checkSpoilers(plant('public/instructor.html', 'reveal the disagreement')).some(s => s.includes('projected console')));
    const { META } = require('../lib/meta');
    const leaky = { ...META, description: 'Compare how five valid definitions lead to different answers.' };
    assert.ok(gate.checkSpoilers(clean, leaky).some(s => s.includes('catalogue copy')));
  });
  await check('pre-reveal marks timed-out groups as locked, not committed', () => {
    let session = room.createSession({ code: 'ABCDE', owner: 'F', mode: 'individual', now: NOW });
    for (let i = 0; i < 3; i++) session = room.join(session, 'p' + i, `p${i}@school.edu`, NOW);
    session = room.start(room.divide(session, 1, () => 0.999), NOW);
    const firstSlot = session.slots[0].memberIds[0];
    session = room.commit(session, firstSlot, 90, 4, NOW + 1);
    const p = room.projector(session, room.deadline(session));
    assert.equal(p.session.stage, 0);
    assert.ok(p.groups.every(g => g.locked));
    assert.deepEqual(p.groups.map(g => g.committed), [true, false, false]);
    assert.equal(p.numbers, undefined);
    assert.equal(p.reveal, undefined);
  });
  await check('deployment guards catch disabled builds, missing URL and host-derived registration', () => {
    assert.ok(gate.checkWiring({ vercel: { git: { deploymentEnabled: false } } }).some(s => s.includes('deployment disabled')));
    assert.ok(gate.checkWiring({ env: 'SIM_URL=' }).some(s => s.includes('SIM_URL missing')));
    assert.ok(gate.checkWiring({ launch: "req.headers['x-forwarded-host']" }).some(s => s.includes('request host')));
    assert.ok(gate.checkWiring({ platform: { rewrites: [] } }).some(s => s.includes('platform route missing')));
  });
  await check('faculty preview: a private practice room the instructor owns and plays alone', async () => {
    const before = requests.filter(x => x.url.endsWith('/api/complete')).length;
    const practice = await call({ action: 'practice' });
    assert.equal(practice.status, 200);
    const pcode = practice.body.session.code;
    assert.equal(practice.body.view.practice, true);
    assert.equal(practice.body.view.group, 'Team 1');
    assert.equal(practice.body.view.data, null, 'no sheet before the clock');
    assert.ok(!(await call({ action: 'course_sessions' }, students[0])).body.sessions.some(x => x.code === pcode),
      'practice rooms are never listed for students');
    assert.equal((await call({ action: 'join', code: pcode }, students[0])).status, 200, 'join call itself is not blocked');
    assert.equal((await call({ action: 'start', code: pcode })).status, 200);
    const playing = await call({ action: 'state', code: pcode, participantId: 'platform:instructor' });
    assert.equal(playing.body.view.data.sheet.lines.length, 5);
    assert.equal((await call({ action: 'commit', code: pcode, number: 90, confidence: 3 })).status, 200);
    for (let i = 0; i < 3; i++) assert.equal((await call({ action: 'advance', code: pcode })).status, 200);
    assert.equal(requests.filter(x => x.url.endsWith('/api/complete')).length, before, 'practice never reports completion');
    assert.equal((await call({ action: 'practice' }, students[1])).status, 401, 'students cannot open practice rooms');
    assert.equal((await call({ action: 'faculty_state', code: pcode, facultyCode: 'other-instructor' }, null)).status, 403);
  });
  await check('direct-route practice room: only its owner can play it with their faculty code', async () => {
    const pat = { 'x-faculty-code': 'private-instructor' };
    const made = await call({ action: 'practice' }, null, pat);
    assert.equal(made.status, 200);
    const pcode = made.body.session.code, pid = made.body.participantId;
    assert.ok(pid.startsWith('practice:'));
    assert.equal((await call({ action: 'state', code: pcode, participantId: pid }, null, pat)).status, 200);
    assert.equal((await call({ action: 'state', code: pcode, participantId: pid }, null, { 'x-faculty-code': 'other-instructor' })).status, 401);
    assert.equal((await call({ action: 'state', code: pcode, participantId: pid }, null, { 'x-access-code': 'private-student' })).status, 401);
    assert.equal((await call({ action: 'start', code: pcode }, null, pat)).status, 200);
    const cfg = { status: 0 };
    await require('../api/config')({ method: 'GET', headers: pat },
      { setHeader() {}, status(n) { cfg.status = n; return this; }, json() { return this; } });
    assert.equal(cfg.status, 200, 'the practice student page can load its config with a faculty code');
  });
  await check('a shared FACULTY_CODE is refused and fails the health check', async () => {
    process.env.FACULTY_CODE = 'shared-code-1';
    assert.equal((await call({ action: 'faculty_access', facultyCode: 'shared-code-1' }, null)).status, 401);
    const out = {}; process.env.HEALTH_SECRET = 'h';
    require('../api/health')({ headers: { 'x-health-key': 'h' } }, { setHeader() {}, status() { return this; }, json(b) { Object.assign(out, b); } });
    assert.equal(out.ok, false); assert.match(out.facultyCodes, /SHARED/);
    delete process.env.FACULTY_CODE;
  });
  console.log(`${passed} runtime checks passed, 0 failed`);
})().catch(e => { console.error('FAIL', e.stack); process.exitCode = 1; }).finally(() => {
  Date.now = realDateNow; global.fetch = realFetch;
  for (const k of Object.keys(process.env)) if (!(k in oldEnv)) delete process.env[k];
  Object.assign(process.env, oldEnv);
});
