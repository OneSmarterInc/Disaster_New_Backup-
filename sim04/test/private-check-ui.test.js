'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.join(__dirname, '../public', file), 'utf8');
function surface() {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      hidden: false, value: '', textContent: '', children: [],
      style: {}, classList: { toggle() {} }, addEventListener() {},
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; }
    });
    return elements.get(id);
  };
  return { element, document: { getElementById: element,
    createElement: () => element('new-' + elements.size) } };
}
const storage = values => ({ getItem: key => values.get(key) || null,
  setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) });

(async () => {
  const token = 'signed-faculty-token';
  const consolePage = surface();
  const context = {
    document: consolePage.document,
    location: { pathname: '/sim04/instructor.html', search: '', hash: '#lt=' + token },
    sessionStorage: storage(new Map()), URLSearchParams,
    fetch: async () => ({ ok: true, json: async () => ({ ok: true }) }),
    setInterval() {}
  };
  vm.createContext(context);
  vm.runInContext(read('instructor.js'), context);
  vm.runInContext(`draw({session:{code:'ABCDE',state:'lobby',stage:0,mode:'team',clockMinutes:25},
    projector:{clock:{remaining:null},groups:[],unassigned:[]}})`, context);
  const link = new URL(consolePage.element('privateCheck').href, 'https://platform.test/sim04/instructor.html');
  assert.equal(link.searchParams.get('session'), 'ABCDE');
  assert.equal(new URLSearchParams(link.hash.slice(1)).get('lt'), token,
    'a new tab with noopener has no inherited session storage; the faculty token must survive');
  assert.equal(link.searchParams.has('lt'), false, 'credentials stay out of the request query');

  const checkPage = surface(), requests = [];
  vm.runInNewContext(read('private-check.js'), {
    document: checkPage.document,
    location: { pathname: link.pathname, search: link.search, hash: link.hash },
    sessionStorage: storage(new Map()), URLSearchParams,
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => ({ checks: { groups: [{label:'Team 1',status:'none',members:['a@school.edu']}], unassigned: [] } }) };
    }
  });
  assert.equal(checkPage.element('facultyField').hidden, true);
  await checkPage.element('check').onclick();
  assert.equal(requests[0].url, '/sim04/api/session');
  assert.equal(requests[0].options.headers['x-launch-token'], token);
  assert.equal(JSON.parse(requests[0].options.body).code, 'ABCDE');
  assert.equal(checkPage.element('results').children.length, 1);
  console.log('PASS Sim04 private check: faculty authentication survives a new tab with empty storage');
})().catch(error => { console.error(error); process.exit(1); });
