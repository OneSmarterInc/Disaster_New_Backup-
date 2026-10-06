#!/usr/bin/env node
// Real platform handlers with disposable DB/auth adapters. No production calls.
const assert = require('node:assert/strict');
const path = require('node:path');
const { SESSION_SIMS } = require('../lib/session-sims.js');
process.env.LAUNCH_SECRET = 'session-sims-test-secret';
let me = null, simId = '', paid = true, attached = true, owner = 'teacher', disabled = false;
const course = { id: 'course-a', title: 'Test course', join_code: 'COURSE', faculty_id: 'teacher', archived: false };
const sql = async (strings, ...v) => {
  const q = strings.join('?').replace(/\s+/g, ' ').trim();
  if (q.startsWith('SELECT c.title, c.term, c.join_code')) return attached && v[0] === course.id && v[1] === simId ? [course] : [];
  if (q.startsWith('SELECT * FROM sims WHERE')) return [{ id: simId, launch_url: 'https://platform.test/sim' + simId.slice(6, 8) }];
  if (q.startsWith('SELECT c.id, c.title FROM course_sims')) return [{ id: course.id, title: course.title }];
  if (q.startsWith('SELECT id, faculty_id, archived FROM courses')) return [{ ...course, faculty_id: owner }];
  if (q.startsWith('SELECT 1 FROM course_sims')) return attached && (q.includes('JOIN courses') || v[1] === simId) ? [{ one: 1 }] : [];
  if (q.startsWith('SELECT e.id, e.paid, e.dropped, c.title')) return [{ id: 'enrolment', paid, dropped: false, title: course.title, course_id: course.id }];
  if (q.startsWith('INSERT INTO launches')) return [];
  if (q.startsWith('SELECT id, role, disabled FROM users')) return [{ id: 'teacher', role: 'faculty', disabled }];
  if (q.startsWith('SELECT u.id AS student_id, u.name, e.paid')) return [{ student_id: 'student', name: 'Student', paid }];
  throw new Error('Unexpected SQL: ' + q);
};
const mock = (rel, exports) => { const filename = path.resolve(__dirname, rel); require.cache[filename] = { id: filename, filename, loaded: true, exports }; };
mock('../lib/db.js', { sql: () => sql, id: () => 'launch-test' });
mock('../lib/auth.js', { currentUser: async () => me });
const launch = require('../api/launch.js');
const student = require('../api/student.js');
const roster = require('../api/session-enrolments.js');
const { launchToken, verify } = require('../lib/launch.js');
async function call(handler, { query = {}, body = {}, headers = {}, method = 'POST' } = {}) {
  const res = { code: 200, payload: null, location: null, headers: {},
    status(n) { this.code = n; return this; }, json(v) { this.payload = v; return this; },
    setHeader(k, v) { this.headers[k] = v; }, redirect(n, url) { this.code = n; this.location = url; return this; },
    end() { return this; }, send(v) { this.payload = v; return this; } };
  await handler({ method, query, body, headers }, res); return res;
}
let assertions = 0;
const eq = (a, b, message) => { assert.deepEqual(a, b, message); assertions++; };
(async () => {
  for (const sim of SESSION_SIMS) {
    simId = sim; attached = true; owner = 'teacher'; disabled = false; paid = true;
    eq((await call(student, { body: { action: 'course_lookup', courseId: course.id, simId } })).payload.course.join_code, 'COURSE', sim + ' invitation looks up its course');
    const query = { sim: simId, course: course.id, session: 'ABCDE', format: 'json' };
    me = null;
    eq((await call(launch, { query })).code, 401, sim + ' invitation requires sign-in');
    me = { id: 'student', name: 'Student', role: 'student' }; paid = false;
    eq((await call(launch, { query })).payload.title, 'Waiting on your instructor', sim + ' unreleased student denied');
    paid = true;
    const opened = await call(launch, { query });
    eq(opened.code, 200, sim + ' student launches');
    const url = new URL(opened.payload.url);
    eq(url.searchParams.get('session'), 'ABCDE', 'session survives launch');
    eq(url.searchParams.has('lt'), false, 'token stays out of query');
    const token = verify(new URLSearchParams(url.hash.slice(1)).get('lt'));
    eq([token.sim, token.course, token.sub], [simId, course.id, 'student'], 'token binds sim, course and student');
    eq((await call(launch, { query: { ...query, mode: 'session' } })).code, 403, 'student cannot become instructor');
    me = { id: 'teacher', name: 'Teacher', role: 'faculty' };
    eq((await call(launch, { query: { sim: simId, mode: 'session', format: 'json' } })).code, 200, sim + ' teacher course recovery');
    for (const play of ['team', 'individual']) {
      const run = await call(launch, { query: { sim: simId, course: course.id, mode: 'session', play, format: 'json' } });
      eq(new URL(run.payload.url).searchParams.get('play'), play, sim + ' forwards instructor mode selection');
    }
    const facultyToken = launchToken({ userId: 'teacher', name: 'Teacher', role: 'faculty', simId, courseId: course.id, mode: 'session' });
    const input = { body: { courseId: course.id }, headers: { 'x-launch-token': facultyToken } };
    eq((await call(roster, input)).payload.students, [{ participantId: 'platform:student', name: 'Student', accessReleased: true }], sim + ' course roster');
    paid = false;
    eq((await call(roster, input)).payload.students[0].accessReleased, false, 'reading roster does not release access');
    eq((await call(roster, { ...input, body: { courseId: 'other-course' } })).code, 403, 'wrong course refused');
    owner = 'other-teacher';
    eq((await call(roster, input)).code, 403, 'ownership rechecked');
    owner = 'teacher'; disabled = true;
    eq((await call(roster, input)).code, 403, 'disabled instructor refused');
    disabled = false; attached = false;
    eq((await call(roster, input)).payload.error, 'simulation_not_on_course', 'simulation must be attached');
    eq((await call(student, { body: { action: 'course_lookup', courseId: course.id, simId } })).code, 404, 'detached course not exposed');
  }
  eq((await call(launch, { query: { sim: 'unknown-sim', session: 'ABCDE' } })).code, 400, 'unknown sim invitation denied');
  console.log(`PASS session-sims-check: ${assertions} assertions across ${SESSION_SIMS.size} session sims`);
})().catch(e => { console.error(e); process.exit(1); });
