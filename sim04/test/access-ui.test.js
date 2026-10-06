'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const launchHtml = fs.readFileSync(path.join(__dirname, '../public/launch.html'), 'utf8');
const launch = launchHtml.match(/<script>([\s\S]*?)<\/script>/)[1];
const entryHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const entryRedirect = entryHtml.match(/<script id="account-entry-redirect">([\s\S]*?)<\/script>/)[1];

function redirect(search = '', hash = '', hostname = 'sim04.vercel.app') {
  let destination;
  vm.runInNewContext(entryRedirect, {
    location: { search, hash, hostname, replace(url) { destination = url; } }, URLSearchParams
  });
  return destination;
}

async function launchPage(pathname, search = '', hash = '') {
  const elements = new Map(); let destination;
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      hidden: id === 'gate', value: '', textContent: '', disabled: false,
      focus() {}, addEventListener() {}
    });
    return elements.get(id);
  };
  const storage = new Map();
  const fetch = async () => ({ ok: true, json: async () => ({}) });
  vm.runInNewContext(launch, {
    location: { pathname, search, hash, replace(url) { destination = url; } },
    document: { getElementById: element },
    sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    URLSearchParams, atob: s => Buffer.from(s, 'base64').toString('binary'), fetch
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  return { element, storage, destination: () => destination };
}

(async () => {
  assert.equal(redirect(), 'https://rapidsims.flexee.org/open.html?sim=rapid-04-whose-number');
  assert.equal(redirect('?session=ABCDE&course=c1'),
    'https://rapidsims.flexee.org/open.html?sim=rapid-04-whose-number&session=ABCDE&course=c1');
  assert.equal(redirect('?guest=1'), undefined, 'guest resumes without another account check');
  assert.equal(redirect('', '#lt=signed-token'), undefined, 'signed student stays in the sim');
  assert.equal(redirect('', '', 'localhost'), undefined);
  assert.match(entryHtml, /id="joinForm"[^>]+hidden/, 'room-code form is hidden on signed student entry');
  assert.match(launchHtml, /id="gate" hidden/, 'access-code gate starts hidden while account is checked');

  const direct = await launchPage('/launch.html');
  assert.equal(direct.destination(), 'https://rapidsims.flexee.org/open.html?sim=rapid-04-whose-number');
  const guest = await launchPage('/sim04/launch.html', '?guest=1');
  assert.equal(guest.element('gate').hidden, false, 'guest sees the access-code gate');
  guest.element('code').value = 'test-student-code';
  await guest.element('open').onclick();
  assert.equal(guest.destination(), '/sim04/index.html?guest=1');
  assert.equal(guest.storage.get('m04-access'), 'test-student-code');
  console.log('PASS Sim04 entry: signed students skip codes; guests keep access and room codes');
})().catch(error => { console.error(error); process.exit(1); });
