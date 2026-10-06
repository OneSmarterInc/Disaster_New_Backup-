// Exercise real config/guard/launch modules with delayed platform responses.
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');

const originalFetch = global.fetch;
const savedEnv = { ...process.env };
const tick = () => new Promise(resolve => setImmediate(resolve));
let assertions = 0;
function check(value, message) { assert.ok(value, message); assertions++; }

function call(handler, headers = {}) {
  const response = { statusCode: null, body: null, headers: {} };
  const res = {
    status(code) { response.statusCode = code; return this; },
    json(body) { response.body = body; return this; },
    setHeader(name, value) { response.headers[name] = value; }, end() { return this; }
  };
  return { response, done: handler({ method: 'GET', headers, query: {} }, res) };
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', process.env.LAUNCH_SECRET)
    .update(body).digest('base64url');
}

(async () => {
  process.env.LAUNCH_SECRET = 'registration-test-secret';
  process.env.PLATFORM_URL = 'https://platform.test';
  process.env.ACCESS_CODE = 'standalone-test';
  for (const [number, id] of [['07', 'rapid-07-bought'], ['08', 'rapid-08-later'], ['09', 'rapid-09-money-land']]) {
    const root = path.resolve(__dirname, '../../sim' + number);
    process.env.SIM_URL = 'https://platform.test/sim' + number;
    for (const failFirst of [false, true]) {
      for (const key of Object.keys(require.cache)) {
        if (key.startsWith(root + path.sep)) delete require.cache[key];
      }
      const requests = [];
      global.fetch = (url, options) => new Promise(resolve => requests.push({ url, options, resolve }));
      const handler = require(root + '/api/config.js');
      const first = call(handler);
      await tick();
      check(requests.length === 1, id + ': one announcement started');
      check(first.response.statusCode === null, id + ': response waits for registration');
      const request = requests[0];
      check(request.url === 'https://platform.test/api/register', id + ': correct platform endpoint');
      const token = JSON.parse(request.options.body).token;
      const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url'));
      check(token === sign(payload), id + ': registration is signed');
      check(payload.kind === 'register' && payload.sim === id && payload.launchUrl === process.env.SIM_URL,
        id + ': correct catalogue identity and canonical URL');
      request.resolve({ ok: !failFirst, status: failFirst ? 503 : 200, text: async () => 'test refusal' });
      await first.done;
      check(first.response.statusCode === 401 && first.response.body.error === 'access_code_required',
        id + ': registration never bypasses standalone access');
      if (number === '09') check(first.response.headers['X-Catalogue-Registration'] === (failFirst ? 'failed' : 'registered'),
        id + ': access gate reports registration outcome without exposing secrets');
      check(requests.length === 1, id + ': failed attempt is not restarted within the same request');

      const launch = sign({ sim: id, sub: 'test-student', role: 'student', exp: Date.now() + 60000 });
      const second = call(handler, { 'x-launch-token': launch });
      await tick();
      check(requests.length === (failFirst ? 2 : 1), id + ': failure retries; success is cached');
      if (failFirst) {
        check(second.response.statusCode === null, id + ': response waits for retry');
        requests[1].resolve({ ok: true });
      }
      await second.done;
      check(second.response.statusCode === 200, id + ': signed student still enters without access code');
      if (number === '09') check(second.response.headers['X-Catalogue-Registration'] === 'registered', id + ': successful retry confirms registration');
    }
  }
  console.log('Registration checks passed: ' + assertions + ' assertions');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  global.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  Object.assign(process.env, savedEnv);
});
