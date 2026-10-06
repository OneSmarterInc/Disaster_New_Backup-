'use strict';
// Upstash Redis over REST, command form (POST ["CMD", ...args] to the root URL), 30-day TTL.
// Three kinds of key per session: the session, the roster, and one key per table,
// so four seats writing one table never contend with other tables.
const TTL = 30 * 24 * 3600;
const URL_ = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

// Compare-and-set: write only if the stored JSON still equals what the caller read.
const CAS = `local cur = redis.call('GET', KEYS[1])
if (cur == false and ARGV[1] == '') or cur == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3]) return 1 end
return 0`;

async function cmd(...args) {
  const r = await fetch(URL_(), {
    method: 'POST', headers: { authorization: `Bearer ${TOKEN()}`, 'content-type': 'application/json' },
    body: JSON.stringify(args), signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`store ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

const k = {
  session: c => `wire:${c}`,
  roster: c => `wire:${c}:roster`,
  table: (c, t) => `wire:${c}:t:${t}`,
  course: c => `wire:course:${c}`,
  report: (c, p) => `wire:${c}:report:${p}`,
};
const ser = v => (v === null || v === undefined) ? '' : JSON.stringify(v);

const store = {
  configured: () => Boolean(URL_() && TOKEN()),
  async get(key) { const raw = await cmd('GET', key); return raw ? JSON.parse(raw) : null; },
  async cas(key, prev, next) { return (await cmd('EVAL', CAS, 1, key, ser(prev), ser(next), TTL)) === 1; },
  async getMany(keys) { if (!keys.length) return []; const raws = await cmd('MGET', ...keys); return raws.map(r => r ? JSON.parse(r) : null); },
};

module.exports = { store, keys: k };
