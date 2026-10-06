'use strict';
// One compare-and-set JSON document per room. Slots, assignments and final
// commitments change atomically, including two teammates pressing Commit at once.
const url = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL = 48 * 3600;
const key = code => `m04:sess:${code}`;
const courseKey = courseId => `m04:course:${Buffer.from(String(courseId)).toString('base64url')}`;
const courseReadyKey = index => `${index}:ready`;
function configured() { return !!(url() && token()); }
async function cmd(args) {
  if (!configured()) throw new Error('Session storage is not configured.');
  const response = await fetch(url(), {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token()}` },
    body: JSON.stringify(args), signal: AbortSignal.timeout(5000)
  });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(body.error || `Storage returned ${response.status}`);
  return body.result;
}
const CAS = `
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1
`;
const CREATE_WITH_COURSE_INDEX = `
if redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2], 'NX') then
  redis.call('SADD', KEYS[2], ARGV[3])
  redis.call('EXPIRE', KEYS[2], ARGV[2])
  return 1
end
return 0
`;

async function getSession(code) {
  const raw = await cmd(['GET', key(code)]);
  return raw ? JSON.parse(raw) : null;
}

async function backfillCourseIndex(courseId, index) {
  let cursor = '0';
  const found = new Set();
  do {
    const page = await cmd(['SCAN', cursor, 'MATCH', 'm04:sess:*', 'COUNT', '500']);
    if (!Array.isArray(page) || page.length < 2) throw new Error('Session index scan returned an invalid page.');
    cursor = String(page[0]);
    const keys = Array.isArray(page[1]) ? page[1] : [];
    const values = keys.length ? await cmd(['MGET', ...keys]) : [];
    for (let i = 0; i < keys.length; i++) {
      if (!values?.[i]) continue;
      try {
        const session = JSON.parse(values[i]);
        if (!session.solo && !session.practice && session.platformAuth && String(session.courseId) === String(courseId) &&
            session.state !== 'complete' && session.stage < 3) {
          found.add(keys[i].slice('m04:sess:'.length));
        }
      } catch {}
    }
  } while (cursor !== '0');
  if (found.size) await cmd(['SADD', index, ...found]);
  await cmd(['SET', courseReadyKey(index), '1', 'EX', String(TTL)]);
}

module.exports = {
  configured,
  getSession,
  async createSession(code, session) {
    if (!session.solo && !session.practice && session.platformAuth && session.courseId) {
      return Number(await cmd(['EVAL', CREATE_WITH_COURSE_INDEX, '2', key(code), courseKey(session.courseId),
        JSON.stringify(session), String(TTL), code])) === 1;
    }
    return (await cmd(['SET', key(code), JSON.stringify(session), 'EX', String(TTL), 'NX'])) === 'OK';
  },
  async courseSessions(courseId) {
    const index = courseKey(courseId);
    if (!(await cmd(['GET', courseReadyKey(index)]))) await backfillCourseIndex(courseId, index);
    const codes = await cmd(['SMEMBERS', index]) || [];
    const active = [];
    for (const code of Array.isArray(codes) ? codes : []) {
      const session = await getSession(code);
      if (!session || session.solo || session.practice || !session.platformAuth || String(session.courseId) !== String(courseId) ||
          session.state === 'complete' || session.stage >= 3) {
        await cmd(['SREM', index, code]);
        continue;
      }
      active.push({ code: session.code, name: session.name, mode: session.mode,
        state: session.state, stage: session.stage });
    }
    if (active.length) {
      await cmd(['EXPIRE', index, String(TTL)]);
      await cmd(['EXPIRE', courseReadyKey(index), String(TTL)]);
    }
    return active.sort((a, b) => String(a.name).localeCompare(String(b.name)) || a.code.localeCompare(b.code));
  },
  async compareAndSetSession(code, previous, next) {
    return Number(await cmd(['EVAL', CAS, '1', key(code), JSON.stringify(previous), JSON.stringify(next), String(TTL)])) === 1;
  }
};
