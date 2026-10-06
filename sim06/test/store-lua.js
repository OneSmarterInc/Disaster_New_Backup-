'use strict';
// Runs lib/store.js against a real Lua-capable Redis (fakeredis shim) to prove the
// compare-and-set scripts: first press wins, stale writes lose, sessions gate writes.
const assert = require('assert');
process.env.KV_REST_API_URL = process.env.KV_TEST_URL || 'http://127.0.0.1:8799';
process.env.KV_REST_API_TOKEN = 'x';
const s = require('../lib/store.js');
(async () => {
  const code = 'TEST' + Math.floor(Math.random() * 9);
  await s.wipe(code);
  assert.strictEqual(await s.compareAndSetRun(code, 'r', null, { a: 1 }), false, 'no write without a session');
  const sess = { code, startedAt: null };
  await s.putSession(code, sess);
  assert.strictEqual(await s.compareAndSetSession(code, { code, startedAt: 1 }, { x: 1 }), false, 'stale session loses');
  assert.strictEqual(await s.compareAndSetSession(code, sess, { ...sess, startedAt: 5 }), true);
  const run = { runId: 'r', decision: null };
  assert.strictEqual(await s.compareAndSetRun(code, 'r', null, run), true, 'create');
  assert.strictEqual(await s.compareAndSetRun(code, 'r', null, run), false, 'create twice loses');
  const results = await Promise.all([
    s.compareAndSetRun(code, 'r', run, { ...run, decision: { choice: 'switch' } }),
    s.compareAndSetRun(code, 'r', run, { ...run, decision: { choice: 'stay' } }),
  ]);
  assert.deepStrictEqual(results.sort(), [false, true], 'exactly one press wins');
  assert.ok((await s.getRuns(code)).r.decision);
  assert.strictEqual(await s.compareAndSetParticipant(code, 'p', null, { id: 'p' }), true);
  assert.deepStrictEqual(await s.getParticipants(code), { p: { id: 'p' } });
  assert.deepStrictEqual(await s.getParticipant(code, 'p'), { id: 'p' });
  assert.strictEqual(await s.getParticipant(code, 'missing'), null);
  assert.strictEqual((await s.getRun(code, 'r')).runId, 'r');
  await s.wipe(code);
  console.log('store Lua checks passed');
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
