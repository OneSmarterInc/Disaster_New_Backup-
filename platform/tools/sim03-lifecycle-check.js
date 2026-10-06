const assert = require('assert');
const Module = require('module');

// The lifecycle test runs without a real Neon database. Stub the package before
// loading platform/db.js, then replace the exported db functions with an in-memory
// tagged-template implementation that exercises the actual API handlers.
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '@neondatabase/serverless') return { neon: () => { throw new Error('real database should not be used'); } };
  return originalLoad.call(this, request, parent, isMain);
};
const db = require('../lib/db.js');
Module._load = originalLoad;

const state = {
  users: new Map(),
  sims: new Map(),
  courses: new Map(),
  courseSims: [],
  enrolments: [],
  launches: [],
  completions: []
};
let seq = 0;
const nextId = (p) => `${p}_test_${++seq}`;
const norm = (strings) => strings.join('?').replace(/\s+/g, ' ').trim();

function sql(strings, ...v) {
  const q = norm(strings);

  if (q.includes('SELECT id FROM courses WHERE join_code')) {
    return Promise.resolve([...state.courses.values()].filter(c => c.join_code === v[0]).map(c => ({ id: c.id })));
  }
  if (q.startsWith('INSERT INTO courses ')) {
    const [id, faculty_id, title, term, join_code] = v;
    state.courses.set(id, { id, faculty_id, title, term, join_code, archived: false, created_at: new Date() });
    return Promise.resolve([]);
  }
  if (q.includes('SELECT * FROM courses WHERE id =') && q.includes('faculty_id =')) {
    const c = state.courses.get(v[0]);
    return Promise.resolve(c && c.faculty_id === v[1] ? [c] : []);
  }
  if (q.includes('SELECT id FROM sims si') && q.includes('si.id =')) {
    const sim = state.sims.get(v[0]);
    return Promise.resolve(sim && sim.published ? [{ id: sim.id }] : []);
  }
  if (q.startsWith('INSERT INTO course_sims ')) {
    const [course_id, sim_id, expected_seats, hard_cap] = v;
    const old = state.courseSims.find(x => x.course_id === course_id && x.sim_id === sim_id);
    if (old) Object.assign(old, { expected_seats, hard_cap });
    else state.courseSims.push({ course_id, sim_id, expected_seats, hard_cap, added_at: new Date() });
    return Promise.resolve([]);
  }
  if (q.includes('SELECT * FROM courses WHERE join_code =') && q.includes('archived = false')) {
    const c = [...state.courses.values()].find(x => x.join_code === v[0] && !x.archived);
    return Promise.resolve(c ? [c] : []);
  }
  if (q.includes('SELECT * FROM users WHERE email =')) {
    const u = [...state.users.values()].find(x => x.email === v[0]);
    return Promise.resolve(u ? [u] : []);
  }
  if (q.startsWith('INSERT INTO users ')) {
    const [id, email, name, password_hash] = v;
    state.users.set(id, { id, email, name, role: 'student', password_hash, disabled: false });
    return Promise.resolve([]);
  }
  if (q.includes('SELECT * FROM users WHERE id =')) {
    const u = state.users.get(v[0]);
    return Promise.resolve(u ? [u] : []);
  }
  if (q.includes('SELECT id FROM enrolments WHERE course_id =') && q.includes('student_id =')) {
    const e = state.enrolments.find(x => x.course_id === v[0] && x.student_id === v[1]);
    return Promise.resolve(e ? [{ id: e.id }] : []);
  }
  if (q.startsWith('INSERT INTO enrolments ')) {
    const [id, course_id, student_id] = v;
    state.enrolments.push({ id, course_id, student_id, paid: false, dropped: false, created_at: new Date() });
    return Promise.resolve([]);
  }
  if (q.startsWith('UPDATE enrolments SET paid = true') && q.includes('id = ANY')) {
    const [paid_by, paid_note, course_id, ids] = v;
    state.enrolments.filter(e => e.course_id === course_id && ids.includes(e.id)).forEach(e => {
      e.paid = true; e.paid_by = paid_by; e.paid_note = paid_note; e.paid_at = new Date();
    });
    return Promise.resolve([]);
  }
  if (q.includes('SELECT * FROM sims WHERE id =')) {
    const sim = state.sims.get(v[0]);
    return Promise.resolve(sim ? [sim] : []);
  }
  if (q.startsWith('SELECT id, faculty_id, archived FROM courses WHERE id')) {
    const c = state.courses.get(v[0]);
    return Promise.resolve(c ? [c] : []);
  }
  if (q.startsWith('SELECT 1 FROM course_sims WHERE')) {
    return Promise.resolve(state.courseSims.some(x => x.course_id === v[0] && x.sim_id === v[1]) ? [{one:1}] : []);
  }
  if (q.startsWith('SELECT c.id, c.title FROM course_sims cs')) {
    return Promise.resolve([...state.courses.values()].filter(c => c.faculty_id === v[1] && !c.archived && state.courseSims.some(x => x.course_id === c.id && x.sim_id === v[0])).map(c => ({id:c.id,title:c.title})));
  }
  if (q.includes('SELECT 1 FROM course_sims cs JOIN courses c') && q.includes('cs.course_id =') && q.includes('c.faculty_id =')) {
    const [courseId, simId, facultyId] = v;
    const c = state.courses.get(courseId);
    const ok = c && c.faculty_id === facultyId && state.courseSims.some(x => x.course_id === courseId && x.sim_id === simId);
    return Promise.resolve(ok ? [{ one: 1 }] : []);
  }
  if (q.includes('SELECT e.id, e.paid, e.dropped, c.title') && q.includes('JOIN course_sims cs') && q.includes('e.course_id =')) {
    const [simId, studentId, courseId] = v;
    const e = state.enrolments.find(x => x.student_id === studentId && x.course_id === courseId);
    const c = state.courses.get(courseId);
    const attached = state.courseSims.some(x => x.course_id === courseId && x.sim_id === simId);
    return Promise.resolve(e && c && attached ? [{ id: e.id, paid: e.paid, dropped: e.dropped, title: c.title, course_id: e.course_id }] : []);
  }
  if (q.startsWith('INSERT INTO launches ')) {
    const [id, user_id, sim_id, course_id, as_role] = v;
    state.launches.push({ id, user_id, sim_id, course_id, as_role, created_at: new Date() });
    return Promise.resolve([]);
  }
  if (q.includes('SELECT course_id, as_role FROM launches') && q.includes('course_id =')) {
    const [userId, simId, courseId] = v;
    const rows = state.launches.filter(x => x.user_id === userId && x.sim_id === simId && x.course_id === courseId)
      .sort((a,b) => b.created_at - a.created_at);
    return Promise.resolve(rows.length ? [{ course_id: rows[0].course_id, as_role: rows[0].as_role }] : []);
  }
  if (q.startsWith('INSERT INTO completions ')) {
    const [id, user_id, sim_id, course_id, duration_seconds, summary, metricsJson] = v;
    state.completions.push({
      id, user_id, sim_id, course_id, duration_seconds, summary,
      metrics: metricsJson ? JSON.parse(metricsJson) : null,
      completed_at: new Date()
    });
    return Promise.resolve([]);
  }
  if (q.includes('SELECT u.id AS student_id') && q.includes('FROM enrolments e') && q.includes('LEFT JOIN LATERAL')) {
    const courseId = v[0];
    // simId appears repeatedly in this query; use the first string value matching a known sim.
    const simId = v.find(x => state.sims.has(x));
    const rows = state.enrolments.filter(e => e.course_id === courseId).map(e => {
      const u = state.users.get(e.student_id);
      const starts = state.launches.filter(l => l.user_id === e.student_id && l.course_id === courseId && l.sim_id === simId).length;
      const cp = state.completions.filter(c => c.user_id === e.student_id && c.course_id === courseId && c.sim_id === simId)
        .sort((a,b) => b.completed_at - a.completed_at)[0];
      return {
        student_id: u.id, name: u.name, email: u.email, paid: e.paid, dropped: e.dropped,
        starts, completed_at: cp && cp.completed_at, duration_seconds: cp && cp.duration_seconds,
        summary: cp && cp.summary, metrics: cp && cp.metrics,
        transcript_recorded_at: null, transcript: null
      };
    });
    return Promise.resolve(rows);
  }
  if (q.includes('SELECT id, title FROM sims WHERE id =')) {
    const sim = state.sims.get(v[0]);
    return Promise.resolve(sim ? [{ id: sim.id, title: sim.title }] : []);
  }

  throw new Error('Unhandled lifecycle SQL: ' + q + ' | ' + JSON.stringify(v));
}

db.sql = () => sql;
db.id = nextId;
db.joinCode = () => 'M03TST';

// Patch auth before handlers capture its functions.
const A = require('../lib/auth.js');
A.requireRole = async (req, res, ...roles) => {
  const u = req.testUser || null;
  if (!u || !roles.includes(u.role)) { res.status(403).json({ error: 'forbidden' }); return null; }
  return u;
};
A.requireUser = async (req, res) => req.testUser || (res.status(401).json({ error: 'not_signed_in' }), null);
A.currentUser = async (req) => req.testUser || null;
A.startSession = async () => {};

const transcripts = require('../lib/transcripts.js');
transcripts.ensureTranscripts = async () => {};
for (const p of ['../api/faculty.js','../api/student.js','../api/launch.js','../api/complete.js']) delete require.cache[require.resolve(p)];
const facultyApi = require('../api/faculty.js');
const studentApi = require('../api/student.js');
const launchApi = require('../api/launch.js');
const completeApi = require('../api/complete.js');
const platformLaunch = require('../lib/launch.js');

process.env.LAUNCH_SECRET = 'sim03-lifecycle-shared-secret';
process.env.PLATFORM_URL = 'https://platform.test';
process.env.ACCESS_CODE = 'standalone-only-code';

const faculty = { id: 'usr_faculty', email: 'faculty@test.invalid', name: 'Faculty Test', role: 'faculty' };
state.users.set(faculty.id, faculty);
state.sims.set('rapid-03-midland', {
  id: 'rapid-03-midland', number: 4, title: 'Midland Equipment', minutes: 20,
  launch_url: 'https://rapidsims.flexee.org/sim03', published: true, created_at: new Date()
});

function response() {
  return {
    statusCode: 200, payload: null, headers: {}, redirected: null,
    status(n){ this.statusCode=n; return this; },
    json(v){ this.payload=v; return v; },
    setHeader(k,v){ this.headers[String(k).toLowerCase()]=v; },
    redirect(n,url){ this.statusCode=n; this.redirected=url; return url; },
    send(v){ this.payload=v; return v; },
    end(){ return null; }
  };
}
async function invoke(handler, { body={}, query={}, headers={}, user=null, method='POST' }={}) {
  const req = { method, body, query, headers, testUser:user };
  const res = response();
  await handler(req,res);
  return res;
}
function tokenFromUrl(url) {
  const hash = String(url).split('#lt=')[1];
  assert.ok(hash, 'launch URL must carry token in fragment');
  return decodeURIComponent(hash);
}

(async () => {
  // Faculty creates a course and adds Midland.
  let r = await invoke(facultyApi, { user: faculty, body: { action:'create_course', title:'Midland E2E', term:'Test' } });
  assert.equal(r.statusCode, 200);
  const courseId = r.payload.courseId;
  assert.equal(r.payload.joinCode, 'M03TST');

  r = await invoke(facultyApi, { user: faculty, body: { action:'add_sim', courseId, simId:'rapid-03-midland', expectedSeats:1 } });
  assert.equal(r.statusCode, 200, 'faculty should be able to attach Midland to their course');

  // Student follows the course join flow and enrols.
  r = await invoke(studentApi, { body: {
    action:'signup_and_enrol', joinCode:'M03TST', email:'student@test.invalid', name:'Student Test', password:'test-password-123'
  }});
  assert.equal(r.statusCode, 200, 'student enrolment should succeed');
  const student = [...state.users.values()].find(x => x.email === 'student@test.invalid');
  const enrolment = state.enrolments.find(x => x.student_id === student.id && x.course_id === courseId);
  assert.ok(enrolment && !enrolment.paid, 'student starts enrolled but unreleased');

  // Student cannot launch until faculty releases access.
  r = await invoke(launchApi, { method:'GET', user:student, query:{ sim:'rapid-03-midland', course:courseId, format:'json' } });
  assert.equal(r.statusCode, 403, 'unreleased student must be denied');

  r = await invoke(facultyApi, { user:faculty, body:{ action:'set_paid', courseId, paid:true, enrolmentIds:[enrolment.id], note:'lifecycle test' } });
  assert.equal(r.statusCode, 200);
  assert.equal(enrolment.paid, true, 'faculty release should activate student entitlement');

  // Faculty can launch Midland both as a player and as a session facilitator.
  r = await invoke(launchApi, { method:'GET', user:faculty, query:{ sim:'rapid-03-midland', course:courseId, format:'json' } });
  assert.equal(r.statusCode, 200);
  let token = tokenFromUrl(r.payload.url);
  let claim = platformLaunch.verify(token);
  assert.equal(claim.role, 'faculty');
  assert.equal(claim.sim, 'rapid-03-midland');

  r = await invoke(launchApi, { method:'GET', user:faculty, query:{ sim:'rapid-03-midland', course:courseId, mode:'session', format:'json' } });
  assert.equal(r.statusCode, 200);
  claim = platformLaunch.verify(tokenFromUrl(r.payload.url));
  assert.equal(claim.mode, 'session', 'faculty session launch should be marked as session mode');

  // Student launches through the platform; the token must remain valid even when
  // the standalone ACCESS_CODE is configured.
  r = await invoke(launchApi, { method:'GET', user:student, query:{ sim:'rapid-03-midland', course:courseId, format:'json' } });
  assert.equal(r.statusCode, 200, 'released student should receive a launch');
  token = tokenFromUrl(r.payload.url);
  claim = platformLaunch.verify(token);
  assert.equal(claim.role, 'student');
  assert.equal(claim.course, courseId);

  // Load the real Sim03 bootstrap using that platform token.
  const simConfig = require('../../sim03/api/config.js');
  r = await invoke(simConfig, { method:'GET', headers:{ 'x-launch-token': token } });
  assert.equal(r.statusCode, 200, 'platform token should bypass standalone access code');

  // Route Sim03's signed completion callback into the real platform completion
  // handler instead of the network.
  const oldFetch = global.fetch;
  global.fetch = async (url, opt) => {
    assert.equal(url, 'https://platform.test/api/complete');
    const rr = await invoke(completeApi, { body: JSON.parse(opt.body), headers: opt.headers });
    return {
      ok: rr.statusCode >= 200 && rr.statusCode < 300,
      status: rr.statusCode,
      json: async () => rr.payload,
      text: async () => JSON.stringify(rr.payload || {})
    };
  };
  try {
    const simFinish = require('../../sim03/api/finish.js');
    r = await invoke(simFinish, {
      headers:{ 'x-launch-token': token },
      body:{
        strategicView:'Build a connected service platform.',
        year1:{ run:3, uptime:2, capacity:1, connect:2, features:1 },
        year2:{ run:3, uptime:2, capacity:1, connect:2, features:1 },
        reflection1:'I would invest in connection earlier.',
        reflection2:'The heat-wave consequence changed my view.'
      }
    });
    assert.equal(r.statusCode, 200);
    assert.equal(r.payload.completionReported, true, 'Sim03 completion must report back to platform');
  } finally {
    global.fetch = oldFetch;
  }

  assert.equal(state.completions.length, 1, 'platform should store one completion');
  const completion = state.completions[0];
  const summary = JSON.parse(completion.summary);
  assert.equal(summary.strategicView, 'Build a connected service platform.');
  assert.equal(completion.metrics.openingView, 'Build a connected service platform.');
  assert.ok(completion.metrics.year1Allocation.includes('Connect 2'));
  assert.ok(completion.metrics.reflection1.startsWith('I would invest'));

  // Faculty progress must now show the stored completion and returned results.
  r = await invoke(facultyApi, { user:faculty, body:{ action:'sim_progress', courseId, simId:'rapid-03-midland' } });
  assert.equal(r.statusCode, 200);
  assert.equal(r.payload.rows.length, 1);
  const row = r.payload.rows[0];
  assert.equal(row.starts, 1, 'faculty progress should count the student launch');
  assert.ok(row.completed_at, 'faculty progress should see the completion');
  assert.equal(row.metrics.openingView, 'Build a connected service platform.');
  assert.ok(JSON.parse(row.summary).reflection2.includes('heat-wave'));

  console.log('RapidSim 03 platform lifecycle check passed: faculty -> course -> enrol -> release -> launch -> completion -> faculty progress.');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
