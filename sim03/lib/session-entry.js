const { verifyLaunch } = require('./launch.js');
const { META } = require('./scenario.js');

function accountJoinUrl(sess) {
  const base = (process.env.PLATFORM_URL || 'https://rapidsims.flexee.org').replace(/\/+$/, '');
  const url = new URL(base + '/session.html');
  url.searchParams.set('sim', META.id);
  url.searchParams.set('session', sess.code);
  if (sess.courseId) url.searchParams.set('course', sess.courseId);
  return url.href;
}

function participantLaunch(req, b) {
  const token = req.headers?.['x-launch-token'] || b?.launchToken;
  const p = token ? verifyLaunch(String(token)) : null;
  return p && p.sim === META.id && p.sub &&
    ['student', 'faculty', 'faculty_preview'].includes(p.role) ? p : null;
}

// Standalone code-based sessions retain their existing behavior. Platform
// participants are bound to the signed account, not a name or a remembered ID.
function participantError(req, b, sess, pid) {
  if (!sess.platformAuth && !String(pid || '').startsWith('platform:')) return null;
  const p = participantLaunch(req, b);
  if (!p) return { status: 401, error: 'platform_signin_required' };
  if (sess.courseId && p.course !== sess.courseId) return { status: 403, error: 'session_course_mismatch' };
  if (pid && pid !== `platform:${p.sub}`) return { status: 403, error: 'participant_identity_mismatch' };
  return null;
}

module.exports = { accountJoinUrl, participantLaunch, participantError };
