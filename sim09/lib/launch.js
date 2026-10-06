// Shared launch contract for RapidSim 09.
// The sim verifies platform tokens; it never mints platform launch tokens itself.
const crypto = require('crypto');

function verifyLaunch(token) {
  const secret = process.env.LAUNCH_SECRET;
  if (!secret || typeof token !== 'string' || !token.includes('.')) return null;
  const [bodyPart, mac] = token.split('.');
  const expect = crypto.createHmac('sha256', secret).update(bodyPart).digest('base64url');
  const a = Buffer.from(mac || ''), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(bodyPart, 'base64url').toString('utf8')); }
  catch { return null; }
  if (!p.exp || Date.now() > p.exp) return null;
  return p;
}

function signBack(payload) {
  const secret = process.env.LAUNCH_SECRET;
  if (!secret) return null;
  const bodyPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret).update(bodyPart).digest('base64url');
  return bodyPart + '.' + mac;
}

async function reportCompletion({ launch, summary, metrics }) {
  const base = (process.env.PLATFORM_URL || '').replace(/\/$/, '');
  if (!base || !launch || !launch.sub) return { ok: false, skipped: true };
  const token = signBack({
    sub: launch.sub,
    sim: launch.sim,
    course: launch.course || null,
    duration: launch.iat ? Math.round((Date.now() - launch.iat) / 1000) : null,
    summary: summary || null,
    metrics: metrics || null,
    iat: Date.now(),
    exp: Date.now() + 5 * 60000
  });
  if (!token) return { ok: false, skipped: true };
  try {
    const r = await fetch(base + '/api/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(6000)
    });
    if (!r.ok) {
      let why = '';
      try { why = JSON.stringify(await r.json()); } catch {}
      console.error('completion refused', r.status, why);
      return { ok: false, status: r.status };
    }
    return { ok: true };
  } catch (e) {
    // The student has already completed the simulation. Reporting is best effort.
    console.error('completion report failed', e.message);
    return { ok: false };
  }
}

// One catalogue announcement per cold start. A failed announcement is reset so a
// later request can retry rather than pinning the cold start to a failed promise.
let announced = null;
function announce(meta, selfUrl) {
  if (announced) return announced;
  const base = (process.env.PLATFORM_URL || '').replace(/\/$/, '');
  if (!base || !meta) return Promise.resolve({ ok: false, reason: 'not_configured' });

  const token = signBack({
    kind: 'register',
    sim: meta.id,
    number: 9,
    title: meta.title,
    tagline: meta.tagline,
    description: meta.description,
    minutes: meta.minutes,
    detail: meta.detail || null,
    replaces: Array.isArray(meta.replaces) ? meta.replaces.slice(0, 5) : undefined,
    catalogueRevision: meta.catalogueRevision || undefined,
    launchUrl: selfUrl || '',
    iat: Date.now(),
    exp: Date.now() + 5 * 60000
  });
  if (!token) return Promise.resolve({ ok: false, reason: 'not_configured' });

  announced = fetch(base + '/api/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
    signal: AbortSignal.timeout(6000)
  }).then(async (r) => {
    if (!r.ok) throw new Error(`announce refused ${r.status}: ${await r.text().catch(() => '')}`);
    console.log('announced', meta.id, 'to', base);
    return { ok: true };
  }).catch((e) => {
    console.error('announce failed', e.message);
    announced = null;
    return { ok: false, reason: 'failed' };
  });
  return announced;
}

module.exports = { verifyLaunch, signBack, reportCompletion, announce };
