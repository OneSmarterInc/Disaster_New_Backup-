// Upstash/Vercel KV REST storage for RapidSim 07 sessions (48-hour expiry).
// W07_MEMORY_STORE=1 swaps in an in-process store for the dependency-free checks.
const URL_ = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOK_ = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const MEMORY = () => process.env.W07_MEMORY_STORE === '1';
const TTL = 60 * 60 * 48;
const J = (v) => { if (v == null) return null; try { return JSON.parse(v); } catch { return null; } };

const K = {
  sess: (c) => `w07:sess:${c}`,
  people: (c) => `w07:sess:${c}:p`,
  beat: (c) => `w07:sess:${c}:hb`
};

function configured() { return MEMORY() || !!(URL_() && TOK_()); }

async function cmd(args) {
  if (!configured()) { const e = new Error('Session storage is not configured.'); e.code = 'NO_STORE'; throw e; }
  const r = await fetch(URL_(), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOK_()}` },
    body: JSON.stringify(args)
  });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error || `KV error ${r.status}`);
  return d.result;
}

const CAS_SESSION = `
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1
`;
// Participant writes are compared against both the session and the record, so
// a decision cannot land on a session that closed or restarted mid-request.
const CAS_PARTICIPANT = `
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1] then return 0 end
if (redis.call('HGET', KEYS[2], ARGV[2]) or '') ~= ARGV[3] then return 0 end
redis.call('HSET', KEYS[2], ARGV[2], ARGV[4])
local ttl = redis.call('TTL', KEYS[1])
if ttl > 0 then redis.call('EXPIRE', KEYS[2], ttl) end
return 1
`;
const CAS_ROSTER = `
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1] then return 0 end
local count = tonumber(ARGV[2])
if redis.call('HLEN', KEYS[2]) ~= count then return 0 end
for i = 1, count do
  local o = 3 + (i - 1) * 3
  if (redis.call('HGET', KEYS[2], ARGV[o]) or '') ~= ARGV[o + 1] then return 0 end
end
for i = 1, count do
  local o = 3 + (i - 1) * 3
  redis.call('HSET', KEYS[2], ARGV[o], ARGV[o + 2])
end
return 1
`;

// ---- in-memory backend (tests only) ----
const mem = { kv: new Map(), h: new Map() };
const memApi = {
  async getSession(c) { return J(mem.kv.get(K.sess(c))); },
  async putSession(c, o) { mem.kv.set(K.sess(c), JSON.stringify(o)); return o; },
  async compareAndSetSession(c, prev, next) {
    if ((mem.kv.get(K.sess(c)) || '') !== JSON.stringify(prev)) return false;
    mem.kv.set(K.sess(c), JSON.stringify(next)); return true;
  },
  async getParticipants(c) {
    const h = mem.h.get(K.people(c)) || new Map(); const out = {};
    for (const [k, v] of h) out[k] = J(v); return out;
  },
  async compareAndSetParticipant(c, id, prev, next, sess) {
    if ((mem.kv.get(K.sess(c)) || '') !== JSON.stringify(sess)) return false;
    const h = mem.h.get(K.people(c)) || new Map(); mem.h.set(K.people(c), h);
    if ((h.get(id) || '') !== (prev ? JSON.stringify(prev) : '')) return false;
    h.set(id, JSON.stringify(next)); return true;
  },
  async compareAndSetRoster(c, prev, next, sess) {
    if ((mem.kv.get(K.sess(c)) || '') !== JSON.stringify(sess)) return false;
    const h = mem.h.get(K.people(c)) || new Map(); mem.h.set(K.people(c), h);
    const ids = Object.keys(prev);
    if (h.size !== ids.length) return false;
    for (const id of ids) if ((h.get(id) || '') !== JSON.stringify(prev[id])) return false;
    for (const id of ids) h.set(id, JSON.stringify(next[id]));
    return true;
  },
  async beat(c) { mem.kv.set(K.beat(c), String(Date.now())); },
  async lastBeat(c) { return Number(mem.kv.get(K.beat(c)) || 0); },
  async wipe(c) { mem.kv.delete(K.sess(c)); mem.kv.delete(K.beat(c)); mem.h.delete(K.people(c)); },
  _reset() { mem.kv.clear(); mem.h.clear(); }
};

// ---- Upstash backend ----
const kvApi = {
  async getSession(c) { return J(await cmd(['GET', K.sess(c)])); },
  async putSession(c, o) { await cmd(['SET', K.sess(c), JSON.stringify(o), 'EX', String(TTL)]); return o; },
  async compareAndSetSession(c, prev, next) {
    return Number(await cmd(['EVAL', CAS_SESSION, '1', K.sess(c), JSON.stringify(prev), JSON.stringify(next), String(TTL)])) === 1;
  },
  async getParticipants(c) {
    const flat = await cmd(['HGETALL', K.people(c)]) || [];
    const out = {};
    if (Array.isArray(flat)) for (let i = 0; i < flat.length; i += 2) out[flat[i]] = J(flat[i + 1]);
    else Object.entries(flat).forEach(([k, v]) => { out[k] = J(v); });
    return out;
  },
  async compareAndSetParticipant(c, id, prev, next, sess) {
    return Number(await cmd(['EVAL', CAS_PARTICIPANT, '2', K.sess(c), K.people(c),
      JSON.stringify(sess), id, prev ? JSON.stringify(prev) : '', JSON.stringify(next)])) === 1;
  },
  async compareAndSetRoster(c, prev, next, sess) {
    const entries = Object.entries(prev);
    return Number(await cmd(['EVAL', CAS_ROSTER, '2', K.sess(c), K.people(c), JSON.stringify(sess),
      String(entries.length), ...entries.flatMap(([id, p]) => [id, JSON.stringify(p), JSON.stringify(next[id])])])) === 1;
  },
  async beat(c) { await cmd(['SET', K.beat(c), String(Date.now()), 'EX', String(TTL)]); },
  async lastBeat(c) { return Number(await cmd(['GET', K.beat(c)]) || 0); },
  async wipe(c) { await cmd(['DEL', K.sess(c), K.people(c), K.beat(c)]); }
};

const pick = (name) => (...a) => (MEMORY() ? memApi : kvApi)[name](...a);
module.exports = {
  configured,
  getSession: pick('getSession'),
  putSession: pick('putSession'),
  compareAndSetSession: pick('compareAndSetSession'),
  getParticipants: pick('getParticipants'),
  compareAndSetParticipant: pick('compareAndSetParticipant'),
  compareAndSetRoster: pick('compareAndSetRoster'),
  beat: pick('beat'),
  lastBeat: pick('lastBeat'),
  wipe: pick('wipe'),
  _resetMemory: () => memApi._reset()
};
