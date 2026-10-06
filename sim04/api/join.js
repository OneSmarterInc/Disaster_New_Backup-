const store = require('../lib/store.js');
const { accountJoinUrl } = require('../lib/session-entry.js');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const code = String(req.query?.session || '').trim().toUpperCase();
  if (!/^[A-Z2-9]{5}$/.test(code)) return res.status(400).json({ error: 'invalid_session_code' });
  if (!store.configured()) return res.status(503).json({ error: 'no_store' });
  try {
    const sess = await store.getSession(code);
    if (!sess) return res.status(404).json({ error: 'no_such_session' });
    if (sess.solo) return res.status(403).json({ error: 'private_session' });
    if (sess.state === 'complete') return res.status(410).json({ error: 'session_complete' });
    // A standalone invitation must still pass through the student access gate.
    // The marker prevents launch.html from sending the verified room back here.
    return res.redirect(302, sess.platformAuth ? accountJoinUrl(sess)
      : '../launch.html?session=' + encodeURIComponent(code) + '&guest=1');
  } catch (e) {
    console.error('session entry failed', e.message);
    return res.status(503).json({ error: 'session_entry_unavailable' });
  }
};
