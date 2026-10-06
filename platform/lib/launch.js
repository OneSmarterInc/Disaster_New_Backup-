// The only thing a sim needs to trust the platform.
//
// The platform signs a short-lived token saying who this is and what they're
// entitled to. The sim verifies the signature with the same shared secret and
// lets them in. No database call between the two, no shared schema, nothing to
// keep in step — which is why each sim can stay a small independent deployment.

const crypto = require('crypto');

const SECRET = () => {
  const s = process.env.LAUNCH_SECRET;
  if (!s) { const e = new Error('LAUNCH_SECRET is not set'); e.code = 'NO_SECRET'; throw e; }
  return s;
};

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const unb64 = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

function sign(payload) {
  const body = b64(payload);
  const mac = crypto.createHmac('sha256', SECRET()).update(body).digest('base64url');
  return body + '.' + mac;
}

function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  let expect;
  try { expect = crypto.createHmac('sha256', SECRET()).update(body).digest('base64url'); }
  catch (e) { return null; }
  const a = Buffer.from(mac || ''), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p;
  try { p = unb64(body); } catch (e) { return null; }
  if (!p.exp || Date.now() > p.exp) return null;
  return p;
}

// Deliberately minimal: the sim learns who is playing and in what capacity,
// and nothing else about them.
// The default has to outlive the longest sim, not the shortest. Ten minutes
// was under the length of every simulation in the catalogue, so a token could
// expire mid-run — and it did, silently, because the sims only need it at the
// start and at the end.
function launchToken({ userId, name, email, role, simId, courseId, mode, minutes = 60 }) {
  return sign({
    sub: userId,
    name,
    email: email || null,      // sims that group students by email (Sim-04) read this
    role,                      // 'student' | 'faculty' | 'faculty_preview'
    sim: simId,
    mode: mode || 'play',
    course: courseId || null,
    iat: Date.now(),
    exp: Date.now() + minutes * 60000
  });
}

module.exports = { sign, verify, launchToken };
