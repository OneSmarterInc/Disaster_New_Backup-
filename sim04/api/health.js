const crypto = require('node:crypto');
const store = require('../lib/store');
const { META } = require('../lib/meta');
const finger = value => value ? crypto.createHash('sha256').update(value).digest('hex').slice(0, 8) : null;
function authorized(req) {
  const want = process.env.HEALTH_SECRET || '', given = (req.headers && req.headers['x-health-key']) || '';
  const a = Buffer.from(String(want)), b = Buffer.from(String(given));
  return !!want && !!given && a.length === b.length && crypto.timingSafeEqual(a, b);
}
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  if (!authorized(req)) return res.status(200).json({ ok: true, sim: META.id });
  const launchSecret = !!process.env.LAUNCH_SECRET, storage = store.configured();
  const platform = /^https:\/\//.test(process.env.PLATFORM_URL || '');
  const self = /^https:\/\//.test(process.env.SIM_URL || '');
  // A shared instructor code would let one faculty member run another's room.
  const sharedCode = !!process.env.FACULTY_CODE;
  const codes = require('../lib/guard').facultyCodes().length;
  return res.status(200).json({
    ok: launchSecret && storage && platform && self && !sharedCode,
    sim: META.id, diagnostic: true, needsModelKey: false,
    build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    launchSecret: launchSecret ? 'configured' : 'MISSING',
    launchSecretFingerprint: finger(process.env.LAUNCH_SECRET),
    sessions: storage ? 'configured' : 'MISSING',
    platformUrl: process.env.PLATFORM_URL || 'MISSING',
    registersAs: process.env.SIM_URL || 'MISSING',
    accessCode: process.env.ACCESS_CODE ? 'configured' : 'not set (standalone access closed)',
    facultyCodes: sharedCode ? 'SHARED FACULTY_CODE SET: remove it and use FACULTY_CODES' : `${codes} personal`,
    features: ['launch-token', 'self-register', 'completion-report', 'individual-session-mode',
      'team-session-mode', 'room-clock', 'staged-projector', 'private-error-check']
  });
};
