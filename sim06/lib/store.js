'use strict';
// Upstash/Vercel KV REST storage for Sim-06 sessions. Keys expire after 48 hours.
// Every write that can race is a compare-and-set in one Lua call; callers retry on false.
const URL_ = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOK_ = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

function configured() { return !!(URL_() && TOK_()); }

async function cmd(args) {
  if (!configured()) { const e = new Error('Session storage is not configured.'); e.code = 'NO_STORE'; throw e; }
  const r = await fetch(URL_(), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOK_()}` },
    body: JSON.stringify(args),
  });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error || `KV error ${r.status}`);
  return d.result;
}

const TTL = 60 * 60 * 48;
const J = v => { try { return JSON.parse(v); } catch { return null; } };
const K = code => `m06:sess:${code}`;

async function hgetall(key) {
  const flat = await cmd(['HGETALL', key]) || [];
  const out = {};
  if (Array.isArray(flat)) for (let i = 0; i < flat.length; i += 2) out[flat[i]] = J(flat[i + 1]);
  else Object.entries(flat).forEach(([k, v]) => { out[k] = J(v); });
  return out;
}

const CAS_SESSION = `
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1
`;

// Hash-field compare-and-set, guarded by the session still existing unchanged-or-open.
// Used for participants and for runs. An empty ARGV[2] means "field must not exist yet",
// which is what makes a team's first Switch/Stay press win.
const CAS_FIELD = `
if not redis.call('GET', KEYS[1]) then return 0 end
if (redis.call('HGET', KEYS[2], ARGV[1]) or '') ~= ARGV[2] then return 0 end
redis.call('HSET', KEYS[2], ARGV[1], ARGV[3])
redis.call('EXPIRE', KEYS[2], ARGV[4])
return 1
`;

module.exports = {
  configured,
  async getSession(code) { return J(await cmd(['GET', K(code)])); },
  async putSession(code, obj) { await cmd(['SET', K(code), JSON.stringify(obj), 'EX', String(TTL)]); return obj; },
  async compareAndSetSession(code, previous, next) {
    return Number(await cmd(['EVAL', CAS_SESSION, '1', K(code),
      JSON.stringify(previous), JSON.stringify(next), String(TTL)])) === 1;
  },
  async getParticipants(code) { return hgetall(`${K(code)}:p`); },
  async compareAndSetParticipant(code, id, previous, next) {
    return Number(await cmd(['EVAL', CAS_FIELD, '2', K(code), `${K(code)}:p`,
      id, previous ? JSON.stringify(previous) : '', JSON.stringify(next), String(TTL)])) === 1;
  },
  async getParticipant(code, id) { return J(await cmd(['HGET', `${K(code)}:p`, id])); },
  async getRun(code, runId) { return J(await cmd(['HGET', `${K(code)}:run`, runId])); },
  async getRuns(code) { return hgetall(`${K(code)}:run`); },
  async compareAndSetRun(code, runId, previous, next) {
    return Number(await cmd(['EVAL', CAS_FIELD, '2', K(code), `${K(code)}:run`,
      runId, previous ? JSON.stringify(previous) : '', JSON.stringify(next), String(TTL)])) === 1;
  },
  async wipe(code) { await cmd(['DEL', K(code), `${K(code)}:p`, `${K(code)}:run`]); },
};
