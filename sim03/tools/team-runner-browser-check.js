#!/usr/bin/env node
// End-to-end classroom test using the real HTML, API handlers, store.js and Lua.
// Redis is a disposable local service; no production credentials/data are used.
// Browser dependencies are installed separately by sim03-browser-checks.yml.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const existsSync = require('node:fs').existsSync;
const required = process.argv.includes('--required') || process.env.SIM03_BROWSER_REQUIRED === '1';
function unavailable(reason) {
  console[required ? 'error' : 'log'](`${required ? 'FAIL' : 'SKIP'}: RapidSim 03 browser/Redis check NOT RUN: ${reason}`);
  console[required ? 'error' : 'log']('See README.md: Standalone checks. CI must use --required so a skip cannot pass its browser gate.');
  if (required) process.exitCode = 1;
}
const missing = [];
for (const name of ['playwright', 'redis']) {
  try { require.resolve(name); }
  catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    missing.push(`missing npm package ${name}`);
  }
}
const agent = process.env.AGENT_BROWSER_BIN;
if (!agent || !existsSync(agent)) missing.push('AGENT_BROWSER_BIN does not point to an installed agent-browser CLI');
if (missing.length) { unavailable(missing.join('; ')); process.exit(required ? 1 : 0); }
const { chromium } = require('playwright');
const { createClient } = require('redis');
if (!existsSync(chromium.executablePath())) {
  unavailable('Playwright Chromium is not installed; run playwright install chromium');
  process.exit(required ? 1 : 0);
}
const exec = promisify(execFile);
const root = path.resolve(__dirname, '..');
const artifacts = path.resolve(process.env.BROWSER_ARTIFACTS || 'browser-artifacts');
const access = randomBytes(16).toString('hex');
const faculty = randomBytes(16).toString('hex');
const redis = createClient({ url: process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6379', socket: { connectTimeout: 3000, reconnectStrategy: false } });
const sessions = [];
const servers = [];
const contexts = [];
const pages = [];
const failures = [];
let browser, origin, assertions = 0, evalCalls = 0;
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); assertions++; console.log('PASS:', label); };
async function jsonBody(req) { const chunks = []; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
function json(res, status, data) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); }
async function listen(handler) {
  const server = http.createServer((req, res) => Promise.resolve(handler(req, res)).catch(error => {
    failures.push(error.stack); if (!res.writableEnded) json(res, 500, { error: error.message });
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}
async function api(payload, endpoint = 'session') {
  const res = await fetch(`${origin}/sim03/api/${endpoint}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-access-code': access }, body: JSON.stringify(payload)
  });
  return { status: res.status, body: await res.json() };
}
async function control(code, set) {
  const r = await api({ action: 'control', code, set, facultyCode: faculty });
  check(r.status, 200, `Instructor ${set}`);
}
async function newPage(name) {
  const context = await browser.newContext({ viewport: { width: 1365, height: 980 } });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  await context.addInitScript(value => sessionStorage.setItem('m03-access', value), access);
  // Fonts are not part of the behavioral test; avoid external network dependency.
  await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', e => failures.push(`${name}: ${e.stack}`));
  page.on('dialog', async dialog => {
    if (dialog.type() === 'confirm') await dialog.accept();
    else { failures.push(`${name} alert: ${dialog.message()}`); await dialog.dismiss(); }
  });
  contexts.push({ name, context }); pages.push({ name, page });
  return page;
}
async function join(page, code, name) {
  await page.goto(`${origin}/sim03/?session=${code}`);
  await page.locator('#joinName').fill(name);
  await page.locator('#joinBtn').click();
  await page.waitForFunction(() => S.hasSessionState && !!S.me);
  return page.evaluate(() => S.participantId);
}
async function waitRunner(page, id, allowed) {
  await page.waitForFunction(({ id, allowed }) => S.runnerId === id && S.canSubmit === allowed, { id, allowed });
}
async function step(page, value) { await page.waitForFunction(n => S.step === n, value); }
async function next(page, value) { await page.locator('#nextBtn').click(); await step(page, value); }
async function assign(page, id) {
  await page.locator('#runnerSelect').selectOption(id);
  await page.locator('#assignRunnerBtn').click();
  await page.waitForFunction(id => S.runnerId === id, id);
}
async function allocate(page, values) {
  for (const [line, target] of Object.entries(values)) {
    for (let i = 0; i < target; i++) await page.locator(`.step[data-line="${line}"][data-delta="1"]`).click();
  }
}
async function snapshot(name, page) {
  await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: true });
}
(async () => {
  await fs.mkdir(artifacts, { recursive: true });
  redis.on('error', e => failures.push(`Redis: ${e.message}`));
  try { await redis.connect(); }
  catch (error) {
    unavailable(`test Redis is unavailable (${error.code || 'connection failed'}); start a disposable Redis and set TEST_REDIS_URL`);
    return;
  }
  // Only the transport adapter is a test fixture. Redis executes the exact Lua
  // compare-and-set from the production store, including competing requests.
  const kv = await listen(async (req, res) => {
    if (req.headers.authorization !== `Bearer ${access}`) return json(res, 401, { error: 'unauthorized' });
    const command = await jsonBody(req);
    if (command[0] === 'EVAL') evalCalls++;
    try { json(res, 200, { result: await redis.sendCommand(command.map(String)) }); }
    catch (error) { json(res, 400, { error: error.message }); }
  });
  process.env.KV_REST_API_URL = kv; process.env.KV_REST_API_TOKEN = access;
  process.env.ACCESS_CODE = access; process.env.FACULTY_CODE = faculty;
  for (const key of ['FACULTY_CODES', 'LAUNCH_SECRET', 'PLATFORM_URL', 'SIM_API_KEY']) delete process.env[key];
  const handlers = Object.fromEntries(['config', 'session', 'outcome', 'finish'].map(name => [name, require(path.join(root, 'api', `${name}.js`))]));
  origin = await listen(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const route = pathname.replace(/^\/sim03/, '');
    const match = route.match(/^\/api\/([a-z]+)$/);
    if (match && handlers[match[1]]) {
      if (req.method === 'POST') req.body = await jsonBody(req);
      res.status = n => { res.statusCode = n; return res; };
      res.json = value => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(value)); return res; };
      await handlers[match[1]](req, res); return;
    }
    const name = route === '/' ? 'index.html' : route.slice(1);
    if (!['index.html', 'instructor.html', 'launch.html', 'faculty-workspace.js', 'faculty-workspace.css'].includes(name)) return json(res, 404, { error: 'not_found' });
    res.writeHead(200, { 'content-type': name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html' });
    res.end(await fs.readFile(path.join(root, 'public', name)));
  });
  console.log('Isolated Sim03 server ready:', origin);
  // Verify a real dev-server page with agent-browser as well as the detailed
  // Playwright multi-context flow below. No production access key is exposed.
  const agentEnv = { ...process.env, AGENT_BROWSER_EXECUTABLE_PATH: chromium.executablePath() };
  await exec(agent, ['--session', 'sim03-check', 'open', `${origin}/sim03/launch.html`], { env: agentEnv });
  const initial = await exec(agent, ['--session', 'sim03-check', 'snapshot', '-i'], { env: agentEnv });
  await fs.writeFile(path.join(artifacts, 'agent-browser-initial.txt'), initial.stdout);
  check(/access code/i.test(initial.stdout), true, 'agent-browser verifies the access page is not blank');
  await exec(agent, ['--session', 'sim03-check', 'screenshot', path.join(artifacts, 'access-page.png')], { env: agentEnv });
  await exec(agent, ['--session', 'sim03-check', 'close'], { env: agentEnv });
  browser = await chromium.launch({ headless: true });

  // Exercise the new roster transactions against the real disposable Redis,
  // independently of the account tests' in-memory SQL/session adapters.
  const rosterRoom = await api({action:'create',mode:'team',name:'Roster Lua verification',facultyCode:faculty});
  const rosterCode = rosterRoom.body.session.code; sessions.push(rosterCode);
  const productionStore = require('../lib/store.js');
  const rosterSession = await productionStore.getSession(rosterCode);
  const approved = ['a','b'].map(id=>({id:'roster-'+id,name:'Roster '+id,groupId:null,teamLabel:'',isCaptain:false,source:'course',joinedAt:null}));
  check(await productionStore.ensureParticipants(rosterCode,approved,rosterSession),2,'Real Redis imports pre-launch roster atomically');
  check(await productionStore.ensureParticipants(rosterCode,approved,rosterSession),0,'Real Redis roster import is idempotent');
  check((await api({action:'group',code:rosterCode,facultyCode:faculty,assign:{'roster-a':'Prepared team','roster-b':'Prepared team'}})).status,200,'Real Redis assignment works before attendance');
  let prepared = await productionStore.getParticipants(rosterCode);
  check(prepared['roster-a'].joinedAt,null,'Assignment does not manufacture attendance');
  check(await productionStore.ensureParticipants(rosterCode,approved,rosterSession),0,'Repeat import preserves assigned entries');
  check((await productionStore.getParticipants(rosterCode))['roster-a'].groupId,'team:prepared-team','HSETNX cannot erase a team');
  const joined = await api({action:'join',code:rosterCode,name:'Roster a',participantId:'roster-a'});
  check(joined.body.me.groupId,'team:prepared-team','First real join retains the preassigned team');
  check(!!joined.body.me.joinedAt,true,'First join records actual attendance');
  check(await productionStore.compareAndSetRoster(rosterCode,prepared,prepared,rosterSession),false,'Stale roster edit cannot erase a concurrent join');
  await control(rosterCode,'close');
  check(await productionStore.ensureParticipants(rosterCode,approved,rosterSession),-1,'An in-flight import cannot mutate a session after close');

  const created = await api({ action: 'create', mode: 'team', name: 'Automated browser runner verification', facultyCode: faculty });
  check(created.status, 200, 'Create isolated team session');
  const code = created.body.session.code; sessions.push(code);
  const ann = await newPage('lead-ann');
  const ben = await newPage('runner-ben');
  const cal = await newPage('member-cal');
  const annId = await join(ann, code, 'Test Ann');
  const benId = await join(ben, code, 'Test Ben');
  const calId = await join(cal, code, 'Test Cal');
  check((await api({ action: 'group', code, assign: { [annId]: 'Alpha', [benId]: 'Alpha', [calId]: 'Alpha' }, facultyCode: faculty })).status, 200, 'Assign team without changing the existing allocation flow');
  await waitRunner(ann, annId, true); await waitRunner(ben, annId, false);
  check(await ann.locator('#runnerSelect').count(), 1, 'Only the lead has the runner dropdown');
  check(await ben.locator('#runnerSelect').count(), 0, 'Ordinary member has no assignment control');
  await assign(ann, benId);
  await waitRunner(ben, benId, true); await waitRunner(cal, benId, false);
  check(await ann.evaluate(() => S.me.isCaptain), true, 'Delegation preserves team leadership');
  await control(code, 'start');
  await ben.locator('#nextBtn').waitFor({ state: 'visible' });
  await ann.waitForFunction(() => document.querySelector('#app')?.textContent.includes('Team mode · read-only'));
  check(await ann.locator('#nextBtn').count(), 0, 'Delegating lead cannot advance the simulation');
  check(await cal.locator('#nextBtn').count(), 0, 'Other member cannot advance the simulation');
  await snapshot('01-lead-observer', ann);
  await snapshot('02-selected-runner', ben);
  const revision = await ben.evaluate(() => S.runnerRevision);
  check((await api({ action: 'submit', code, participantId: annId, runnerRevision: revision, screen: 1 })).body.error, 'runner_only', 'Backend rejects non-runner advance');
  check((await api({ action: 'set_runner', code, participantId: calId, runnerId: calId, expectedRunnerId: benId, runnerRevision: revision })).status, 403, 'Backend rejects a member taking control');
  // Rendered-content regressions: presence in a source file is not sufficient.
  await ben.setViewportSize({ width: 1366, height: 768 });
  check(await ben.locator('.brief-profit').evaluate(box =>
    box.previousElementSibling.textContent.includes('main office system') &&
    box.nextElementSibling.textContent.includes('about to take over technology')), true,
    'Brief places the business-model callout after systems and before taking over');
  await snapshot('06-brief-order', ben);
  await next(ben, 1); await next(ben, 2);
  const rules = await ben.locator('#position-rules').innerText();
  check(rules.includes('Run has a $4M minimum') && rules.includes('$3M maximum per year') && rules.includes('cannot borrow from next year'), true,
    'Position states the Run minimum, other-line caps, and no-borrow rule before allocation');
  check(await ben.locator('.line-guide-row[data-line="capacity"]').innerText().then(t => t.includes('No one in the room speaks for this line.')), true,
    'Position explains Capacity silence in its own table row');
  await snapshot('07-position-rules', ben);
  await next(ben, 3);
  await ben.locator('#viewText').fill('Build a resilient service platform for Midland customers.');
  await next(ben, 4);
  await allocate(ben, { uptime: 2, capacity: 1, connect: 2, features: 0 });
  await next(ben, 5);
  check(await ben.locator('.outcome').evaluate(box => !!(box.compareDocumentPosition(document.querySelector('.running')) & Node.DOCUMENT_POSITION_FOLLOWING)), true,
    'Year 1 story precedes portfolio reference numbers');
  await snapshot('08-year1-story-first', ben);
  const y1 = await ben.evaluate(() => S.year1);
  check(y1, { run: 4, uptime: 2, capacity: 1, connect: 2, features: 0 }, 'Runner commits Year 1 through browser controls');
  await ann.waitForFunction(() => !!S.teamRun?.year1);
  check(await ann.locator('.step').count(), 0, 'Observer sees the allocation without editable controls');
  check(await ann.locator('#app').textContent().then(t => t.includes('Shared Year 1 allocation')), true, 'Observer receives shared submitted decisions');
  await next(ben, 6);
  await ben.reload(); await step(ben, 6);
  check(await ben.evaluate(() => S.year1), y1, 'Reload preserves Year 1 and resumes Year 2');
  await assign(ann, annId);
  await waitRunner(ann, annId, true); await waitRunner(ben, annId, false);
  await step(ann, 6);
  check(await ann.evaluate(() => S.year1), y1, 'In-play handoff preserves committed decisions');
  check(await ben.locator('#nextBtn').count(), 0, 'Previous runner loses browser controls');
  check((await api({ action: 'submit', code, participantId: benId, runnerRevision: revision, year2: y1 })).body.error, 'runner_only', 'Previous runner cannot submit after handoff');
  check((await api({ sessionCode: code, participantId: benId, stage: 'year1' }, 'outcome')).body.error, 'runner_only', 'Previous runner cannot request independent outcomes');
  await snapshot('03-handoff-resumes-year2', ann);
  await allocate(ann, { uptime: 1, capacity: 1, connect: 2, features: 1 });
  check(await ann.locator('#nextBtn').isEnabled(), true, 'Complete Year 2 allocation can be submitted before pause');
  await control(code, 'pause');
  await ann.waitForFunction(() => !!S.session.paused);
  check(await ann.locator('#nextBtn').isDisabled(), true, 'Paused run disables advancement');
  check((await api({ action: 'submit', code, participantId: annId, runnerRevision: await ann.evaluate(() => S.runnerRevision), screen: 6 })).body.error, 'session_paused', 'Backend also rejects advancement while paused');
  await control(code, 'resume');
  await ann.waitForFunction(() => !S.session.paused);
  check(await ann.locator('#nextBtn').isEnabled(), true, 'Resume preserves draft allocation and enables submission');
  await next(ann, 7);
  check(await ann.locator('.events').evaluate(box => !!(box.compareDocumentPosition(document.querySelector('.running')) & Node.DOCUMENT_POSITION_FOLLOWING)), true,
    'Heat-wave story precedes cumulative portfolio numbers');
  await snapshot('09-heat-story-first', ann);
  await ann.locator('#nextBtn').click();
  await ann.waitForFunction(() => S.year2Event === 1);
  check(await ann.locator('.events .outcome').count(), 2, 'The second event is actually rendered');
  check(await ann.locator('.events .outcome').last().evaluate(box => !!(box.compareDocumentPosition(document.querySelector('.running')) & Node.DOCUMENT_POSITION_FOLLOWING)), true,
    'Competitor story also precedes cumulative portfolio numbers');
  await snapshot('10-competitor-story-first', ann);
  await next(ann, 8); await next(ann, 9); await next(ann, 10);
  check((await api({ action: 'submit', code, participantId: calId, reflection1: 'Premature', done: true })).body.error, 'runner_only', 'Member cannot complete; only the runner submits');
  await ann.locator('#r1').fill('Ann learned why reliable service needs an information foundation.');
  await ann.locator('#r2').fill('Ann would revisit the balance between uptime and connection.');
  await ann.locator('#finishBtn').click();
  await ann.waitForFunction(() => S.finished && !!S.closingLesson);
  await ben.waitForFunction(() => S.finished && !!S.teamRun?.done && document.querySelector('.result-hero'));
  await cal.waitForFunction(() => S.finished && !!S.teamRun?.done && document.querySelector('.result-hero'));
  check(await ben.locator('#memberFinishBtn').count(), 0, 'Member is not asked for a separate final reflection');
  check(await cal.locator('#memberFinishBtn').count(), 0, 'Other member is not asked for a separate final reflection');
  const annOverall = await ann.locator('.result-hero p').textContent();
  check(await ben.locator('.result-hero p').textContent(), annOverall, 'All team members see the same overall result');
  check(await cal.locator('.result-hero p').textContent(), annOverall, 'Every teammate sees the same outcome cards');
  const facultyState = await api({ action: 'faculty_state', code, facultyCode: faculty });
  const run = facultyState.body.runs['team:alpha'];
  check(Object.keys(facultyState.body.runs), ['team:alpha'], 'Exactly one team run exists');
  check(run.done, true, 'Shared run completes when the runner submits');
  check(run.reflections[annId].reflection1, 'Ann learned why reliable service needs an information foundation.', 'Runner reflection is the team completion reflection');
  check(Object.keys(run.finishedBy).length, 3, 'Every student is recorded as finished by runner submission');
  check(evalCalls > 15, true, 'Real Redis executed the production compare-and-set Lua');
  await snapshot('04-completed-team-result', ben);
  const instructor = await newPage('instructor');
  await instructor.goto(`${origin}/sim03/instructor.html`);
  await instructor.locator('#fc').fill(faculty);
  await instructor.locator('#resumeCode').fill(code);
  await instructor.locator('#resumeBtn').click();
  await instructor.waitForFunction(() => !!state?.runs?.['team:alpha']?.done);
  const downloadPromise = instructor.waitForEvent('download');
  await instructor.locator('#export-btn').click();
  const download = await downloadPromise;
  const exportPath = path.join(artifacts, 'faculty-export.csv');
  await download.saveAs(exportPath);
  const exported = await fs.readFile(exportPath, 'utf8');
  check(exported.includes('Test Ann') && exported.includes('Test Ben') && exported.includes('Test Cal') && exported.includes('Ann learned'), true, 'Instructor CSV includes all team members and the shared runner response once');
  check(exported.split('Ann learned').length-1,1,'Shared response is exported once, not once per member');
  await snapshot('05-instructor-completion', instructor);
  await control(code, 'close');
  check((await api({ action: 'set_runner', code, participantId: annId, runnerId: benId, expectedRunnerId: annId, runnerRevision: run.runnerRevision })).body.error, 'session_closed', 'Closed session rejects runner changes');

  const soloSession = await api({ action: 'create', mode: 'individual', facultyCode: faculty });
  const soloCode = soloSession.body.session.code; sessions.push(soloCode);
  const solo = await newPage('individual');
  const soloId = await join(solo, soloCode, 'Test Individual');
  await control(soloCode, 'start');
  await solo.waitForFunction(() => S.session.state === 'running');
  check(await solo.locator('#nextBtn').isEnabled(), true, 'Individual play is still available');
  check(await solo.locator('#runnerSelect').count(), 0, 'Individual play has no runner assignment UI');
  check((await api({ action: 'submit', code: soloCode, participantId: soloId, year1: y1, year2: y1, reflection1: 'Individual reflection', done: true })).status, 200, 'Individual submission and completion remain unchanged');
  await control(soloCode, 'close');
  check(failures, [], 'No JavaScript errors, unexpected alerts, or backend transport errors');
  const report = { status: 'passed', assertions, redisLuaExecutions: evalCalls, browser: await browser.version(), sourceSha: process.env.SOURCE_SHA || '', scope: 'Isolated Chromium browser contexts + real Redis; production HTML, handlers, store and Lua; not production hosting' };
  await fs.writeFile(path.join(artifacts, 'report.json'), JSON.stringify(report, null, 2));
  console.log('BROWSER_REDIS_TEST_PASSED', JSON.stringify(report));
})().catch(async error => {
  console.error(error);
  await fs.writeFile(path.join(artifacts, 'failure.txt'), [error.stack, ...failures].join('\n')).catch(() => {});
  for (const { name, page } of pages) await snapshot(`FAILED-${name}`, page).catch(() => {});
  process.exitCode = 1;
}).finally(async () => {
  for (const { name, context } of contexts) {
    await context.tracing.stop({ path: path.join(artifacts, `${name}-trace.zip`) }).catch(() => {});
    await context.close().catch(() => {});
  }
  if (browser) await browser.close();
  for (const code of sessions) await redis.sendCommand(['DEL', `m03:sess:${code}`, `m03:sess:${code}:p`, `m03:sess:${code}:run`]).catch(() => {});
  for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  if (redis.isOpen) await redis.quit();
});
