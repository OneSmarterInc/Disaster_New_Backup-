const { checkConfigAccess } = require('../lib/session-entry.js');
const S = require('../lib/scenario.js');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'GET or POST only' });
  }
  // Presentation copy is harmless, but serving it through the same access guard
  // makes the public /sim05 surface genuinely private when ACCESS_CODE is set.
  // A valid platform launch token always takes precedence, so enrolled students
  // and faculty launched from RapidSims never have to type the standalone code.
  if (!await checkConfigAccess(req, res)) return;
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return res.status(200).json({ ...S.publicConfig(), platformUrl: process.env.PLATFORM_URL || 'https://rapidsims.flexee.org' });
};
