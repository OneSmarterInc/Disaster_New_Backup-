'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const sims = {
  sim: 'rapid-01-disaster', 'sim-02': 'rapid-02-relay',
  'sim-plus-01': 'rapidsimplus-01', sim03: 'rapid-03-midland',
  sim04: 'rapid-04-whose-number', sim05: 'rapid-05-approve',
  sim06: 'rapid-06-switch', sim07: 'rapid-07-bought',
  sim08: 'rapid-08-later', sim09: 'rapid-09-money-land',
  sim10: 'rapid-10-bubble', simplus02: 'rapidsimplus-02'
};
const html = fs.readFileSync(path.join(root, 'platform/public/open.html'), 'utf8');
assert.match(html, /id="message"/);
assert.match(html, /src="\/open.js"/);
const script = fs.readFileSync(path.join(root, 'platform/public/open.js'), 'utf8');
async function open(sim, status, data = {}, extra = '') {
  let destination, request;
  const elements = { message: { textContent: '' }, next: { hidden: true } };
  vm.runInNewContext(script, {
    location: { search: '?sim=' + encodeURIComponent(sim) + extra, replace: url => { destination = url; } },
    document: { getElementById: id => elements[id] }, URLSearchParams, AbortSignal,
    fetch: async (url, options) => {
      request = { url, options };
      return { ok: status === 200, status, json: async () => data };
    }
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  return { destination, request, elements };
}
(async () => {
  for (const [folder, sim] of Object.entries(sims)) {
    const source = fs.readFileSync(path.join(root, folder, 'public/index.html'), 'utf8');
    const guard = source.match(/<script id="account-entry-redirect">([\s\S]*?)<\/script>/)?.[1];
    assert(guard, `${folder} guards direct index links`);
    let destination;
    const run = (search = '', hash = '') => {
      destination = undefined;
      vm.runInNewContext(guard, {
        location: { search, hash, hostname: folder + '.vercel.app', replace: url => { destination = url; } },
        URLSearchParams
      });
      return destination;
    };
    assert.equal(run(), `https://rapidsims.flexee.org/open.html?sim=${sim}`, folder);
    assert.equal(run('?guest=1'), undefined, `${folder} guest can continue`);
    assert.equal(run('', '#lt=signed-token'), undefined, `${folder} signed launch can continue`);
    assert.equal((await open(sim, 200, { url: `/signed/${sim}#lt=token` })).destination,
      `/signed/${sim}#lt=token`, `${folder} entitled launch`);
    const denied = await open(sim, 403, { message: 'Not registered for this simulation' });
    assert.equal(denied.destination, undefined, `${folder} denied account stays on notice`);
    assert.match(denied.elements.message.textContent, /Not registered/);
    const guest = await open(sim, 401);
    assert.match(guest.destination, new RegExp('^/' + (folder === 'sim' ? 'sim01' : folder === 'sim-02' ? 'sim02' : folder === 'sim-plus-01' ? 'simplus01' : folder) + '/'));
    assert.match(guest.destination, /guest=1$/, `${folder} guest access code`);
    assert.equal(guest.request.options.credentials, 'same-origin');
  }
  const invitation = await open('rapid-04-whose-number', 401, {}, '&session=ABCDE&course=course-1');
  assert.equal(invitation.destination,
    '/session.html?sim=rapid-04-whose-number&session=ABCDE&course=course-1');
  const outage = await open('rapid-04-whose-number', 503);
  assert.equal(outage.destination, undefined, 'a backend outage is never interpreted as a guest');
  console.log(`PASS direct entry for all ${Object.keys(sims).length} sims: entitled, denied, guest, invitation, unavailable`);
})().catch(error => { console.error(error); process.exitCode = 1; });
