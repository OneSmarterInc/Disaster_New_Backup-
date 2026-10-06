'use strict';
const crypto = require('crypto');
const store = require('../lib/store');
const { META, LEGACY_LAUNCH_IDS } = require('../lib/meta');
const { canonicalUrl } = require('../lib/guard');

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

  // Public probes disclose only liveness and the catalogue identity.
  if (!hasHealthAccess(req)) {
    return res.status(200).json({ ok: true, sim: META.id });
  }

  const missing = [];
  if (!store.configured()) missing.push('KV_REST_API_URL / KV_REST_API_TOKEN');
  if (!process.env.LAUNCH_SECRET) missing.push('LAUNCH_SECRET');
  if (!process.env.PLATFORM_URL) missing.push('PLATFORM_URL');
  if (!canonicalUrl(req)) missing.push('SIM_URL / PLATFORM_URL');

  return res.status(missing.length ? 503 : 200).json({
    ok: !missing.length,
    sim: META.id,
    diagnostic: true,
    build: process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : 'local',
    acceptsLaunchIds: LEGACY_LAUNCH_IDS,
    title: META.title,
    missing,
    launchSecret: process.env.LAUNCH_SECRET ? 'configured' : 'MISSING',
    launchSecretFingerprint: fingerprint(process.env.LAUNCH_SECRET),
    registersAs: canonicalUrl(req) || null,
    platformUrl: process.env.PLATFORM_URL || null,
    sessions: store.configured() ? 'configured' : 'MISSING',
    canAnnounce: !!(process.env.LAUNCH_SECRET && process.env.PLATFORM_URL),
    needsModelKey: false,
    features: ['launch-token', 'self-register', 'completion-report']
  });
};
