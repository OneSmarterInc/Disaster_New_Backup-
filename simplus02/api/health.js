'use strict';
const C = require('../data/config');
const { store } = require('../lib/store');
const crypto = require('crypto');

module.exports = (req, res) => {
  const secret = process.env.LAUNCH_SECRET;
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  const want = String(process.env.HEALTH_SECRET || ''), given = String(req.headers['x-health-key'] || '');
  const a = Buffer.from(want), b = Buffer.from(given);
  if (!want || !given || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(200).json({ ok: true, sim: C.id });
  res.status(200).json({
    ok: true, diagnostic: true, needsModelKey: false,
    sim: C.id,
    sessions: store.configured() ? 'configured' : 'MISSING',
    launchSecret: secret ? 'configured' : 'MISSING',
    launchSecretFingerprint: secret ? crypto.createHash('sha256').update(secret).digest('hex').slice(0, 8) : null,
    facultyCodes: process.env.FACULTY_CODES ? 'configured' : 'MISSING',
    accessCode: process.env.ACCESS_CODE ? 'configured' : 'not set (standalone access closed)',
    platformUrl: process.env.PLATFORM_URL || 'MISSING (completions will not be reported)',
    registersAs: process.env.SIM_URL || 'MISSING (set SIM_URL; do not derive from the request host)',
    features: ['launch-token', 'self-register', 'console-token', 'team-mode', 'completion-report'],
  });
};
