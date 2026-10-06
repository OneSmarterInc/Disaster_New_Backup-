// Verifies launch tokens issued by the platform. The sim never mints one and
// never talks to the platform — it just checks a signature with a shared secret.
const crypto = require('crypto');

function verifyLaunch(token) {
  const secret = process.env.LAUNCH_SECRET;
  if (!secret || typeof token !== 'string' || !token.includes('.')) return null;
  const [bodyPart, mac] = token.split('.');
  const expect = crypto.createHmac('sha256', secret).update(bodyPart).digest('base64url');
  const a = Buffer.from(mac || ''), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(bodyPart, 'base64url').toString('utf8')); } catch (e) { return null; }
  if (!p.exp || Date.now() > p.exp) return null;
  return p;
}

// Signs a message back to the platform — same secret, opposite direction.
function signBack(payload) {
  const secret = process.env.LAUNCH_SECRET;
  if (!secret) return null;
  const bodyPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret).update(bodyPart).digest('base64url');
  return bodyPart + '.' + mac;
}

// Tells the platform someone finished. Best effort: if it fails, the student's
// run is unaffected and nobody sees an error — the debrief has already happened.
async function reportCompletion({ launch, summary, metrics }) {
  const base = (process.env.PLATFORM_URL || '').replace(/\/$/, '');
  if (!base || !launch || !launch.sub) return;
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
  if (!token) return;
  try {
    const r = await fetch(base + '/api/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(6000)
    });
    if (!r.ok) {
      let why = '';
      try { why = JSON.stringify(await r.json()); } catch (e) {}
      console.error('completion refused', r.status, why);
    } else {
      console.log('completion reported for', launch.sub, 'on', launch.sim);
    }
  } catch (e) {
    // Never let this spoil the debrief the student is waiting for.
    console.error('completion report failed', e.message);
  }
}

// Sends the instructor transcript to its dedicated platform endpoint. Await this
// before responding: a serverless function may freeze as soon as it returns.
async function reportTranscript({ launch, envelope }) {
  const base = (process.env.PLATFORM_URL || '').replace(/\/$/, '');
  if (!base || !launch || !launch.sub || !envelope) return;
  const token = signBack({ sub: launch.sub, sim: launch.sim, course: launch.course || null,
    iat: Date.now(), exp: Date.now() + 5 * 60000 });
  if (!token) return;
  try {
    const r = await fetch(base + '/api/transcript', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, envelope: { ...envelope, simId: launch.sim } }), signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) console.error('transcript refused', r.status, await r.text().catch(() => ''));
  } catch (e) { console.error('transcript report failed', e.message); }
}

// Tells the platform this simulation exists, once per cold start. The platform
// creates a catalogue entry — unpublished, so nobody sees it until an
// administrator decides — and thereafter only refreshes the technical facts,
// leaving anything they have edited alone.
//
// Registration is best-effort and must never become a participant-facing
// failure. If the platform is temporarily slow or unavailable, clear the
// cold-start latch so the next request can retry rather than pinning a rejected
// promise for the lifetime of the function instance.
let announced = null;
function announce(meta, selfUrl) {
  if (announced) return announced;
  announced = Promise.resolve();
  const base = (process.env.PLATFORM_URL || '').replace(/\/$/, '');
  if (!base || !meta) return announced;
  const token = signBack({
    kind: 'register',
    sim: meta.id,
    number: 101,
    title: meta.title,
    tagline: meta.tagline,
    description: meta.description,
    minutes: meta.minutes,
    catalogueRevision: meta.catalogueRevision || null,
    replaces: Array.isArray(meta.replaces) ? meta.replaces.slice(0, 5) : [],
    detail: meta.detail || null,
    launchUrl: String(selfUrl || '').replace(/\/+$/, ''),
    iat: Date.now(),
    exp: Date.now() + 5 * 60000
  });
  if (!token) return announced;
  announced = fetch(base + '/api/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
    signal: AbortSignal.timeout(6000)
  }).then(async (r) => {
    if (r.ok) {
      console.log('announced', meta.id, 'to', base);
      return;
    }
    announced = null;
    console.warn('announce deferred; platform refused registration', r.status);
  }).catch((e) => {
    announced = null;
    const timedOut = /timeout|aborted/i.test(String(e && e.message));
    if (timedOut) console.warn('announce deferred; platform registration timed out');
    else console.warn('announce deferred; platform registration failed', e && e.message);
  });
  return announced;
}

module.exports = { verifyLaunch, signBack, reportCompletion, reportTranscript, announce };
