'use strict';
// Launch tokens and completion reports. Same contract as the other sims:
// HMAC-SHA256 over a base64url JSON body, shared LAUNCH_SECRET, signed POST back to PLATFORM_URL.
const crypto = require('crypto');

function verifyLaunch(token) {
  const secret = process.env.LAUNCH_SECRET;
  if (!secret || typeof token !== 'string' || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [bodyPart, mac] = parts;
  const expect = crypto.createHmac('sha256', secret).update(bodyPart).digest('base64url');
  const a = Buffer.from(mac || ''), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(bodyPart, 'base64url').toString('utf8')); } catch (e) { return null; }
  if (!p.exp || Date.now() > p.exp) return null;
  return p;
}

function signBack(payload) {
  const secret = process.env.LAUNCH_SECRET;
  if (!secret) return null;
  const bodyPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return bodyPart + '.' + crypto.createHmac('sha256', secret).update(bodyPart).digest('base64url');
}

async function post(path, payload, label) {
  const base = (process.env.PLATFORM_URL || '').replace(/\/$/, '');
  if (!base) return { ok: false, reason: 'no_platform_url' };
  const token = signBack(payload);
  if (!token) return { ok: false, reason: 'no_secret' };
  try {
    const r = await fetch(base + path, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }), signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.error(label + ' refused', r.status, await r.text().catch(() => ''));
    return { ok: r.ok };
  } catch (e) {
    console.error(label + ' failed', e.message);
    return { ok: false, reason: e.message };
  }
}

// Best effort: a failure here never reaches the participant.
async function reportCompletion({ launch, summary, metrics }) {
  if (!launch || !launch.sub) return { ok: false, reason: 'no_launch' };
  return post('/api/complete', {
    sub: launch.sub, sim: launch.sim, course: launch.course || null,
    duration: launch.iat ? Math.round((Date.now() - launch.iat) / 1000) : null,
    summary: summary || null, metrics: metrics || null,
    iat: Date.now(), exp: Date.now() + 5 * 60000,
  }, 'completion');
}

let announced = null;
function announce() {
  if (announced) return announced;
  if (!process.env.PLATFORM_URL || !process.env.SIM_URL || !process.env.LAUNCH_SECRET) return Promise.resolve();
  const meta = require('./meta');
  const attempt = post('/api/register', {
    ...meta, sim: meta.id, kind: 'register', launchUrl: process.env.SIM_URL,
    iat: Date.now(), exp: Date.now() + 5 * 60000,
  }, 'registration');
  announced = attempt;
  attempt.then(r => { if (!r.ok && announced === attempt) announced = null; });
  return attempt;
}
function resetAnnounce() { announced = null; }
module.exports = { verifyLaunch, reportCompletion, announce, resetAnnounce };
