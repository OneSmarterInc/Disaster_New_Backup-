'use strict';
const assert = require('node:assert/strict');
const store = require('../lib/store');

const oldFetch = global.fetch;
const oldEnv = { ...process.env };
const calls = [], records = new Map(), removed = [], indexedCodes = [], expiries = [];
const indexKey = 'm04:course:Y291cnNlLTA0';
const readyKey = indexKey + ':ready';
let ready = false;
Object.assign(process.env, {
  KV_REST_API_URL: 'https://redis.test', KV_REST_API_TOKEN: 'test-token'
});

global.fetch = async (url, options) => {
  const args = JSON.parse(options.body);
  calls.push(args);
  let result = null;
  if (args[0] === 'EVAL') {
    result = 1;
    records.set(args[3], JSON.parse(args[5]));
    if (!indexedCodes.includes(args[7])) indexedCodes.push(args[7]);
  } else if (args[0] === 'SMEMBERS') result = indexedCodes.slice();
  else if (args[0] === 'GET') result = args[1] === readyKey ? (ready ? '1' : null)
    : records.has(args[1]) ? JSON.stringify(records.get(args[1])) : null;
  else if (args[0] === 'SCAN') result = ['0', [...records.keys(), 'm04:sess:MISS1']];
  else if (args[0] === 'MGET') result = args.slice(1).map(key => records.has(key) ? JSON.stringify(records.get(key)) : null);
  else if (args[0] === 'SADD') { for (const code of args.slice(2)) if (!indexedCodes.includes(code)) indexedCodes.push(code); result = indexedCodes.length; }
  else if (args[0] === 'SET') { ready = args[1] === readyKey; result = 'OK'; }
  else if (args[0] === 'SREM') { removed.push(args[2]); result = 1; }
  else if (args[0] === 'EXPIRE') { expiries.push(args[1]); result = 1; }
  else throw new Error('Unexpected Redis command: ' + args[0]);
  return { ok: true, status: 200, json: async () => ({ result }) };
};

(async () => {
  const active = { code: 'ABCDE', name: 'Monday class', platformAuth: true, courseId: 'course-04',
    mode: 'team', state: 'lobby', stage: 0 };
  assert.equal(await store.createSession(active.code, active), true);
  const create = calls[0];
  assert.equal(create[0], 'EVAL');
  assert.equal(create[2], '2');
  assert.equal(create[3], 'm04:sess:ABCDE');
  assert.equal(create[4], 'm04:course:Y291cnNlLTA0');
  assert.equal(records.get('m04:sess:ABCDE').name, 'Monday class');

  records.set('m04:sess:ZZZZ2', { code: 'ZZZZ2', name: 'Other course', platformAuth: true,
    courseId: 'another-course', mode: 'team', state: 'lobby', stage: 0 });
  records.set('m04:sess:DONE1', { code: 'DONE1', name: 'Finished class', platformAuth: true,
    courseId: 'course-04', mode: 'individual', state: 'complete', stage: 3 });
  indexedCodes.push('ZZZZ2', 'DONE1', 'MISS1');
  const sessions = await store.courseSessions('course-04');
  assert.deepEqual(sessions, [{ code: 'ABCDE', name: 'Monday class', mode: 'team', state: 'lobby', stage: 0 }]);
  assert.deepEqual(removed.sort(), ['DONE1', 'MISS1', 'ZZZZ2']);
  assert(calls.some(args => args[0] === 'SCAN'), 'pre-deploy sessions are backfilled once');
  assert(expiries.includes(indexKey) && expiries.includes(readyKey));
  const practice = { code: 'PRACT', name: 'Practice room', platformAuth: true, courseId: 'course-04',
    mode: 'team', state: 'lobby', stage: 0, practice: true };
  await store.createSession(practice.code, practice);
  assert(!indexedCodes.includes('PRACT'), 'a faculty practice room is never added to the course index');
  assert(!(await store.courseSessions('course-04')).some(s => s.code === 'PRACT'), 'and never listed');
  console.log('PASS Sim04 room index: atomic creation, legacy backfill, course isolation, practice rooms hidden, and stale cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  global.fetch = oldFetch;
  for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key];
  Object.assign(process.env, oldEnv);
});
