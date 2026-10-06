const { sql, id } = require('../lib/db.js');
const A = require('../lib/auth.js');
const { SESSION_SIMS } = require('../lib/session-sims.js');

function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  return b || {};
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = body(req);
  const s = sql();

  try {
    switch (String(b.action || '')) {

      // Public, so the join page can say which course this is before signing up.
      // Returns nothing beyond the title and who teaches it.
      case 'course_lookup': {
        const code = String(b.joinCode || '').toUpperCase().trim();
        const rows = !code && b.courseId && SESSION_SIMS.has(b.simId)
          ? await s`
              SELECT c.title, c.term, c.join_code, u.name AS faculty_name, u.institution
              FROM courses c JOIN users u ON u.id = c.faculty_id
              JOIN course_sims cs ON cs.course_id = c.id
              WHERE c.id = ${String(b.courseId)} AND cs.sim_id = ${String(b.simId)} AND c.archived = false`
          : await s`
              SELECT c.title, c.term, c.join_code, u.name AS faculty_name, u.institution
              FROM courses c JOIN users u ON u.id = c.faculty_id
              WHERE c.join_code = ${code} AND c.archived = false`;
        if (!rows.length) return res.status(404).json({ error: 'no_such_course' });
        return res.status(200).json({ course: rows[0] });
      }

      // Creates the account if needed, then enrols. One step, because a student
      // clicking their instructor's link shouldn't have to think about accounts.
      case 'signup_and_enrol': {
        const code = String(b.joinCode || '').toUpperCase().trim();
        const email = String(b.email || '').trim().toLowerCase();
        const name = String(b.name || '').trim();
        const pw = String(b.password || '');

        const course = (await s`SELECT * FROM courses WHERE join_code = ${code} AND archived = false`)[0];
        if (!course) return res.status(404).json({ error: 'no_such_course' });
        if (!email || !name) return res.status(400).json({ error: 'need_name_and_email' });
        if (pw.length < 8) return res.status(400).json({ error: 'weak_password', message: 'Use at least 8 characters.' });

        let user = (await s`SELECT * FROM users WHERE email = ${email}`)[0];
        if (user) {
          if (user.role !== 'student') {
            return res.status(409).json({ error: 'not_a_student',
              message: 'That email is already registered as a facilitator. Sign in first, then use the link.' });
          }
          if (!user.password_hash) {
            await s`UPDATE users SET password_hash = ${A.hashPassword(pw)}, name = ${name} WHERE id = ${user.id}`;
          } else if (!A.verifyPassword(pw, user.password_hash)) {
            return res.status(401).json({ error: 'account_exists',
              message: 'You already have an account with that email. Use your existing password.' });
          }
        } else {
          const uid = id('usr');
          await s`INSERT INTO users (id, email, name, role, password_hash)
                  VALUES (${uid}, ${email}, ${name}, 'student', ${A.hashPassword(pw)})`;
          user = (await s`SELECT * FROM users WHERE id = ${uid}`)[0];
        }

        const already = (await s`SELECT id FROM enrolments WHERE course_id = ${course.id} AND student_id = ${user.id}`)[0];
        if (already) {
          await s`UPDATE enrolments SET dropped = false WHERE id = ${already.id}`;
        } else {
          await s`INSERT INTO enrolments (id, course_id, student_id)
                  VALUES (${id('enr')}, ${course.id}, ${user.id})`;
        }

        await A.startSession(res, user.id);
        return res.status(200).json({ user: A.publicUser(user), course: { title: course.title } });
      }

      // Already signed in and following a link.
      case 'enrol': {
        const me = await A.requireUser(req, res);
        if (!me) return;
        if (me.role !== 'student') return res.status(403).json({ error: 'not_a_student' });
        const code = String(b.joinCode || '').toUpperCase().trim();
        const course = (await s`SELECT * FROM courses WHERE join_code = ${code} AND archived = false`)[0];
        if (!course) return res.status(404).json({ error: 'no_such_course' });
        const already = (await s`SELECT id FROM enrolments WHERE course_id = ${course.id} AND student_id = ${me.id}`)[0];
        if (already) await s`UPDATE enrolments SET dropped = false WHERE id = ${already.id}`;
        else await s`INSERT INTO enrolments (id, course_id, student_id) VALUES (${id('enr')}, ${course.id}, ${me.id})`;
        return res.status(200).json({ ok: true, course: { title: course.title } });
      }

      case 'overview': {
        const me = await A.requireUser(req, res);
        if (!me) return;
        const courses = await s`
          SELECT c.id, c.title, c.term, e.paid, e.dropped,
                 u.name AS faculty_name
          FROM enrolments e
          JOIN courses c ON c.id = e.course_id
          JOIN users u ON u.id = c.faculty_id
          WHERE e.student_id = ${me.id} AND e.dropped = false AND c.archived = false
          ORDER BY c.created_at DESC`;
        const sims = await s`
          SELECT cs.course_id, si.id, si.number, si.title, si.tagline, si.description, si.minutes,
                 (SELECT count(*) FROM launches l WHERE l.user_id = ${me.id} AND l.sim_id = si.id AND l.course_id = cs.course_id) AS played,
                 c3.completed_at, c3.duration_seconds, c3.summary, c3.metrics
          FROM course_sims cs
          JOIN sims si ON si.id = cs.sim_id
          JOIN enrolments e ON e.course_id = cs.course_id AND e.student_id = ${me.id} AND e.dropped = false
          LEFT JOIN LATERAL (
            SELECT * FROM completions c4
            WHERE c4.user_id = ${me.id} AND c4.sim_id = si.id AND c4.course_id = cs.course_id
            ORDER BY c4.completed_at DESC LIMIT 1
          ) c3 ON true
          WHERE (si.published = true
                 OR EXISTS (SELECT 1 FROM sim_access sa WHERE sa.sim_id = si.id AND sa.user_id = ${me.id}))
          ORDER BY cs.added_at`;
        return res.status(200).json({ me: A.publicUser(me), courses, sims });
      }

      default:
        return res.status(400).json({ error: 'unknown_action' });
    }
  } catch (e) {
    if (e.code === 'NO_DB') return res.status(503).json({ error: 'no_db' });
    console.error('student failure', e.message);
    return res.status(500).json({ error: 'server_error', message: e.message });
  }
};
