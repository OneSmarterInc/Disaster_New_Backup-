'use strict';
const crypto = require('node:crypto');
const config = require('../data/config');

function health(req) {
  const want = Buffer.from(String(process.env.HEALTH_SECRET || ''));
  const given = Buffer.from(String(req.headers['x-health-key'] || ''));
  if (!want.length || want.length !== given.length || !crypto.timingSafeEqual(want, given)) {
    return { ok: true, sim: config.simId };
  }
  const secret = process.env.LAUNCH_SECRET;
  const storage = !!((process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
    (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN));
  return {
    ok: true, sim: config.simId, diagnostic: true, needsModelKey: false,
    build: process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : 'local',
    accessCode: process.env.ACCESS_CODE ? 'configured' : 'not set (standalone access closed)',
    sessions: storage ? 'configured' : 'MISSING',
    launchSecret: secret ? 'configured' : 'MISSING',
    launchSecretFingerprint: secret ? crypto.createHash('sha256').update(secret).digest('hex').slice(0, 8) : null,
    platformUrl: process.env.PLATFORM_URL || 'MISSING',
    registersAs: process.env.SIM_URL || 'MISSING',
    catalogueRevision: config.catalogueRevision,
    features: ['launch-token', 'self-register', 'completion-report', 'solo-run', 'team-session-mode', 'room-clock']
  };
}
module.exports = { health };
