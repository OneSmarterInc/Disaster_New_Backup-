'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/student.js'), 'utf8');
const token = Buffer.from(JSON.stringify({ sub: 'student-04', role: 'student', course: 'course-04' })).toString('base64url') + '.signature';

async function run(sessions, configStatus = 200) {
  const elements = new Map(), requests = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      hidden: false, value: '', textContent: '', children: [],
      classList: { toggle() {} },
      addEventListener(name, listener) { this['on' + name] = listener; },
      querySelector() { return { disabled: false }; },
      replaceChildren() { this.children = []; }, append(child) { this.children.push(child); }, focus() {}
    });
    return elements.get(id);
  };
  const response = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
  const fetch = async (url, options) => {
    requests.push({ url, options });
    if (url === '/sim04/api/session' && JSON.parse(options.body).action === 'course_sessions') {
      return response(200, { sessions });
    }
    if (url === '/sim04/api/config') return response(configStatus, { error: 'access_required' });
    throw new Error('Unexpected request: ' + url);
  };
  const storage = new Map();
  vm.runInNewContext(source, {
    location: { pathname: '/sim04/index.html', search: '', hash: '#lt=' + token },
    document: { getElementById: element, createElement: () => element('new-' + elements.size) },
    sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    URLSearchParams, fetch, atob: value => Buffer.from(value, 'base64').toString('binary'),
    history: { replaceState() {} }, setInterval() {}
  }, { filename: 'student.js' });
  await new Promise(resolve => setTimeout(resolve, 10));
  return { elements, element, requests, storage };
}

(async () => {
  const noRooms = await run([]);
  assert.equal(noRooms.element('joinForm').hidden, true);
  assert.doesNotMatch(source, /manual-room-toggle|Enter a room code instead/, 'student course entry has no manual room-code fallback');
  assert.match(noRooms.element('entryHelp').textContent, /has not opened a Sim04 session/i);

  const oneRoom = await run([{ code: 'ABCDE', name: 'Monday class', mode: 'team', state: 'lobby' }], 401);
  assert.equal(oneRoom.element('code').value, 'ABCDE');
  assert(oneRoom.requests.some(request => request.url === '/sim04/api/config'), 'one active room is joined without asking for its code');
  assert.match(oneRoom.element('entryHelp').textContent, /Joining Monday class/i);

  const severalRooms = await run([
    { code: 'ABCDE', name: 'Morning section', mode: 'team', state: 'lobby' },
    { code: 'FGH23', name: 'Afternoon section', mode: 'individual', state: 'lobby' }
  ]);
  assert.equal(severalRooms.element('joinForm').hidden, true);
  assert.equal(severalRooms.element('course-sessions').children.length, 2);
  assert.equal(severalRooms.element('course-sessions').children[0].textContent, 'Morning section · Team session');
  assert.equal(severalRooms.element('code').value, '', 'room code stays hidden when the student must choose between sessions');
  console.log('PASS Sim04 course entry UI: auto-join one room, choose among several, explain when none is open');
})().catch(error => { console.error(error); process.exit(1); });
