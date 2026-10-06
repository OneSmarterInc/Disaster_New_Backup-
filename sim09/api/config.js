const { checkConfigAccess } = require('../lib/session-entry.js');
const { announceOnce } = require('../lib/guard.js');
const S = require('../lib/scenario.js');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'GET or POST only' });
  }
  // Presentation copy is harmless, but serving it through the same access guard
  // makes the public /sim09 surface genuinely private when ACCESS_CODE is set.
  // A valid platform launch token always takes precedence, so enrolled students
  // and faculty launched from RapidSims never have to type the standalone code.
  // Keep registration inside the request lifetime, including code-entry probes.
  // Failure remains non-blocking for access and is retried on the next request.
  const registration = await announceOnce(req);
  // Expose only the registration outcome, never secrets or catalogue contents.
  // This remains visible on a code-entry response so setup can be diagnosed.
  res.setHeader('X-Catalogue-Registration', registration?.ok ? 'registered' : registration?.reason || 'failed');
  if (!await checkConfigAccess(req, res)) return;
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return res.status(200).json({ ...S.publicConfig(), platformUrl: process.env.PLATFORM_URL || 'https://rapidsims.flexee.org' });
};
