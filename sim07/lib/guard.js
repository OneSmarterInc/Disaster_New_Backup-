const { verifyLaunch, announce } = require('./launch.js');
const S = require('../data/config.js');

function canonicalUrl(req) {
  if (process.env.SIM_URL) return String(process.env.SIM_URL).replace(/\/+$/, '');
  if (process.env.PLATFORM_URL) return String(process.env.PLATFORM_URL).replace(/\/+$/, '') + '/sim07';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return host ? `${proto}://${host}` : '';
}

const announcement = Symbol('catalogueAnnouncement');
function announceOnce(req) {
  // Share this request's attempt so a failed registration is retried by the
  // next request, rather than restarted after config has already awaited it.
  if (!req[announcement]) {
    req[announcement] = Promise.resolve()
      .then(() => announce(S.META, canonicalUrl(req)))
      .catch(() => {});
  }
  return req[announcement];
}

function checkAccess(req, res) {
  announceOnce(req);
  const lt = req.headers['x-launch-token'];
  if (lt) {
    const p = verifyLaunch(String(lt));
    if (!p) {
      res.status(401).json({ error: 'launch_token_invalid' });
      return false;
    }
    // A token for another sim must never be reusable merely because the deployments
    // share LAUNCH_SECRET.
    if (p.sim !== S.META.id) {
      res.status(403).json({ error: 'launch_token_wrong_sim' });
      return false;
    }
    if (!p.sub || !['student', 'faculty', 'faculty_preview'].includes(p.role)) {
      res.status(401).json({ error: 'launch_token_invalid' });
      return false;
    }
    req.launch = p;
    return true;
  }

  // RapidSim 07 is intentionally closed to anonymous direct traffic. If the
  // standalone code has not been configured yet, fail closed rather than
  // accidentally treating the deployment as public. Platform launches remain
  // unaffected because their signed token is checked above.
  const required = process.env.ACCESS_CODE;
  if (!required) {
    res.status(503).json({
      error: 'access_code_not_configured',
      message: 'Standalone access is not configured. Launch this simulation from RapidSims or ask the administrator.'
    });
    return false;
  }
  if (req.headers['x-access-code'] !== required) {
    res.status(401).json({ error: 'access_code_required' });
    return false;
  }
  return true;
}

function body(req) {
  let b = req.body;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch { b = null; }
  }
  return b || {};
}

// Demo access is separate from the student access code and class invitations.
function checkDemoAccess(req, res) {
  if (req.query?.session || req.body?.session) {
    res.status(400).json({ error: 'demo_is_standalone' });
    return false;
  }
  if (req.headers['x-launch-token']) {
    if (!checkAccess(req, res)) return false;
    if (['faculty', 'faculty_preview'].includes(req.launch.role)) return true;
    res.status(403).json({ error: 'faculty_authorization_required' });
    return false;
  }
  const given = String(req.headers['x-faculty-code'] || '').trim();
  const codes = String(process.env.FACULTY_CODES || '').split(',').map(entry => {
    const i = entry.lastIndexOf(':');
    return i > 0 ? entry.slice(i + 1).trim() : '';
  }).filter(Boolean);
  if (process.env.FACULTY_CODE) codes.push(process.env.FACULTY_CODE);
  if (given && codes.includes(given)) return true;
  res.status(401).json({ error: 'faculty_authorization_required' });
  return false;
}

module.exports = { checkAccess, checkDemoAccess, body, announceOnce, canonicalUrl };
