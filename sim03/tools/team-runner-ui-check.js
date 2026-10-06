// Browser logic regression tests; no DOM library or browser dependency needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const script = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .filter(m => !m[0].includes('id="account-entry-redirect"'))
  .map(m => m[1]).join('\n').replace(/\binit\(\);\s*$/, '');
let html = '', response, calls = [], alerts = [];
const elements = new Map();
const app = { get innerHTML() { return html; }, set innerHTML(value) { html = value; elements.clear(); } };
const document = {
  activeElement: null, body: { style: {} },
  getElementById(id) {
    if (id === 'app') return app;
    if (!html.includes(`id="${id}"`)) return null;
    if (!elements.has(id)) elements.set(id, { value: '', disabled: false, classList: { contains: () => false }, focus() {}, setAttribute() {} });
    return elements.get(id);
  },
  querySelectorAll() { return []; }, addEventListener() {}, removeEventListener() {}
};
const storage = { getItem: () => null, setItem() {}, removeItem() {} };
const sandbox = { document, localStorage: storage, sessionStorage: storage,
  location: { origin: 'https://platform.test', pathname: '/sim03/', search: '?session=ABCDE', hash: '' }, history: { replaceState() {} }, URLSearchParams,
  setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => {}, alert: x => alerts.push(x),
  window: { confirm: () => true }, console, atob: value => Buffer.from(value, 'base64').toString(),
  fetch: async (url, options) => { const request = JSON.parse(options.body); calls.push(request); const data = typeof response === 'function' ? await response(request) : response; return { ok: true, json: async () => data }; }
};
vm.createContext(sandbox);
vm.runInContext(script, sandbox);
const run = code => vm.runInContext(code, sandbox);
const clone = v => JSON.parse(JSON.stringify(v));
function data({ runner = 'ann', lead = 'ann', pid = 'ann', revision = 0, state = 'running', shared = null } = {}) {
  const mates = ['ann', 'ben'].map(id => ({ id, name: id, isCaptain: id === lead, isRunner: id === runner }));
  return { session: { code: 'ABCDE', mode: 'team', state, paused: false },
    me: { ...mates.find(m => m.id === pid), groupId: 'team:alpha', teamLabel: 'Alpha' }, mates,
    canSubmit: pid === runner, canAssignRunner: pid === lead, runnerId: runner, runnerRevision: revision, run: shared };
}
run("C={annualBudget:9,runMinimum:3,lineMaximum:3,lines:['run','uptime','capacity','connect','features'].map(id=>({id,label:id})),coldOpen:['Fixture company'],reflectionPrompts:['First reflection','Second reflection'],buyers:{authored:true}}; S.participantId='ann';");
(async () => {
  response = data({ state: 'lobby' }); await run('pollSession(true)');
  assert(html.includes('Who will run the simulation for your team?'));
  assert(html.includes('id="assignRunnerBtn"'));
  const select = document.getElementById('runnerSelect'); select.value = 'ben'; select.onchange();
  response = req => req.action === 'set_runner' ? { ok: true } : data({ runner: 'ben', revision: 1, state: 'lobby' });
  await document.getElementById('assignRunnerBtn').onclick();
  assert.deepEqual(calls.find(x => x.action === 'set_runner'), { action: 'set_runner', code: 'ABCDE', participantId: 'ann', runnerId: 'ben', expectedRunnerId: 'ann', runnerRevision: 0 });
  assert.equal(run('S.me.isCaptain'), true);
  assert.equal(run('S.canSubmit'), false);

  response = data({ runner: 'ben', revision: 1 }); await run('pollSession(true)');
  assert(html.includes('Team mode · read-only'));
  assert(!html.includes('id="nextBtn"'));
  assert(html.includes('id="runnerSelect"'), 'lead retains runner selection while not operating');
  calls = []; await run('next()'); assert.equal(calls.length, 0, 'view-only navigation cannot submit');

  // A non-lead runner gets the simulation, not the observer screen.
  run("S.participantId='ben'"); response = data({ runner: 'ben', pid: 'ben', revision: 1 });
  await run('pollSession(true)');
  assert(html.includes('id="nextBtn"'));
  assert(!html.includes('id="runnerSelect"'));
  assert.equal(run('S.me.isCaptain'), false);

  // Revocation is immediate on receipt of state even with a focused textarea.
  document.activeElement = { tagName: 'TEXTAREA' };
  response = data({ runner: 'ann', pid: 'ben', revision: 2 }); await run('pollSession(false)');
  assert(html.includes('Team mode · read-only'));
  assert(!html.includes('id="nextBtn"'));
  document.activeElement = null;

  const y1 = { run: 3, uptime: 2, capacity: 1, connect: 2, features: 1 };
  const shared = { runId: 'team:alpha', strategicView: 'Build a reliable service business.', year1: y1, year2: null,
    screen: 6, phase: 1, year2Event: 0, done: false, reflection1: '', reflection2: '',
    outcomes: { year1: { title: 'Saved outcome', narrative: 'Saved narrative' } } };
  response = data({ runner: 'ben', pid: 'ben', revision: 3, shared }); await run('pollSession(true)');
  assert.equal(run('S.step'), 6);
  assert.equal(run('S.year1Outcome.title'), 'Saved outcome');
  assert.deepEqual(clone(run('S.year1')), y1);
  assert(html.includes('A year later, the same $9 million is back on the table.'));

  // A reloaded runner restores the persisted screen without recommitting.
  run('S.hasSessionState=false; S.step=0; S.year1=null; S.year1Outcome=null');
  await run('pollSession(true)'); assert.equal(run('S.step'), 6);
  assert.deepEqual(clone(run('S.year1')), y1);

  // A late poll that began before a successful mutation cannot undo it.
  let release;
  response = () => new Promise(resolve => { release = resolve; });
  const pending = run('pollSession(false)');
  response = { ok: true }; await run('saveRun({screen:6})');
  release(data({ runner: 'ann', pid: 'ben', revision: 2 })); await pending;
  assert.equal(run('S.runnerId'), 'ben');
  assert.equal(run('S.runnerRevision'), 3);

  // When the runner completes, members see the same result instead of a separate reflection form.
  run("S.reflectionDirty=true; S.reflection1='My unsaved draft'; S.participantId='ann'");
  response = data({ runner: 'ben', pid: 'ann', revision: 3, shared: { ...shared, phase: 3, screen: 10, done: true, reflection1: '' } });
  await run('pollSession(true)');
  assert(html.includes('Team submission'));
  assert(!html.includes('id="memberFinishBtn"'));
  assert(!html.includes('id="nextBtn"'));
  assert.equal(alerts.length, 0);
  // An existing session supplies its rules, overriding newly deployed defaults.
  response=data({runner:'ben',pid:'ben',shared});
  response.session.allocationRules={annualBudget:10,runMinimum:5,lineMaximum:3,position:'Custom session rules'};
  await run('pollSession(true)');
  assert.equal(run('C.annualBudget'),10);assert.equal(run('C.runMinimum'),5);
  assert.deepEqual(clone(run('defaultAlloc()')),{run:5,uptime:0,capacity:0,connect:0,features:0});
  assert.deepEqual(clone(run('S.year1')),y1,'a rules refresh must never erase a committed year');
  assert(html.includes('same $10 million'),'rendered budget follows the saved session');
  assert.equal(run('validateClient({run:5,uptime:2,capacity:1,connect:2,features:0})'),'');
  console.log('RapidSim 03 runner UI checks passed (selection, observer gating, handoff/reload, focus revocation, stale polls, runner-only completion).');
})().catch(error => { console.error(error); process.exitCode = 1; });
