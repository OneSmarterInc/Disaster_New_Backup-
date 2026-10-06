const { verifyLaunch, announce } = require('./launch.js');
const S = require('./scenario.js');

function canonicalUrl(req) {
  if (process.env.SIM_URL) return String(process.env.SIM_URL).replace(/\/+$/, '');
  if (process.env.PLATFORM_URL) return String(process.env.PLATFORM_URL).replace(/\/+$/, '') + '/sim09';
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

  // This sim is intentionally closed to anonymous direct traffic. If the
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

module.exports = { checkAccess, body, announceOnce, canonicalUrl };
