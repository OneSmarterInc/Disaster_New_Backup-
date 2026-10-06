const crypto = require('crypto');
const { sql, id } = require('./db.js');

// ---------- passwords ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(pw), salt, 64, { N: 16384, r: 8, p: 1 });
  return 's2$' + salt.toString('base64url') + '$' + key.toString('base64url');
}

function verifyPassword(pw, stored) {
  if (!stored || !stored.startsWith('s2$')) return false;
  const [, s, k] = stored.split('$');
  const salt = Buffer.from(s, 'base64url');
  const expect = Buffer.from(k, 'base64url');
  const got = crypto.scryptSync(String(pw), salt, expect.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expect, got);
}

// ---------- cookies ----------
const COOKIE = 'fx_sess';

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function setSessionCookie(res, sid, days = 30) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=${encodeURIComponent(sid)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${days * 86400}`);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

// ---------- sessions ----------
async function startSession(res, userId, days = 30) {
  const s = sql();
  const sid = id('sess');
  const expires = new Date(Date.now() + days * 86400000);
  await s`INSERT INTO sessions (id, user_id, expires_at) VALUES (${sid}, ${userId}, ${expires})`;
  setSessionCookie(res, sid, days);
  return sid;
}

async function currentUser(req) {
  const sid = readCookie(req, COOKIE);
  if (!sid) return null;
  const s = sql();
  const rows = await s`
    SELECT u.* FROM sessions ses
    JOIN users u ON u.id = ses.user_id
    WHERE ses.id = ${sid} AND ses.expires_at > now() AND u.disabled = false`;
  return rows[0] || null;
}

async function endSession(req, res) {
  const sid = readCookie(req, COOKIE);
  if (sid) { try { await sql()`DELETE FROM sessions WHERE id = ${sid}`; } catch (e) {} }
  clearSessionCookie(res);
}

// ---------- guards ----------
async function requireUser(req, res) {
  const u = await currentUser(req);
  if (!u) { res.status(401).json({ error: 'not_signed_in' }); return null; }
  return u;
}

async function requireRole(req, res, ...roles) {
  const u = await requireUser(req, res);
  if (!u) return null;
  if (!roles.includes(u.role)) { res.status(403).json({ error: 'wrong_role' }); return null; }
  return u;
}

const publicUser = (u) => u && ({ id: u.id, email: u.email, name: u.name, role: u.role, institution: u.institution });

module.exports = {
  hashPassword, verifyPassword,
  startSession, currentUser, endSession,
  requireUser, requireRole, publicUser,
  readCookie, clearSessionCookie
};
