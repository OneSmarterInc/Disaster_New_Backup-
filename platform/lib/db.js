const { neon } = require('@neondatabase/serverless');

let _sql = null;
function sql() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) { const e = new Error('DATABASE_URL is not set'); e.code = 'NO_DB'; throw e; }
  _sql = neon(url);
  return _sql;
}

const crypto = require('crypto');
const id = (p) => p + '_' + crypto.randomBytes(9).toString('base64url');

// Human-friendly course join codes, no ambiguous characters.
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const joinCode = () => Array.from({ length: 6 }, () => CHARS[crypto.randomInt(CHARS.length)]).join('');

module.exports = { sql, id, joinCode };
