const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const store = require('../lib/store.js');
const S = require('../lib/scenario.js');
const { canonicalUrl } = require('../lib/guard.js');

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

  // Health is deliberately read-only. Registration continues to happen through
  // the normal guarded application routes rather than by probing this endpoint.
  if (!hasHealthAccess(req)) {
    return res.status(200).json({ ok: true, sim: S.META.id });
  }

  const secret = process.env.LAUNCH_SECRET;
  return res.status(200).json({
    ok: true,
    sim: S.META.id,
    diagnostic: true,
    needsModelKey: false,
    build: BUILD,
    accessCode: process.env.ACCESS_CODE ? 'configured' : 'not set (standalone access closed)',
    sessions: store.configured() ? 'configured' : 'MISSING',
    launchSecret: secret ? 'configured' : 'MISSING',
    launchSecretFingerprint: fingerprint(secret),
    platformUrl: process.env.PLATFORM_URL || 'MISSING (registration/completions disabled)',
    registersAs: canonicalUrl(req) || 'MISSING',
    catalogueRevision: S.META.catalogueRevision,
    replaces: S.META.replaces,
    features: [
      'launch-token',
      'self-register',
      'completion-report',
      'costed-questions',
      'individual-session-mode',
      'team-shared-budget',
      'team-majority-vote',
      'room-clock',
      'solo-run',
      'staged-projector'
    ]
  });
};
