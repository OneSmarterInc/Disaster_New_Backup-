// Run once against a fresh database. Creates the tables, seeds the catalogue,
// and makes the first admin. Refuses to do anything if an admin already exists,
// so it can't be used to mint a second one later.
const SCHEMA = require('../lib/schema.js');
const { sql, id } = require('../lib/db.js');
const { hashPassword, startSession } = require('../lib/auth.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};

  const setupKey = process.env.SETUP_KEY;
  if (!setupKey) return res.status(500).json({ error: 'SETUP_KEY is not set on this deployment.' });
  if (b.setupKey !== setupKey) return res.status(401).json({ error: 'bad_setup_key' });

  const s = sql();

  try {
    // The driver is a tagged-template function, not something with a .query()
    // method, so hand it an array shaped like the one a template literal makes.
    const runRaw = (text) => {
      if (typeof s.query === 'function') return s.query(text);
      const parts = [text];
      parts.raw = [text];
      return s(parts);
    };
    for (const stmt of SCHEMA) {
      await runRaw(stmt);
    }
  } catch (e) {
    console.error('schema failure', e.message);
    return res.status(500).json({ error: 'schema_failed', message: e.message });
  }

  const existing = await s`SELECT id FROM users WHERE role = 'admin' LIMIT 1`;
  if (existing.length) {
    return res.status(200).json({ ok: true, note: 'Schema is up to date. An admin already exists, so none was created.' });
  }

  const email = String(b.email || '').trim().toLowerCase();
  const name = String(b.name || '').trim();
  const password = String(b.password || '');
  if (!email || !name || password.length < 8) {
    return res.status(400).json({ error: 'need_admin_details', message: 'Give a name, an email, and a password of at least 8 characters.' });
  }

  const uid = id('usr');
  await s`INSERT INTO users (id, email, name, role, password_hash)
          VALUES (${uid}, ${email}, ${name}, 'admin', ${hashPassword(password)})`;

    // Nothing is seeded into the catalogue. A simulation describes itself the
    // first time its deployment is used, and an entry written here would sit
    // there stale — which is exactly what happened: wording seeded at setup
    // outlived three rewrites of the simulation's own description, because
    // registration does not overwrite what is already there.

  await startSession(res, uid);
  return res.status(200).json({ ok: true, admin: { id: uid, email, name } });
};
