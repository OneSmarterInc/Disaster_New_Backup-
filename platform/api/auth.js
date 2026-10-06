const crypto = require('crypto');
const { sql, id } = require('../lib/db.js');
const A = require('../lib/auth.js');
const { present } = require('../lib/catalogue.js');

function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  return b || {};
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = body(req);
  const s = sql();

  try {
    switch (String(b.action || '')) {

      case 'me': {
        const u = await A.currentUser(req);
        if (u) { try { await s`UPDATE users SET last_seen_at = now() WHERE id = ${u.id}`; } catch (e) {} }
        return res.status(200).json({ user: A.publicUser(u) });
      }

      case 'signin': {
        const email = String(b.email || '').trim().toLowerCase();
        const rows = await s`SELECT * FROM users WHERE email = ${email} AND disabled = false`;
        const u = rows[0];
        // Same message either way, so this can't be used to discover who has an account.
        if (!u || !u.password_hash || !A.verifyPassword(String(b.password || ''), u.password_hash)) {
          return res.status(401).json({ error: 'bad_credentials', message: 'That email and password don\'t match.' });
        }
        await A.startSession(res, u.id);
        return res.status(200).json({ user: A.publicUser(u) });
      }

      case 'signout': {
        await A.endSession(req, res);
        return res.status(200).json({ ok: true });
      }

      // Look up an invite without consuming it, so the accept page can greet them.
      case 'invite_check': {
        const t = String(b.token || '');
        const rows = await s`
          SELECT t.token, t.expires_at, t.used_at, u.email, u.name, u.role
          FROM tokens t JOIN users u ON u.id = t.user_id
          WHERE t.token = ${t} AND t.purpose = 'invite'`;
        const r = rows[0];
        if (!r) return res.status(404).json({ error: 'unknown_invite' });
        if (r.used_at) return res.status(410).json({ error: 'already_used' });
        if (new Date(r.expires_at) < new Date()) return res.status(410).json({ error: 'expired' });
        return res.status(200).json({ email: r.email, name: r.name, role: r.role });
      }

      case 'invite_accept': {
        const t = String(b.token || '');
        const pw = String(b.password || '');
        if (pw.length < 8) return res.status(400).json({ error: 'weak_password', message: 'Use at least 8 characters.' });
        const rows = await s`
          SELECT t.token, t.user_id, t.expires_at, t.used_at
          FROM tokens t WHERE t.token = ${t} AND t.purpose = 'invite'`;
        const r = rows[0];
        if (!r) return res.status(404).json({ error: 'unknown_invite' });
        if (r.used_at) return res.status(410).json({ error: 'already_used' });
        if (new Date(r.expires_at) < new Date()) return res.status(410).json({ error: 'expired' });

        const name = String(b.name || '').trim();
        await s`UPDATE users SET password_hash = ${A.hashPassword(pw)} WHERE id = ${r.user_id}`;
        if (name) await s`UPDATE users SET name = ${name} WHERE id = ${r.user_id}`;
        await s`UPDATE tokens SET used_at = now() WHERE token = ${t}`;
        const u = (await s`SELECT * FROM users WHERE id = ${r.user_id}`)[0];
        await A.startSession(res, u.id);
        return res.status(200).json({ user: A.publicUser(u) });
      }

      case 'update_profile': {
        const u = await A.currentUser(req);
        if (!u) return res.status(401).json({ error: 'not_signed_in' });
        const name = String(b.name || '').trim();
        if (name) await s`UPDATE users SET name = ${name} WHERE id = ${u.id}`;
        if (b.institution !== undefined) {
          await s`UPDATE users SET institution = ${String(b.institution).trim() || null} WHERE id = ${u.id}`;
        }
        const fresh = (await s`SELECT * FROM users WHERE id = ${u.id}`)[0];
        return res.status(200).json({ user: A.publicUser(fresh) });
      }

      // ---------- password management ----------
      case 'change_password': {
        const u = await A.currentUser(req);
        if (!u) return res.status(401).json({ error: 'not_signed_in' });
        const current = String(b.currentPassword || '');
        const next = String(b.newPassword || '');
        if (next.length < 8) return res.status(400).json({ error: 'weak_password', message: 'Use at least 8 characters.' });
        if (!u.password_hash || !A.verifyPassword(current, u.password_hash)) {
          return res.status(401).json({ error: 'bad_password', message: 'That current password isn\'t right.' });
        }
        await s`UPDATE users SET password_hash = ${A.hashPassword(next)} WHERE id = ${u.id}`;
        // Everything else signed in as them stops working.
        await s`DELETE FROM sessions WHERE user_id = ${u.id}`;
        await A.startSession(res, u.id);
        return res.status(200).json({ ok: true });
      }

      case 'reset_check': {
        const t = String(b.token || '');
        const rows = await s`
          SELECT t.expires_at, t.used_at, u.email, u.name
          FROM tokens t JOIN users u ON u.id = t.user_id
          WHERE t.token = ${t} AND t.purpose = 'reset'`;
        const r = rows[0];
        if (!r) return res.status(404).json({ error: 'unknown_reset' });
        if (r.used_at) return res.status(410).json({ error: 'already_used' });
        if (new Date(r.expires_at) < new Date()) return res.status(410).json({ error: 'expired' });
        return res.status(200).json({ email: r.email, name: r.name });
      }

      case 'reset_accept': {
        const t = String(b.token || '');
        const pw = String(b.password || '');
        if (pw.length < 8) return res.status(400).json({ error: 'weak_password', message: 'Use at least 8 characters.' });
        const rows = await s`SELECT user_id, expires_at, used_at FROM tokens WHERE token = ${t} AND purpose = 'reset'`;
        const r = rows[0];
        if (!r) return res.status(404).json({ error: 'unknown_reset' });
        if (r.used_at) return res.status(410).json({ error: 'already_used' });
        if (new Date(r.expires_at) < new Date()) return res.status(410).json({ error: 'expired' });
        await s`UPDATE users SET password_hash = ${A.hashPassword(pw)} WHERE id = ${r.user_id}`;
        await s`UPDATE tokens SET used_at = now() WHERE token = ${t}`;
        await s`DELETE FROM sessions WHERE user_id = ${r.user_id}`;
        const u = (await s`SELECT * FROM users WHERE id = ${r.user_id}`)[0];
        await A.startSession(res, u.id);
        return res.status(200).json({ user: A.publicUser(u) });
      }

      // The public catalogue — what the landing page shows before anyone signs in.
      case 'catalogue': {
        const rows = await s`SELECT id, number, title, tagline, description, minutes, detail
                             FROM sims WHERE published = true ORDER BY number NULLS LAST, created_at`;
        // Resolved here rather than in the page, so the catalogue and the
        // administrator's editor are always looking at the same sentences.
        const sims = rows.map(present);
        return res.status(200).json({ sims });
      }

      default:
        return res.status(400).json({ error: 'unknown_action' });
    }
  } catch (e) {
    if (e.code === 'NO_DB') return res.status(503).json({ error: 'no_db', message: 'The database isn\'t configured on this deployment.' });
    console.error('auth failure', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
