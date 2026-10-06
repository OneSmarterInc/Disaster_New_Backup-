const { verifyLaunch } = require('./launch.js');
const { META } = require('../data/config.js');

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


// A valid class invitation grants entry to that room only. Platform rooms still
// require the student's signed account launch and matching course.
async function checkConfigAccess(req, res) {
  const { checkAccess, announceOnce } = require('./guard.js');
  const code = String(req.query?.session || req.body?.session || '').trim().toUpperCase();
  if (!code) return checkAccess(req, res);
  if (!/^[A-Z2-9]{5}$/.test(code)) {
    res.status(400).json({ error: 'invalid_session_code' }); return false;
  }
  const store = require('./store.js');
  if (!store.configured()) { res.status(503).json({ error: 'no_store' }); return false; }
  const sess = await store.getSession(code);
  if (!sess) { res.status(404).json({ error: 'no_such_session' }); return false; }
  if (sess.solo) { res.status(403).json({ error: 'private_session' }); return false; }
  if (sess.state === 'closed') { res.status(410).json({ error: 'session_closed' }); return false; }
  if (req.headers['x-launch-token'] && !participantLaunch(req)) {
    res.status(401).json({ error: 'launch_token_invalid' }); return false;
  }
  const denied = participantError(req, null, sess, null);
  if (denied) { res.status(denied.status).json({ error: denied.error }); return false; }
  announceOnce(req);
  return true;
}

module.exports = { accountJoinUrl, participantLaunch, participantError, checkConfigAccess };
