const assert = require('assert');
const { signBack } = require('../lib/launch.js');
const handler = require('../api/config.js');

function invoke(headers = {}) {
  const req = { method: 'GET', headers };
  const res = {
    statusCode: 200,
    payload: null,
    headers: {},
    status(n) { this.statusCode = n; return this; },
    json(v) { this.payload = v; return v; },
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; },
    end() { return null; }
  };
  return Promise.resolve(handler(req, res)).then(() => res);
}

(async () => {
  const old = {
    ACCESS_CODE: process.env.ACCESS_CODE,
    LAUNCH_SECRET: process.env.LAUNCH_SECRET,
    PLATFORM_URL: process.env.PLATFORM_URL,
    SIM_URL: process.env.SIM_URL
  };
  try {
    process.env.LAUNCH_SECRET = 'midland-test-secret';
    delete process.env.PLATFORM_URL;
    delete process.env.SIM_URL;
    delete process.env.ACCESS_CODE;

    let r = await invoke();
    assert.equal(r.statusCode, 503, 'direct access must fail closed when ACCESS_CODE is not configured');
    assert.equal(r.payload.error, 'access_code_not_configured');

    const tokenWithoutCode = signBack({
      sub: 'usr_student', sim: 'rapid-03-midland', role: 'student',
      iat: Date.now(), exp: Date.now() + 60000
    });
    r = await invoke({ 'x-launch-token': tokenWithoutCode });
    assert.equal(r.statusCode, 200, 'platform launch token must work even before standalone ACCESS_CODE is configured');

    process.env.ACCESS_CODE = 'midland-test-code';

    r = await invoke();
    assert.equal(r.statusCode, 401, 'direct config access without code must be refused');
    assert.equal(r.payload.error, 'access_code_required');

    r = await invoke({ 'x-access-code': 'wrong' });
    assert.equal(r.statusCode, 401, 'wrong access code must be refused');

    r = await invoke({ 'x-access-code': 'midland-test-code' });
    assert.equal(r.statusCode, 200, 'correct access code must unlock standalone config');
    assert.ok(r.payload && Array.isArray(r.payload.lines), 'config should be returned after access');

    const token = signBack({
      sub: 'usr_student', sim: 'rapid-03-midland', role: 'student',
      iat: Date.now(), exp: Date.now() + 60000
    });
    r = await invoke({ 'x-launch-token': token });
    assert.equal(r.statusCode, 200, 'valid platform launch token must bypass standalone access code');

    const wrongSim = signBack({
      sub: 'usr_student', sim: 'rapid-02', role: 'student',
      iat: Date.now(), exp: Date.now() + 60000
    });
    r = await invoke({ 'x-launch-token': wrongSim });
    assert.equal(r.statusCode, 403, 'a launch token for another sim must remain unusable');

    console.log('RapidSim 03 access-code checks passed.');
  } finally {
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
