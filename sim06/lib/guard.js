'use strict';
const { verifyLaunch, announce } = require('./launch.js');
const { META } = require('./meta.js');

// SIM_URL must be set on the Vercel project. Deriving from the request host
// registers preview URLs and sends every launch to the catalogue root.
function canonicalUrl(req) {
  if (process.env.SIM_URL) return String(process.env.SIM_URL).replace(/\/+$/, '');
  if (process.env.PLATFORM_URL) return String(process.env.PLATFORM_URL).replace(/\/+$/, '') + '/sim06';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return host ? `${proto}://${host}` : '';
}

function announceOnce(req) {
  try { announce(META, canonicalUrl(req)); } catch {}
}

// Platform launch token first; otherwise the standalone access code. Fails closed.
function checkAccess(req, res) {
  announceOnce(req);
  const lt = req.headers['x-launch-token'];
  if (lt) {
    const p = verifyLaunch(String(lt));
    if (!p) { res.status(401).json({ error: 'launch_token_invalid' }); return false; }
    if (p.sim && p.sim !== META.id) { res.status(403).json({ error: 'launch_token_wrong_sim' }); return false; }
    req.launch = p;
    return true;
  }
  const required = process.env.ACCESS_CODE;
  if (!required) {
    res.status(503).json({ error: 'access_code_not_configured',
      message: 'Standalone access is not configured. Launch this simulation from RapidSims or ask the administrator.' });
    return false;
  }
  if (req.headers['x-access-code'] !== required) { res.status(401).json({ error: 'access_code_required' }); return false; }
  return true;
}

function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  return b || {};
}

module.exports = { checkAccess, body, announceOnce, canonicalUrl };
