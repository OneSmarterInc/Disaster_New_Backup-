// Public navigation metadata, available even when a launch has expired.
module.exports = (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  res.setHeader('Cache-Control', 'no-store');
  const value = String(process.env.PLATFORM_URL || '').replace(/\/+$/, '');
  return res.status(200).json({ platformUrl: /^https?:\/\//.test(value) ? value : '' });
};
