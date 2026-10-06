// Read-only course roster for a facilitator's live simulation console. Enrollment
// visibility is not permission to play; /api/launch still enforces access release.
const { sql } = require('../lib/db.js');
const { verify } = require('../lib/launch.js');
const { SESSION_SIMS } = require('../lib/session-sims.js');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  const courseId = String(b?.courseId || '');
  const p = verify(String(req.headers?.['x-launch-token'] || ''));
  if (!p || !SESSION_SIMS.has(p.sim) || p.role !== 'faculty' || !p.sub || p.mode !== 'session') {
    return res.status(401).json({ error: 'faculty_authorization_required' });
  }
  if (!courseId || courseId.length > 200 || p.course !== courseId) {
    return res.status(403).json({ error: 'session_course_mismatch' });
  }
  try {
    const s = sql();
    // Recheck ownership and account status in the database: a valid signature
    // alone is insufficient to disclose another instructor's students.
    const user = (await s`SELECT id, role, disabled FROM users WHERE id = ${p.sub}`)[0];
    const course = (await s`SELECT id, faculty_id, archived FROM courses WHERE id = ${courseId}`)[0];
    if (!user || user.disabled || !['faculty', 'admin'].includes(user.role) ||
        !course || course.archived || (user.role !== 'admin' && course.faculty_id !== user.id)) {
      return res.status(403).json({ error: 'course_roster_forbidden' });
    }
    const attached = await s`SELECT 1 FROM course_sims WHERE course_id = ${courseId} AND sim_id = ${p.sim}`;
    if (!attached.length) return res.status(403).json({ error: 'simulation_not_on_course' });
    const rows = await s`
      SELECT u.id AS student_id, u.name, e.paid
      FROM enrolments e JOIN users u ON u.id = e.student_id
      WHERE e.course_id = ${courseId} AND e.dropped = false
        AND u.role = 'student' AND u.disabled = false
      ORDER BY lower(u.name), u.id`;
    return res.status(200).json({ students: rows.map(r => ({
      participantId: `platform:${r.student_id}`, name: r.name, accessReleased: r.paid === true
    })) });
  } catch (error) {
    console.error('session enrolment lookup failed', error.code || 'lookup_error');
    return res.status(503).json({ error: 'course_roster_unavailable' });
  }
};
