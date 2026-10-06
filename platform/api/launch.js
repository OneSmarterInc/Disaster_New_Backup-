// The only door into a sim. Everything about entitlement is decided here:
// admins always, faculty via a course or a live preview, students only when
// their enrolment has been marked paid.
const { sql, id } = require('../lib/db.js');
const A = require('../lib/auth.js');
const { launchToken } = require('../lib/launch.js');

function deny(res, wants, title, message) {
  if (wants === 'json') return res.status(403).json({ error: 'not_entitled', title, message });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(403).send(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title><link rel="stylesheet" href="/app.css"></head><body>
    <div class="narrow">
      <div class="eyebrow">Flexee RapidSims</div>
      <h1>${title}</h1><p class="lede">${message}</p>
      <p><a href="/">Back to your courses</a></p>
    </div></body></html>`);
}

const { SESSION_SIMS } = require('../lib/session-sims.js');

module.exports = async (req, res) => {
  const q = req.query || {};
  const wants = q.format === 'json' ? 'json' : 'html';
  const simId = String(q.sim || '');
  let courseId = String(q.course || '') || null;
  const session = String(q.session || '').trim().toUpperCase();
  if (session && (!SESSION_SIMS.has(simId) || !/^[A-Z2-9]{5}$/.test(session))) {
    return res.status(400).json({ error: 'invalid_session_invite' });
  }
  res.setHeader('Cache-Control', 'no-store');
  // Why they are going: to play it, or to run a session with a class. A
  // facilitator wants both at different moments, and guessing gets it wrong
  // half the time.
  const mode = q.mode === 'session' ? 'session' : 'play';

  const me = await A.currentUser(req);
  if (!me) {
    if (wants === 'json') return res.status(401).json({ error: 'not_signed_in' });
    if (session) {
      const entry = new URLSearchParams({ sim: simId, session });
      if (courseId) entry.set('course', courseId);
      return res.redirect(302, '/session.html?' + entry.toString());
    }
    return res.redirect(302, '/');
  }

  // Session launch is an instructor capability, not a student play option.
  if (mode === 'session' && !['admin', 'faculty'].includes(me.role)) {
    return deny(res, wants, 'Faculty sign-in required', 'Sign in with a faculty account to create or manage a class session.');
  }

  const s = sql();
  try {
    const sim = (await s`SELECT * FROM sims WHERE id = ${simId}`)[0];
    if (!sim) return deny(res, wants, 'No such simulation', "That simulation isn't in the catalogue.");
    if (!sim.launch_url) return deny(res, wants, 'Not available yet', 'This simulation has no address set. Ask an administrator.');

    // A recovered instructor tab may have no launch token/course.
    // Never guess among classes or create an unbound room for a course owner.
    if (SESSION_SIMS.has(simId) && mode === 'session' && !courseId && me.role === 'faculty') {
      const eligible = await s`
        SELECT c.id, c.title FROM course_sims cs JOIN courses c ON c.id = cs.course_id
        WHERE cs.sim_id = ${simId} AND c.faculty_id = ${me.id} AND c.archived = false
        ORDER BY c.title, c.id`;
      if (eligible.length === 1) courseId = eligible[0].id;
      else if (eligible.length > 1) {
        if (wants === 'json') return res.status(409).json({
          error: 'course_selection_required', message: 'Choose the course for this session.',
          courses: eligible.map(c => ({ id: c.id, title: c.title }))
        });
        return res.redirect(302, '/faculty.html');
      }
    }
    // Explicit class context must be authorized, even when the faculty member
    // has access to this simulation through a different course or a preview.
    if (SESSION_SIMS.has(simId) && mode === 'session' && courseId) {
      const course = (await s`SELECT id, faculty_id, archived FROM courses WHERE id = ${courseId}`)[0];
      const attached = await s`SELECT 1 FROM course_sims WHERE course_id = ${courseId} AND sim_id = ${simId}`;
      if (!course || course.archived || !attached.length || (me.role !== 'admin' && course.faculty_id !== me.id)) {
        return deny(res, wants, 'Course not available', 'Open a course you manage that includes this simulation, then choose Run a session.');
      }
    }

    let asRole = null;

    if (me.role === 'admin') {
      asRole = 'faculty';

    } else if (me.role === 'faculty') {
      if (courseId) {
        const owns = await s`
          SELECT 1 FROM course_sims cs JOIN courses c ON c.id = cs.course_id
          WHERE cs.course_id = ${courseId} AND cs.sim_id = ${simId} AND c.faculty_id = ${me.id}`;
        if (owns.length) asRole = 'faculty';
      }
      if (!asRole) {
        const anyCourse = await s`
          SELECT 1 FROM course_sims cs JOIN courses c ON c.id = cs.course_id
          WHERE cs.sim_id = ${simId} AND c.faculty_id = ${me.id}`;
        if (anyCourse.length) asRole = 'faculty';
      }
      if (!asRole) {
        const prev = (await s`SELECT * FROM previews WHERE user_id = ${me.id} AND sim_id = ${simId}`)[0];
        if (prev && new Date(prev.expires_at) > new Date()) asRole = 'faculty_preview';
        else if (prev) return deny(res, wants, 'Your preview has ended',
          'The seven days are up. Add this simulation to a course to keep using it.');
      }
      if (!asRole) return deny(res, wants, 'Not on your list yet',
        'Start a preview from your dashboard, or add this simulation to one of your courses.');

    } else {
      // student
      let rows;
      if (courseId) {
        rows = await s`
          SELECT e.id, e.paid, e.dropped, c.title, e.course_id
          FROM enrolments e
          JOIN courses c ON c.id = e.course_id
          JOIN course_sims cs ON cs.course_id = c.id AND cs.sim_id = ${simId}
          WHERE e.student_id = ${me.id} AND e.course_id = ${courseId}
          ORDER BY e.paid DESC LIMIT 1`;
      } else {
        rows = await s`
          SELECT e.id, e.paid, e.dropped, c.title, e.course_id
          FROM enrolments e
          JOIN courses c ON c.id = e.course_id
          JOIN course_sims cs ON cs.course_id = c.id AND cs.sim_id = ${simId}
          WHERE e.student_id = ${me.id}
          ORDER BY e.paid DESC LIMIT 1`;
      }
      const en = rows[0];
      if (!en || en.dropped) {
        // Two quite different failures were both reported as "Not enrolled",
        // which sent people looking at the student's enrolment when the real
        // problem was usually that nobody had added the simulation to the
        // course. Say which one it is.
        // Two statements rather than one composed. The neon driver's templates
        // cannot be nested — OPERATIONS.md says so and this is exactly the
        // shape that tempts you to try.
        const enrolledAtAll = courseId
          ? await s`
              SELECT c.title FROM enrolments e JOIN courses c ON c.id = e.course_id
              WHERE e.student_id = ${me.id} AND e.dropped = false
                AND e.course_id = ${courseId}
              LIMIT 1`
          : await s`
              SELECT c.title FROM enrolments e JOIN courses c ON c.id = e.course_id
              WHERE e.student_id = ${me.id} AND e.dropped = false
              LIMIT 1`;

        if (enrolledAtAll.length) {
          return deny(res, wants, 'Not on this course yet',
            `You're enrolled on ${enrolledAtAll[0].title}, but this simulation hasn't been added to it. ` +
            'Your instructor adds it from their course page.');
        }
        return deny(res, wants, 'Not enrolled',
          "You're not enrolled on a course that uses this simulation.");
      }
      if (!en.paid) return deny(res, wants, 'Waiting on your instructor',
        'Your enrolment is confirmed, but access to this simulation hasn\'t been released yet. Your instructor releases it once your registration is settled.');
      // Direct links omit ?course. Carry the actual authorised course in the
      // ticket so session sims can find that course's open room automatically.
      courseId = en.course_id;
      asRole = 'student';
    }

    await s`INSERT INTO launches (id, user_id, sim_id, course_id, as_role)
            VALUES (${id('lch')}, ${me.id}, ${simId}, ${courseId}, ${asRole})`;

    const token = launchToken({
      userId: me.id, name: me.name, email: me.email, role: asRole,
      // Long enough to outlive the thing it launches. Ten minutes was shorter
      // than a twenty-minute simulation, so a token could expire mid-run — and
      // in sim 03 it expired on day seven of eight, before the debrief, which
      // is where a completion gets reported. Faculty saw every run as started
      // and never finished.
      simId, courseId, mode, minutes: 60
    });

    // In the fragment, not the query. A fragment is never sent in the HTTP
    // request, so the token stays out of access logs and proxy logs on the way
    // there. The simulation already reads both.
    // No trailing slash before the fragment. This built /sim03/#lt=... , and a
    // sim served under a platform path prefix has a rewrite for /sim03 and for
    // /sim03/:path* but that middle form matched neither — a student clicking
    // through landed on a 404 while the sim itself was healthy. Both forms are
    // routed now, but emitting the canonical one means a future sim does not
    // depend on someone having added the extra rule.
    const target = new URL(sim.launch_url.replace(/\/+$/, ''));
    if (mode === 'session' && q.play === 'team') target.searchParams.set('play', 'team');
    if (mode === 'session' && q.play === 'individual') target.searchParams.set('play', 'individual');
    if (session) target.searchParams.set('session', session);
    target.hash = 'lt=' + encodeURIComponent(token);
    let url = target.href;
    if (wants === 'json') return res.status(200).json({ url });
    return res.redirect(302, url);

  } catch (e) {
    if (e.code === 'NO_SECRET') return deny(res, wants, 'Not configured',
      'This deployment has no launch secret set, so it can\'t hand you over to a simulation.');
    if (e.code === 'NO_DB') return deny(res, wants, 'Not configured', 'The database isn\'t set up.');
    console.error('launch failure', e.message);
    return deny(res, wants, 'Something went wrong', 'Try again in a moment.');
  }
};
