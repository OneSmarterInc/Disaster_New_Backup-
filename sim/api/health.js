// Public health is intentionally minimal. Detailed deployment diagnostics are
// available only to operators who present a dedicated HEALTH_SECRET in the
// x-health-key header. Never reuse LAUNCH_SECRET here and never accept secrets
// in the query string.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BUILD = (() => {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) {
    const ref = process.env.VERCEL_GIT_COMMIT_REF;
    return sha.slice(0, 7) + (ref ? ' on ' + ref : '');
  }
  try {
    return 'local, ' + fs.statSync(path.join(__dirname, '../public/index.html')).mtime.toISOString();
  } catch { return 'unknown'; }
})();

const fingerprint = (v) => v
  ? crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 8)
  : null;

function hasHealthAccess(req) {
  const want = String(process.env.HEALTH_SECRET || '');
  const given = String(req.headers['x-health-key'] || '');
  if (!want || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');

  // Side-effect free: health checks must not register the sim or mutate state.
  if (!hasHealthAccess(req)) {
    return res.status(200).json({ ok: true, sim: 'rapid-01-disaster' });
  }

  const secret = process.env.LAUNCH_SECRET;
  return res.status(200).json({
    ok: true,
    sim: 'rapid-01-disaster',
    diagnostic: true,
    needsModelKey: true,
    build: BUILD,
    characters: process.env.ANTHROPIC_API_KEY ? 'configured' : 'MISSING',
    accessCode: process.env.ACCESS_CODE ? 'configured' : 'not set (open)',
    sessions: ((process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)) ? 'configured' : 'MISSING',
    launchSecret: secret ? 'configured' : 'MISSING',
    launchSecretFingerprint: fingerprint(secret),
    platformUrl: process.env.PLATFORM_URL || 'MISSING (completions will not be reported)',
    registersAs: process.env.SIM_URL || 'MISSING',
    features: [
      'launch-token',
      'launch-mode',
      'console-token',
      'self-register',
      'completion-report'
    ]
  });
};
