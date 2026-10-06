#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const cases = [
  ['sim/api/health.js', 'rapid-01-disaster'],
  ['sim-02/api/health.js', 'rapid-02-relay'],
  ['sim-plus-01/api/health.js', 'rapidsimplus-01'],
  ['sim03/api/health.js', 'rapid-03-midland'],
  ['sim04/api/health.js', 'rapid-04-whose-number'],
  ['sim05/api/health.js', 'rapid-05-approve'],
  ['sim06/api/health.js', 'rapid-06-switch'],
  ['sim07/api/health.js', 'rapid-07-bought'],
  ['sim08/api/health.js', 'rapid-08-later'],
  ['sim09/api/health.js', 'rapid-09-money-land'],
  ['sim10/lib/health.js', 'rapid-10-bubble'],
  ['simplus02/api/health.js', 'rapidsimplus-02'],
  ['platform/api/health.js', 'flexee-platform']
];

process.env.HEALTH_SECRET = 'health-secret-for-test';
process.env.LAUNCH_SECRET = 'launch-secret-for-test';
process.env.ACCESS_CODE = 'access-code-for-test';
process.env.ANTHROPIC_API_KEY = 'model-key-for-test';
process.env.PLATFORM_URL = 'https://platform.example.test';
process.env.SIM_URL = 'https://sim.example.test';
process.env.KV_REST_API_URL = 'https://kv.example.test';
process.env.KV_REST_API_TOKEN = 'kv-token-for-test';
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'redis-token-for-test';

function invoke(handler, req) {
  return new Promise((resolve, reject) => {
    let statusCode = 200;
    const headers = {};
    const res = {
      setHeader(k, v) { headers[String(k).toLowerCase()] = v; },
      status(n) { statusCode = n; return this; },
      writeHead(n, values) { statusCode = n; for (const [k,v] of Object.entries(values)) this.setHeader(k,v); return this; },
      json(body) { resolve({ statusCode, headers, body }); return this; },
      end(raw) { resolve({ statusCode, headers, body: raw ? JSON.parse(raw) : null }); return this; }
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

(async () => {
  let networkCalls = 0;
  global.fetch = async () => { networkCalls++; throw new Error('Health must not call external services or register simulations'); };
  for (const [rel, sim] of cases) {
    const abs = path.join(__dirname, '..', rel);
    const source = fs.readFileSync(abs, 'utf8');
    assert(!source.includes('req.query'), `${rel}: health secret must never be accepted from a query string`);
    assert(!source.includes('announce('), `${rel}: health endpoint must be side-effect free`);
    assert(source.includes('HEALTH_SECRET'), `${rel}: dedicated HEALTH_SECRET missing`);
    assert(source.includes("req.headers['x-health-key']"), `${rel}: x-health-key header check missing`);

    delete require.cache[require.resolve(abs)];
    const handler = rel === 'sim10/lib/health.js' ? require('../sim10/lib/app').createApp() : require(abs);
    const publicBody = rel.startsWith('platform/') ? { ok: true, service: sim } : { ok: true, sim };
    const request = input => ({ method: 'GET', url: '/api/health', ...input });

    const publicResponse = await invoke(handler, request({ headers: {}, query: {} }));
    assert.equal(publicResponse.statusCode, 200, `${rel}: public health must stay usable for liveness probes`);
    assert.deepStrictEqual(publicResponse.body, publicBody, `${rel}: public response leaks diagnostics`);
    assert.equal(publicResponse.headers['cache-control'], 'no-store, max-age=0, must-revalidate');

    const queryAttempt = await invoke(handler, request({ url: '/api/health?key=' + encodeURIComponent(process.env.HEALTH_SECRET), headers: {}, query: { key: process.env.HEALTH_SECRET } }));
    assert.deepStrictEqual(queryAttempt.body, publicBody, `${rel}: query-string health key authorized diagnostics`);

    const launchSecretAttempt = await invoke(handler, request({ headers: { 'x-health-key': process.env.LAUNCH_SECRET }, query: {} }));
    assert.deepStrictEqual(launchSecretAttempt.body, publicBody, `${rel}: LAUNCH_SECRET was reused as health authorization`);

    const privateResponse = await invoke(handler, request({ headers: { 'x-health-key': process.env.HEALTH_SECRET }, query: {} }));
    assert.equal(privateResponse.body.sim || privateResponse.body.service, sim);
    assert.equal(privateResponse.body.diagnostic, true, `${rel}: protected diagnostics unavailable`);
    const serialized = JSON.stringify(privateResponse.body);
    for (const secret of [
      process.env.HEALTH_SECRET,
      process.env.LAUNCH_SECRET,
      process.env.ACCESS_CODE,
      process.env.ANTHROPIC_API_KEY,
      process.env.KV_REST_API_TOKEN,
      process.env.UPSTASH_REDIS_REST_TOKEN
    ]) {
      assert(!serialized.includes(secret), `${rel}: secret value leaked in diagnostic response`);
    }
  }

  assert.equal(networkCalls, 0, 'health probes must be read-only and must not register simulations');
  console.log('All twelve simulation health endpoints and the platform protect diagnostics.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
