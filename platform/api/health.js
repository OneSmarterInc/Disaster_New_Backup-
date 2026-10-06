// Public liveness is minimal; operator diagnostics require a dedicated HEALTH_SECRET.
const crypto = require('crypto');
const { baseUrl } = require('../lib/urls.js');

const fingerprint = (v) => v
  ? crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 8)
  : null;

function hasHealthAccess(req) {
  const want = Buffer.from(String(process.env.HEALTH_SECRET || ''));
  const given = Buffer.from(String(req.headers['x-health-key'] || ''));
  return want.length > 0 && want.length === given.length && crypto.timingSafeEqual(want, given);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  if (!hasHealthAccess(req)) return res.status(200).json({ ok: true, service: 'flexee-platform' });
  const secret = process.env.LAUNCH_SECRET;
  return res.status(200).json({
    ok: true,
    service: 'flexee-platform',
    diagnostic: true,
    build: process.env.VERCEL_GIT_COMMIT_SHA
      ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) +
        (process.env.VERCEL_GIT_COMMIT_REF ? ' on ' + process.env.VERCEL_GIT_COMMIT_REF : '')
      : 'local',
    database: (process.env.DATABASE_URL || process.env.POSTGRES_URL) ? 'configured' : 'MISSING',
    launchSecret: secret ? 'configured' : 'MISSING',
    launchSecretFingerprint: fingerprint(secret),
    // Links follow the address in use unless PUBLIC_BASE_URL pins one.
    linksWillUse: baseUrl(req) || 'nothing — no request host and no PUBLIC_BASE_URL',
    publicBaseUrl: process.env.PUBLIC_BASE_URL || 'not set — links follow whichever address is used',
    setupKeyStillPresent: process.env.SETUP_KEY ? 'yes — delete it now that setup is done' : 'no'
  });
};
