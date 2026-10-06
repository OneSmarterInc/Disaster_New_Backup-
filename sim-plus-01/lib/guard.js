'use strict';

const { verifyLaunch, announce } = require('./launch');
const { META, acceptsLaunchId } = require('./meta');
const crypto = require('node:crypto');

function canonicalUrl(req) {
  if (process.env.SIM_URL) return String(process.env.SIM_URL).replace(/\/+$/, '');
  if (process.env.PLATFORM_URL) return String(process.env.PLATFORM_URL).replace(/\/+$/, '') + '/simplus01';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return host ? `${proto}://${host}` : '';
}

function facultyAccess(req) {
  // Only the verified server-side launch can grant the faculty capability.
  const p = req.launch;
  if (p && p.sub && acceptsLaunchId(p.sim) && ['faculty', 'faculty_preview'].includes(p.role)) return true;
  const want = Buffer.from(String(process.env.FACULTY_CODE || ''));
  const given = Buffer.from(String(req.headers['x-faculty-code'] || ''));
  return want.length > 0 && want.length === given.length && crypto.timingSafeEqual(want, given);
}

function announceOnce(req) {
  try {
    announce(META, canonicalUrl(req));
  } catch (_) {}
}

function checkAccess(req, res) {
  announceOnce(req);
  const token = req.headers['x-launch-token'];
  if (token) {
    const launch = verifyLaunch(String(token));
    if (launch) {
      if (!acceptsLaunchId(launch.sim)) {
        res.status(403).json({ error: 'launch_token_wrong_sim' }); return false;
      }
      req.launch = launch; return true;
    }
    res.status(401).json({ error: 'launch_token_invalid' });
    return false;
  }
  const required = process.env.ACCESS_CODE;
  if (!required || req.headers['x-access-code'] === required) return true;
  res.status(401).json({ error: 'access_code_required' });
  return false;
}

function body(req) {
  if (typeof req.body !== 'string') return req.body || {};
  try { return JSON.parse(req.body); } catch (_) { return {}; }
}

module.exports = { checkAccess, body, canonicalUrl, facultyAccess };
