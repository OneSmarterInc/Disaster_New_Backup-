'use strict';
const crypto = require('node:crypto');
const { META } = require('./meta');

function signBack(payload) {
  if (!process.env.LAUNCH_SECRET) return null;
  const b = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return b + '.' + crypto.createHmac('sha256', process.env.LAUNCH_SECRET).update(b).digest('base64url');
}
function verifyLaunch(token) {
  if (!process.env.LAUNCH_SECRET || typeof token !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;
  const [b, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', process.env.LAUNCH_SECRET).update(b).digest('base64url');
  const a = Buffer.from(mac), c = Buffer.from(expected);
  if (a.length !== c.length || !crypto.timingSafeEqual(a, c)) return null;
  try {
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString('utf8'));
    return payload.exp && Date.now() < payload.exp && payload.sim === META.id ? payload : null;
  } catch { return null; }
}

let announced = null;
async function announce() {
  const base = process.env.PLATFORM_URL?.replace(/\/+$/, '');
  const self = process.env.SIM_URL?.replace(/\/+$/, '');
  if (!base || !self || !process.env.LAUNCH_SECRET) return false;
  if (announced) return announced;
  const now = Date.now();
  const token = signBack({
    kind: 'register', sim: META.id, number: META.number, title: META.title,
    tagline: META.tagline, description: META.description, detail: META.detail,
    minutes: META.minutes, catalogueRevision: META.catalogueRevision,
    launchUrl: self, iat: now, exp: now + 5 * 60000
  });
  announced = fetch(base + '/api/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }), signal: AbortSignal.timeout(6000)
  }).then(async r => {
    if (!r.ok) throw new Error(`Registration returned ${r.status}`);
    return true;
  }).catch(e => { console.error('Sim 04 registration failed:', e.message); announced = null; return false; });
  return announced;
}

async function reportCompletion({ participantId, courseId, summary, metrics }) {
  const base = process.env.PLATFORM_URL?.replace(/\/+$/, '');
  if (!base || !participantId.startsWith('platform:')) return false;
  const now = Date.now();
  const token = signBack({
    sub: participantId.slice('platform:'.length), sim: META.id, course: courseId || null,
    summary, metrics, iat: now, exp: now + 5 * 60000
  });
  if (!token) return false;
  try {
    const res = await fetch(base + '/api/complete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }), signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) { console.error('Sim 04 completion rejected:', res.status); return false; }
    return true;
  } catch (e) { console.error('Sim 04 completion failed:', e.message); return false; }
}
module.exports = { signBack, verifyLaunch, announce, reportCompletion };
