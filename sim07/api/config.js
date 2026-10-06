const { checkConfigAccess } = require('../lib/session-entry.js');
const { announceOnce, checkDemoAccess } = require('../lib/guard.js');
const { META, SETTINGS, PRE_REVEAL } = require('../data/config.js');

// Pre-reveal copy only. Reveal stages are never part of this payload.
function publicConfig() {
  return {
    meta: { id: META.id, title: META.title, tagline: META.tagline, minutes: META.minutes },
    settings: {
      decisionMinutes: SETTINGS.decisionMinutes,
      justificationMinWords: SETTINGS.justificationMinWords,
      lapseMinWords: SETTINGS.lapseMinWords,
      autoAdvanceSeconds: SETTINGS.autoAdvanceSeconds
    },
    setting: PRE_REVEAL.setting,
    intro: PRE_REVEAL.intro,
    briefing: PRE_REVEAL.briefing,
    advisers: PRE_REVEAL.advisers,
    decision: PRE_REVEAL.decision,
    team: PRE_REVEAL.team
  };
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });
  // Keep registration inside the request lifetime, including code-entry probes.
  // Failure remains non-blocking for access and is retried on the next request.
  await announceOnce(req);
  const demo = req.headers['x-demo-mode'] === '1';
  if (demo) { if (!checkDemoAccess(req, res)) return; }
  else if (!await checkConfigAccess(req, res)) return;
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return res.status(200).json({ ...publicConfig(), demo, platformUrl: process.env.PLATFORM_URL || 'https://rapidsims.flexee.org' });
};
module.exports.publicConfig = publicConfig;
