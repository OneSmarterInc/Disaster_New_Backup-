'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/platform-launch.js'), 'utf8');

async function run(pathname, status, body) {
  let navigated = null, request = null;
  const context = vm.createContext({
    location: { pathname, replace: url => { navigated = url; } },
    URLSearchParams, AbortSignal,
    fetch: async (url, options) => {
      request = { url, options };
      return { status, ok: status >= 200 && status < 300, json: async () => body };
    }
  });
  vm.runInContext(source, context, { filename: 'platform-launch.js' });
  const result = await context.platformLaunch('rapid-04-whose-number');
  return { result, navigated, request };
}

(async () => {
  const success = await run('/sim04/launch.html', 200, { url: 'https://rapidsims.flexee.org/sim04/index.html#lt=signed-token' });
  assert.equal(success.result.status, 'launched');
  assert.equal(success.navigated, 'https://rapidsims.flexee.org/sim04/index.html#lt=signed-token');
  assert.equal(success.request.url, '/api/launch?sim=rapid-04-whose-number&format=json');
  assert.equal(success.request.options.credentials, 'same-origin');

  const signedOut = await run('/sim04/launch.html', 401, { error: 'not_signed_in' });
  assert.equal(signedOut.result.status, 'signed_out');

  const notEntitled = await run('/sim04/launch.html', 403, { message: 'Not enrolled' });
  assert.deepEqual({ status: notEntitled.result.status, message: notEntitled.result.message }, {
    status: 'not_entitled', message: 'Not enrolled'
  });

  const external = await run('/launch.html', 200, { url: 'unused' });
  assert.equal(external.result.status, 'skip');
  assert.equal(external.request, null, 'standalone Sim04 domain does not call the platform API');
  console.log('PASS Sim04 platform launch: account handoff, signed-out fallback, entitlement message, and standalone domain');
})().catch(error => { console.error(error); process.exit(1); });
