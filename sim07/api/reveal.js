// Standalone (non-session) play. The reveal is still kept out of the page and
// the config payload: it is served only after a complete decision is presented.
// Pacing for standalone play is the auto-advance timing, enforced by the client.
const { checkAccess, checkDemoAccess, body } = require('../lib/guard.js');
const { SETTINGS } = require('../data/config.js');
const E = require('../lib/engine.js');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (req.headers['x-demo-mode'] === '1') { if (!checkDemoAccess(req, res)) return; }
  else if (!checkAccess(req, res)) return;
  const b = body(req);
  const choice = String(b.choice || '');
  const lapsed = !!b.lapsed;
  if (!['buy', 'decline'].includes(choice) || (lapsed && choice !== 'decline')) return res.status(400).json({ error: 'choice_required' });
  const min = lapsed ? SETTINGS.lapseMinWords : SETTINGS.justificationMinWords;
  if (E.words(b.justification) < min) return res.status(400).json({ error: 'justification_too_short', min });
  if (!['yes', 'no', 'unsure'].includes(String(b.recognised || ''))) return res.status(400).json({ error: 'recognition_required' });
  const n = Math.max(1, Math.min(3, Number(b.stage) || 1));
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ stage: n, stages: E.stageContent(n) });
};
