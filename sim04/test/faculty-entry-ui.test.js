'use strict';
// A faculty sign-in on the student page must not hang on "Checking…": it offers
// the instructor console and a private practice room.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../public/student.js'), 'utf8');
const tokenFor = role => Buffer.from(JSON.stringify({ sub: 'prof-1', role, course: 'course-04', email: 'prof@school.edu' })).toString('base64url') + '.sig';

async function run(role, hash = true) {
  const elements = new Map(), requests = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      hidden: id === 'facultyChoice' || id === 'facultyNote' || id === 'practiceBar' || id === 'joinForm',
      value: '', textContent: '', href: '', children: [], classList: { toggle() {} },
      addEventListener(name, listener) { this['on' + name] = listener; },
      querySelector() { return { disabled: false }; },
      replaceChildren() { this.children = []; }, append(child) { this.children.push(child); }, focus() {}
    });
    return elements.get(id);
  };
  const view = { state: 'lobby', mode: 'team', stage: 0, you: 'prof', practice: true, group: 'Team 1', groupmates: [],
    clockMinutes: 25, clock: { remaining: null, expired: false }, data: null, commit: null, canCommit: false };
  const fetch = async (url, options) => {
    requests.push({ url, body: options.body && JSON.parse(options.body) });
    const ok = data => ({ ok: true, status: 200, json: async () => data });
    if (url === '/sim04/api/config') return ok({ briefing: 'x', warningMinutes: 2 });
    const action = JSON.parse(options.body).action;
    if (action === 'practice') return ok({ participantId: 'platform:prof-1', session: { code: 'PRACT' }, view });
    if (action === 'state') return ok({ session: { code: 'PRACT' }, view });
    throw new Error('Unexpected request ' + action);
  };
  const storage = new Map();
  vm.runInNewContext(source, {
    location: { pathname: '/sim04/index.html', search: '', hash: hash ? '#lt=' + tokenFor(role) : '' },
    document: { getElementById: element, createElement: () => element('new-' + elements.size) },
    sessionStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
    URLSearchParams, fetch, atob: v => Buffer.from(v, 'base64').toString('binary'),
    history: { replaceState() {} }, setInterval() {}, encodeURIComponent
  }, { filename: 'student.js' });
  await new Promise(r => setTimeout(r, 10));
  return { element, requests };
}

(async () => {
  for (const role of ['faculty', 'faculty_preview']) {
    const page = await run(role);
    assert.equal(page.element('entryHelp').textContent, 'You are signed in as an instructor.');
    assert.equal(page.element('facultyChoice').hidden, false);
    assert.match(page.element('facultyConsole').href, /^instructor\.html#lt=/);
    assert.equal(page.requests.length, 0, 'nothing is created until the instructor chooses');
    await page.element('facultyPreview').onclick();
    assert.ok(page.requests.some(r => r.body?.action === 'practice'));
    assert.equal(page.element('practiceBar').hidden, false, 'practice room shows its own Start the clock');
    assert.match(page.element('practiceConsole').href, /session=PRACT/);
  }
  const lost = await run('student', false);
  assert.match(lost.element('entryHelp').textContent, /course page|class link/);
  console.log('PASS Sim04 faculty entry: console or practice room, never stuck on checking');
})().catch(e => { console.error(e); process.exit(1); });
