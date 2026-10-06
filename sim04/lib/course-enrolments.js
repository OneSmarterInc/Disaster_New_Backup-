const { verifyLaunch } = require('./launch.js');
const { META } = require('./meta.js');

// Separate from faculty_state: a slow/unavailable platform must not stop live
// team progress. This platform read never releases access or starts runs.
// The session handler separately imports approved students for team preparation.
async function courseEnrolments(req, b, sess) {
  if (!sess.platformAuth || !sess.courseId) return { available: false, students: [] };
  const token = String(req.headers?.['x-launch-token'] || b.launchToken || '');
  const p = verifyLaunch(token);
  if (!p || p.sim !== META.id || p.role !== 'faculty' || p.course !== sess.courseId || p.mode !== 'session') {
    const error = new Error('Return to RapidSims and open this course to view its enrolment.');
    error.status = 403; throw error;
  }
  const base = (process.env.PLATFORM_URL || 'https://rapidsims.flexee.org').replace(/\/+$/, '');
  try {
  const response = await fetch(base + '/api/session-enrolments', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(4000),
    headers: { 'Content-Type': 'application/json', 'x-launch-token': token },
    body: JSON.stringify({ courseId: sess.courseId })
  });
  if (!response.ok) { const error = new Error('Course enrolment could not be refreshed. Open the course to review access.'); error.status = response.status === 403 ? 403 : 503; throw error; }
  const data = await response.json();
  if (!Array.isArray(data.students)) throw new Error('Course enrolment response is unavailable.');
  const manage = new URL(base + '/faculty.html');
  manage.searchParams.set('course', sess.courseId);
  return { available: true, students: data.students, manageUrl: manage.href };
  } catch(error) {
    if(error.status)throw error;
    const unavailable=new Error('Course approval could not be checked. Retry the student list; saved results remain available.');
    unavailable.status=503;throw unavailable;
  }
}
module.exports = { courseEnrolments };
