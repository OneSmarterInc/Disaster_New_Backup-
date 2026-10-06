'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../platform/public/session-entry.js'), 'utf8');

(async () => {
  const requests = [];
  const app = { innerHTML: '' };
  const elements = new Map([['app', app]]);
  const location = {
    search: '?sim=rapid-04-whose-number&session=ABCDE&course=course-04',
    replace(url) { this.destination = url; }
  };
  const fetch = async (url, options = {}) => {
    requests.push({ url, options });
    const body = options.body ? JSON.parse(options.body) : {};
    let data;
    if (url === '/api/student' && body.action === 'course_lookup') {
      data = { course: { title: 'Test course', join_code: 'JOIN-04' } };
    } else if (url === '/api/auth' && body.action === 'me') {
      data = { user: { role: 'student', name: 'Test student' } };
    } else if (url === '/api/launch?sim=rapid-04-whose-number&session=ABCDE&format=json&course=course-04') {
      data = { url: 'https://rapidsims.flexee.org/sim04/index.html?session=ABCDE#lt=student-token' };
    } else {
      throw new Error('Unexpected request: ' + url);
    }
    return { ok: true, status: 200, json: async () => data };
  };
  vm.runInNewContext(source, {
    location, fetch, URLSearchParams,
    document: { getElementById(id) {
      if (!elements.has(id)) elements.set(id, { innerHTML: '', textContent: '', disabled: false });
      return elements.get(id);
    } },
    window: { addEventListener() {} }, clearTimeout() {}, setTimeout() { return 1; }
  }, { filename: 'session-entry.js' });

  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(location.destination,
    'https://rapidsims.flexee.org/sim04/index.html?session=ABCDE#lt=student-token',
    'a Sim04 class invitation signs in the student and carries its room to the simulation');
  assert.equal(requests.at(-1).url,
    '/api/launch?sim=rapid-04-whose-number&session=ABCDE&format=json&course=course-04');
  assert(!app.innerHTML.includes('Invalid session link'));
  console.log('PASS Sim04 platform invitation: student enters the invited room without typing its code');
})().catch(error => { console.error(error); process.exit(1); });
