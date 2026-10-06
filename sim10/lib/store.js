'use strict';
// Minimal key-value interface. Values are JSON. TTL 30 days on every write.
const TTL = 60 * 60 * 24 * 30;

function memoryStore() {
  const kv = new Map();
  const sets = new Map();
  return {
    kind: 'memory',
    async get(k) { return kv.has(k) ? JSON.parse(kv.get(k)) : null; },
    async set(k, v) { kv.set(k, JSON.stringify(v)); },
    async setnx(k, v) { if (kv.has(k)) return false; kv.set(k, JSON.stringify(v)); return true; },
    async compareAndSet(k, expected, next) {
      if ((kv.get(k) || null) !== (expected === null ? null : JSON.stringify(expected))) return false;
      kv.set(k, JSON.stringify(next)); return true;
    },
    async mget(keys) { return keys.map((k) => (kv.has(k) ? JSON.parse(kv.get(k)) : null)); },
    async sadd(k, m) { if (!sets.has(k)) sets.set(k, new Set()); sets.get(k).add(m); },
    async smembers(k) { return [...(sets.get(k) || [])]; },
  };
}

function upstashStore(url, token) {
  async function cmd(args) {
    const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    if (!res.ok) throw new Error(`store ${args[0]} failed: ${res.status}`);
    const body = await res.json();
    if (body.error) throw new Error(`store ${args[0]}: ${body.error}`);
    return body.result;
  }
  return {
    kind: 'upstash',
    async get(k) { const r = await cmd(['GET', k]); return r == null ? null : JSON.parse(r); },
    async set(k, v) { await cmd(['SET', k, JSON.stringify(v), 'EX', String(TTL)]); },
    async setnx(k, v) { const r = await cmd(['SET', k, JSON.stringify(v), 'NX', 'EX', String(TTL)]); return r === 'OK'; },
    async compareAndSet(k, expected, next) {
      const script = "local old = redis.call('GET', KEYS[1]); if (not old and ARGV[1] == '') or old == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3]); return 1 end; return 0";
      return Number(await cmd(['EVAL', script, '1', k, expected === null ? '' : JSON.stringify(expected), JSON.stringify(next), String(TTL)])) === 1;
    },
    async mget(keys) { if (!keys.length) return []; const r = await cmd(['MGET', ...keys]); return r.map((x) => (x == null ? null : JSON.parse(x))); },
    async sadd(k, m) { await cmd(['SADD', k, m]); await cmd(['EXPIRE', k, String(TTL)]); },
    async smembers(k) { return (await cmd(['SMEMBERS', k])) || []; },
  };
}

let shared = null;
function defaultStore() {
  if (shared && (shared.kind !== 'memory' || (!process.env.VERCEL && process.env.DEV_OPEN === '1'))) return shared;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) shared = upstashStore(url, token);
  else if (!process.env.VERCEL && process.env.DEV_OPEN === '1') shared = memoryStore();
  else return null;
  return shared;
}

module.exports = { memoryStore, upstashStore, defaultStore };
