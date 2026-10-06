const { access, faculty } = require('../lib/guard');
const { announce } = require('../lib/launch');
const { publicConfig } = require('../lib/meta');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'GET or POST only' });
  await announce();
  if (!access(req) && !faculty(req, {})) return res.status(401).json({ error: 'access_required' });
  return res.status(200).json(publicConfig());
};
