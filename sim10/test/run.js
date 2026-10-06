'use strict';
process.env.DEV_OPEN = '';
const assert = require('assert');
const http = require('http');
const E = require('../lib/engine');
const content = require('../lib/content');
const config = require('../data/config');
const gate = require('../tools/gate');
const denylist = require('../lib/denylist');
const { memoryStore } = require('../lib/store');
const { createApp } = require('../lib/app');
const L = require('../lib/launch');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const MIN = 60000;
const T0 = 1_700_000_000_000;
const rejects = async (p, code) => { try { await p; } catch (e) { assert.strictEqual(e.code, code, `expected ${code}, got ${e.code}: ${e.message}`); return; } assert.fail(`expected rejection ${code}`); };

async function setup(mode, cases = ['A'], teams = 2) {
  const store = memoryStore();
  const s = await E.createSession(store, { mode, cases, teams }, T0);
  return { store, s, code: s.code, host: s.hostKey };
}
const longMind = 'I would need to see like-for-like revenue growing faster than capital spending for two quarters in a row.';

// ---------- gate ----------
test('gate passes on real content', () => { assert.deepStrictEqual(gate.check(), []); });

test('gate catches a planted company name in the pack', () => {
  const A = content.buildPack('A'); const B = content.buildPack('B');
  B.sections[4].text[0].text += ' Equinix said so.';
  const errs = gate.check({ packs: { A, B } });
  assert(errs.some((e) => e.startsWith('[denylist]') && e.includes('equinix')), errs.join('\n'));
});

test('gate catches a planted year, a dollar sign and an era term', () => {
  const A = content.buildPack('A');
  A.briefing.push('Figures for 2000 are in $ and the network is fibre.');
  const errs = gate.check({ packs: { A, B: content.buildPack('B') } });
  for (const t of ['2000', '$', 'fibre']) assert(errs.some((e) => e.includes(t)), `missed ${t}`);
});

test('gate catches a leak in public UI text', () => {
  const pub = gate.publicTexts().concat([{ where: 'planted.js', text: 'Welcome to the Global Crossing case' }]);
  assert(gate.check({ publicTexts: pub }).some((e) => e.includes('planted.js')));
});

test('gate text extractor finds leaks inside template literals and inline scripts', () => {
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's10-'));
  fs.writeFileSync(path.join(dir, 'a.js'), 'el.innerHTML = `<p>${esc(x)} was listed on Nasdaq ${y.map((z) => `<b>${z}</b>`).join("")}</p>`;');
  fs.writeFileSync(path.join(dir, 'b.html'), '<p>Fine</p><script>alert("the fibre network");</script>');
  const errs = gate.check({ publicTexts: gate.publicTexts(dir) });
  assert(errs.some((e) => e.includes('a.js') && e.includes('nasdaq')), 'template literal leak missed');
  assert(errs.some((e) => e.includes('b.html') && e.includes('fibre')), 'inline script leak missed');
});

test('gate catches context leaks, placeholders, bad scaling and a retired id', () => {
  const A = content.buildPack('A');
  A.briefing.push('See you Tuesday. TODO');
  A.sections[1].blocks[0].row.values[0] = '1';
  const errs = gate.check({ packs: { A, B: content.buildPack('B') }, simId: 'rapid-03-midland' });
  for (const c of ['[context]', '[placeholder]', '[scaling]', '[simid]']) assert(errs.some((e) => e.startsWith(c)), `missed ${c}`);
});

test('live guard and gate use the same matcher', () => {
  const text = 'This has to be Global Crossing in 2000';
  assert.deepStrictEqual(denylist.findHits(text).sort(), ['2000', 'global crossing']);
  const fake = { runs: { A: { reveal: 0 } } };
  assert.strictEqual(E.guard(fake, 'A', text), true);
  fake.runs.A.reveal = 1;
  assert.strictEqual(E.guard(fake, 'A', text), false, 'guard is off once the company is named');
});

// ---------- scaling ----------
test('scaling: every money figure equals source x constant, ratios preserved', () => {
  for (const cs of ['A', 'B']) {
    const byTag = content.linesByTag(cs);
    const k = config.scale[cs];
    const rev = byTag['is.revenue'];
    assert.strictEqual(content.scaled(cs, rev.Q1), Math.round(rev.Q1 * k));
    const ratioSrc = rev.Q2 / rev.Q1; const ratioShown = content.scaled(cs, rev.Q2) / content.scaled(cs, rev.Q1);
    assert(Math.abs(ratioSrc - ratioShown) < 0.001, `${cs} ratio drift`);
  }
  const pack = content.buildPack('A');
  const growth = pack.sections[0].blocks[1].row;
  assert.deepStrictEqual(growth.values, ['387%', '332%']);
});

test('scaling constant is never sent to students', async () => {
  const { store, code, host } = await setup('individual');
  const { pid } = await E.join(store, code, {}, T0);
  await E.startCase(store, code, host, 'A', T0);
  const view = JSON.stringify(await E.studentState(store, code, pid, T0 + MIN));
  assert(!view.includes(String(config.scale.A)));
  assert(!view.includes('Global Crossing') && !view.includes('gc-10q'), 'no names or source refs before reveal');
});

// ---------- session creation ----------
test('session creation requires mode and case choice, no defaults', async () => {
  const store = memoryStore();
  await rejects(E.createSession(store, {}, T0), 'bad_request');
  await rejects(E.createSession(store, { mode: 'individual' }, T0), 'bad_request');
  await rejects(E.createSession(store, { cases: ['A'] }, T0), 'bad_request');
  await rejects(E.createSession(store, { mode: 'team', cases: ['A'] }, T0), 'bad_request');
  await rejects(E.createSession(store, { mode: 'individual', cases: ['B'] }, T0), 'bad_request');
  const s = await E.createSession(store, { mode: 'team', cases: ['A', 'B'], teams: 4 }, T0);
  assert.deepStrictEqual(s.clock, { read: 5, private: 1, team: 4 });
});

// ---------- individual state machine ----------
test('individual: read, verdict, closed; writes only in the verdict window', async () => {
  const { store, code, host } = await setup('individual');
  const { pid } = await E.join(store, code, {}, T0);
  await rejects(E.saveIndividual(store, code, pid, 'A', { call: 'bubble' }, T0), 'closed');
  await E.startCase(store, code, host, 'A', T0);
  assert.strictEqual((await E.studentState(store, code, pid, T0 + 11 * MIN)).phase, 'read');
  await rejects(E.saveIndividual(store, code, pid, 'A', { call: 'bubble' }, T0 + 11 * MIN), 'closed');
  await E.saveIndividual(store, code, pid, 'A', { call: 'bubble', line: 'recon.deferred_cash' }, T0 + 13 * MIN);
  await E.saveIndividual(store, code, pid, 'A', { lineWhy: 'Most of the profit measure is cash paid in advance.', mind: longMind }, T0 + 14 * MIN);
  await rejects(E.saveIndividual(store, code, pid, 'A', { call: 'infra' }, T0 + 18 * MIN), 'closed');
  const v = await E.studentState(store, code, pid, T0 + 18 * MIN);
  assert.strictEqual(v.phase, 'closed');
  assert.deepStrictEqual({ s: v.result.status, c: v.result.call, b: v.result.blanks }, { s: 'recorded', c: 'bubble', b: [] });
});

test('individual: invalid call and line not in the pack are rejected', async () => {
  const { store, code, host } = await setup('individual');
  const { pid } = await E.join(store, code, {}, T0);
  await E.startCase(store, code, host, 'A', T0);
  await rejects(E.saveIndividual(store, code, pid, 'A', { call: 'maybe' }, T0 + 13 * MIN), 'bad_request');
  await rejects(E.saveIndividual(store, code, pid, 'A', { line: 'nt.bond_market_value' }, T0 + 13 * MIN), 'bad_request');
});

test('timeouts: clock out with no call is no verdict; call with blanks is recorded with blanks marked', async () => {
  const { store, code, host } = await setup('individual');
  const a = await E.join(store, code, {}, T0); const b = await E.join(store, code, {}, T0); const c = await E.join(store, code, {}, T0);
  await E.startCase(store, code, host, 'A', T0);
  await E.saveIndividual(store, code, b.pid, 'A', { call: 'infra' }, T0 + 13 * MIN);
  await E.saveIndividual(store, code, c.pid, 'A', { line: 'bs.cash', mind: 'short' }, T0 + 13 * MIN);
  const at = T0 + 20 * MIN;
  assert.strictEqual((await E.studentState(store, code, a.pid, at)).result.status, 'no_verdict');
  const rb = (await E.studentState(store, code, b.pid, at)).result;
  assert.deepStrictEqual([rb.status, rb.blanks], ['recorded', ['line', 'reason', 'mind']]);
  assert.strictEqual((await E.studentState(store, code, c.pid, at)).result.status, 'no_verdict', 'line without a call is still no verdict');
  const con = await E.consoleState(store, code, host, at);
  assert.deepStrictEqual(con.byCase.A.split, { infra: 1, bubble: 0, noVerdict: 2 });
});

// ---------- team state machine ----------
test('team: private call window, shared draft, first commit wins, team isolation', async () => {
  const { store, code, host } = await setup('team', ['A'], 2);
  const m1 = await E.join(store, code, { team: 1 }, T0); const m2 = await E.join(store, code, { team: 1 }, T0);
  const o1 = await E.join(store, code, { team: 2 }, T0);
  await rejects(E.join(store, code, { team: 3 }, T0), 'bad_request');
  await E.startCase(store, code, host, 'A', T0);
  const priv = T0 + 11 * MIN; const team = T0 + 13 * MIN;
  await rejects(E.saveTeamDraft(store, code, m1.pid, 'A', { call: 'infra' }, priv), 'closed');
  await E.savePrivate(store, code, m1.pid, 'A', 'infra', priv);
  await E.savePrivate(store, code, m2.pid, 'A', 'infra', priv);
  await E.savePrivate(store, code, o1.pid, 'A', 'bubble', priv);
  await rejects(E.savePrivate(store, code, m1.pid, 'A', 'bubble', team), 'closed');
  await rejects(E.commitTeam(store, code, m1.pid, 'A', team), 'bad_request');
  await E.saveTeamDraft(store, code, m1.pid, 'A', { call: 'bubble', line: 'bs.cash' }, team);
  const seen = await E.studentState(store, code, m2.pid, team);
  assert.strictEqual(seen.teamDraft.call, 'bubble', 'teammate sees shared draft');
  assert.strictEqual(seen.mine.private, 'infra');
  const other = await E.studentState(store, code, o1.pid, team);
  assert.deepStrictEqual(other.teamDraft, {}, 'other team sees nothing of team 1');
  await E.commitTeam(store, code, m2.pid, 'A', team);
  await rejects(E.commitTeam(store, code, m1.pid, 'A', team), 'conflict');
  await rejects(E.saveTeamDraft(store, code, m1.pid, 'A', { call: 'infra' }, team), 'conflict');
  const end = T0 + 21 * MIN;
  const r1 = (await E.studentState(store, code, m1.pid, end)).result;
  assert.deepStrictEqual([r1.status, r1.call, r1.blanks], ['recorded', 'bubble', ['reason', 'mind']]);
  assert.strictEqual((await E.studentState(store, code, o1.pid, end)).result.status, 'no_verdict', 'no commit by the clock is no verdict');
  const con = await E.consoleState(store, code, host, end);
  assert.deepStrictEqual(con.byCase.A.movement, { moved: 1, held: 0, split: 0, noVerdict: 1 });
});

// ---------- reveal gating ----------
test('reveal: gated on the clock, one stage at a time, Case B only after Case A reveal', async () => {
  const { store, code, host } = await setup('individual', ['A', 'B']);
  const { pid } = await E.join(store, code, {}, T0);
  await rejects(E.startCase(store, code, 'wrong-key', 'A', T0), 'forbidden');
  await E.startCase(store, code, host, 'A', T0);
  await rejects(E.advanceReveal(store, code, host, 'A', T0 + 5 * MIN), 'conflict');
  await rejects(E.startCase(store, code, host, 'B', T0 + 5 * MIN), 'conflict');
  await E.saveIndividual(store, code, pid, 'A', { call: 'bubble', line: 'bs.debt_long' }, T0 + 7 * MIN);
  const closed = T0 + 11 * MIN;
  let v = await E.studentState(store, code, pid, closed);
  assert.strictEqual(v.reveal, null, 'nothing revealed until the host releases stage 1');
  await E.advanceReveal(store, code, host, 'A', closed);
  v = await E.studentState(store, code, pid, closed);
  assert.strictEqual(v.reveal.identity.name, 'Global Crossing Ltd.');
  assert(!v.reveal.table, 'stage 1 shows identity only');
  await E.advanceReveal(store, code, host, 'A', closed);
  v = await E.studentState(store, code, pid, closed);
  const yours = v.reveal.table.rows.filter((r) => r.yours).map((r) => r.tag);
  assert.deepStrictEqual(yours, ['bs.debt_total'], 'cited line highlighted through maps_to');
  assert(!v.reveal.outcome);
  await rejects(E.startCase(store, code, host, 'B', closed), 'conflict');
  await E.advanceReveal(store, code, host, 'A', closed);
  v = await E.studentState(store, code, pid, closed);
  assert(v.reveal.outcome.length >= 3);
  await rejects(E.advanceReveal(store, code, host, 'A', closed), 'conflict');
  v = await E.studentState(store, code, pid, closed);
  assert.strictEqual(v.caseId, 'A', 'students stay on the Case A outcome until the host starts Case B');
  await E.startCase(store, code, host, 'B', closed);
  v = await E.studentState(store, code, pid, closed + MIN);
  assert.strictEqual(v.pack.caseId, 'B');
  assert(v.pack.briefing[0].startsWith('A different company, a different period.'));
});

test('reveal: a cited line outside the trimmed set is appended and marked', () => {
  const r = content.buildReveal('A', 2, 'bs.goodwill');
  assert.strictEqual(r.table.extra.tag, 'bs.goodwill');
  assert(r.table.rows.every((x) => !x.yours));
});

// ---------- console: pairs, guard, unanimous ----------
test('pairs: same line, opposite calls; guard holds a response that names the company', async () => {
  const { store, code, host } = await setup('individual');
  const ps = [];
  for (let i = 0; i < 5; i++) ps.push((await E.join(store, code, {}, T0)).pid);
  await E.startCase(store, code, host, 'A', T0);
  const t = T0 + 13 * MIN;
  const save = (pid, call, line, mind = longMind) => E.saveIndividual(store, code, pid, 'A', { call, line, lineWhy: 'This line carries the argument.', mind }, t);
  await save(ps[0], 'bubble', 'hl.cash_revenue');
  await save(ps[1], 'infra', 'hl.cash_revenue');
  await save(ps[2], 'bubble', 'bs.cash');
  await save(ps[3], 'infra', 'bs.cash', `${longMind} It is obviously Global Crossing.`);
  await save(ps[4], 'infra', 'tx.asset_lives');
  const con = await E.consoleState(store, code, host, T0 + 20 * MIN);
  const c = con.byCase.A;
  assert.strictEqual(c.heldCount, 1);
  assert.deepStrictEqual(c.pairs.map((p) => p.line), ['hl.cash_revenue'], 'held response is not paired or projected');
  assert.strictEqual(c.unanimous, null);
  await E.project(store, code, host, 'A', { showHeld: true }, T0 + 20 * MIN);
  const con2 = await E.consoleState(store, code, host, T0 + 20 * MIN);
  assert.strictEqual(con2.byCase.A.pairs.length, 2, 'host can choose to show held responses');
});

test('console during play shows a count only', async () => {
  const { store, code, host } = await setup('individual');
  const { pid } = await E.join(store, code, {}, T0);
  await E.startCase(store, code, host, 'A', T0);
  await E.saveIndividual(store, code, pid, 'A', { call: 'infra' }, T0 + 13 * MIN);
  const c = (await E.consoleState(store, code, host, T0 + 14 * MIN)).byCase.A;
  assert.strictEqual(c.submitted, 1);
  for (const k of ['split', 'pairs', 'linesByCall']) assert(!(k in c), `${k} must not appear during play`);
});

test('unanimous room: majority mind-changers offered as the opposing case, minority case in notes', async () => {
  const { store, code, host } = await setup('individual');
  const a = await E.join(store, code, {}, T0); const b = await E.join(store, code, {}, T0);
  await E.startCase(store, code, host, 'A', T0);
  for (const p of [a, b]) await E.saveIndividual(store, code, p.pid, 'A', { call: 'bubble', line: 'bs.cash', lineWhy: 'Cash halves in a quarter.', mind: longMind }, T0 + 13 * MIN);
  const c = (await E.consoleState(store, code, host, T0 + 20 * MIN)).byCase.A;
  assert.strictEqual(c.unanimous, 'bubble');
  assert.strictEqual(c.opposingCandidates.length, 2);
  assert(c.minorityCase.startsWith('The case for infrastructure'));
});

test('pair matching is one-to-one per line', () => {
  const it = (call, line) => ({ call, line });
  const pairs = E.matchPairs([it('infra', 'x'), it('infra', 'x'), it('bubble', 'x'), it('bubble', 'y')]);
  assert.strictEqual(pairs.length, 1);
});

// ---------- platform contract (matches platform/lib/launch.js and sim08) ----------
const SECRET = 'test-secret';
const tok = (o) => { process.env.LAUNCH_SECRET = SECRET; return L.signBack({ sim: config.simId, iat: T0, exp: T0 + 3600e3, ...o }); };

test('launch tokens: this sim only, known roles, not expired, correct signature', () => {
  process.env.LAUNCH_SECRET = SECRET;
  assert(L.launchFor(tok({ sub: 'u1', role: 'student' }), T0));
  assert(!L.launchFor(tok({ sub: 'u1', role: 'student', sim: 'rapid-08-later' }), T0), 'token for another sim');
  assert(!L.launchFor(tok({ sub: 'u1', role: 'admin' }), T0), 'unknown role');
  assert(!L.launchFor(tok({ sub: 'u1', role: 'student' }), T0 + 7200e3), 'expired');
  assert(!L.launchFor(tok({ role: 'student' }), T0), 'no person');
  const t = tok({ sub: 'u1', role: 'student' });
  assert(!L.launchFor(t.slice(0, -2) + 'xx', T0), 'tampered signature');
  assert(L.isFaculty(L.launchFor(tok({ sub: 'f', role: 'faculty_preview' }), T0)));
});

async function withServer(fn, options = {}) {
  const store = memoryStore();
  const clock = { now: T0 };
  const server = http.createServer(createApp({ ...(options.useDefault ? {} : { store }), clock: () => clock.now }));
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const call = async (method, p, body, headers = {}) => {
    const res = await fetch(`http://127.0.0.1:${port}${p}`, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text(); let responseBody;
    try { responseBody = JSON.parse(text); } catch { responseBody = text; }
    return { status: res.status, body: responseBody, location: res.headers.get('location') };
  };
  try { await fn({ call, clock, store }); } finally { server.close(); }
}

async function withPlatform(fn) {
  const got = [];
  const srv = http.createServer(async (req, res) => {
    let raw = ''; for await (const c of req) raw += c;
    const p = L.verifyLaunch(JSON.parse(raw).token);
    got.push({ path: req.url, payload: p });
    res.writeHead(p ? 200 : 401, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
  });
  await new Promise((r) => srv.listen(0, r));
  process.env.PLATFORM_URL = `http://127.0.0.1:${srv.address().port}`;
  process.env.SIM_URL = 'https://rapidsims.example/sim10';
  L.resetAnnounce();
  try { await fn(got); } finally { srv.close(); delete process.env.PLATFORM_URL; delete process.env.SIM_URL; L.resetAnnounce(); }
}

test('http: faculty token makes a course-bound session; students join by account', async () => {
  process.env.LAUNCH_SECRET = SECRET; delete process.env.ACCESS_CODE; delete process.env.FACULTY_CODES;
  await withServer(async ({ call }) => {
    assert.strictEqual((await call('POST', '/api/session', { mode: 'individual', cases: ['A'] })).status, 401, 'no faculty, no session');
    const fac = { 'X-Launch-Token': tok({ sub: 'f1', role: 'faculty', course: 'c1', mode: 'session', name: 'V' }) };
    const created = await call('POST', '/api/session', { mode: 'individual', cases: ['A'] }, fac);
    assert.strictEqual(created.status, 200);
    const { code } = created.body;
    const info = await call('GET', `/api/session?code=${code}`);
    assert(info.body.platform && info.body.joinUrl.includes(`session=${code}`) && info.body.joinUrl.includes('course=c1'));
    const entry = await call('GET', `/api/join?session=${code}`);
    assert.strictEqual(entry.status, 302); assert(entry.location.includes('/session.html'));
    const a = { 'X-Launch-Token': tok({ sub: 'sA', role: 'student', course: 'c1' }) };
    const b = { 'X-Launch-Token': tok({ sub: 'sB', role: 'student', course: 'c1' }) };
    assert.strictEqual((await call('POST', '/api/join', { code })).status, 403, 'no token on a platform session');
    assert.strictEqual((await call('POST', '/api/join', { code }, { 'X-Launch-Token': tok({ sub: 'sX', role: 'student', course: 'c2' }) })).status, 403, 'other course');
    assert.strictEqual((await call('POST', '/api/join', { code }, { 'X-Launch-Token': tok({ sub: 'sX', role: 'student', sim: 'rapid-08-later' }) })).status, 401, 'other sim');
    const j = await call('POST', '/api/join', { code }, a);
    assert.strictEqual(j.body.pid, 'platform:sA');
    assert.strictEqual((await call('POST', '/api/join', { code }, a)).body.rejoined, true, 'rejoin is idempotent');
    await call('POST', '/api/join', { code }, b);
    assert.strictEqual((await call('GET', `/api/state?code=${code}`, null, { ...b, 'X-Pid': 'platform:sA' })).status, 403, 'cannot act as another student');
    assert.strictEqual((await call('GET', `/api/state?code=${code}`, null, { 'X-Pid': 'platform:sA' })).status, 401, 'platform participant needs the token');
    assert.strictEqual((await call('GET', `/api/state?code=${code}`, null, { ...a, 'X-Pid': 'platform:sA' })).status, 200);
  });
});

test('http: standalone access fails closed; codes open it; students never see each other', async () => {
  process.env.LAUNCH_SECRET = SECRET; delete process.env.ACCESS_CODE;
  process.env.FACULTY_CODES = 'Vikram:fac-123, Chuck:fac-456';
  await withServer(async ({ call, clock }) => {
    assert.strictEqual((await call('POST', '/api/session', { mode: 'individual', cases: ['A'] }, { 'X-Faculty-Code': 'nope' })).status, 401);
    const created = await call('POST', '/api/session', { mode: 'individual', cases: ['A'] }, { 'X-Faculty-Code': 'fac-456' });
    assert.strictEqual(created.status, 200);
    const { code, hostKey } = created.body;
    assert.strictEqual((await call('POST', '/api/join', { code })).status, 503, 'no ACCESS_CODE configured: closed');
    process.env.ACCESS_CODE = 'class-code';
    assert.strictEqual((await call('POST', '/api/join', { code }, { 'X-Access-Code': 'wrong' })).status, 401);
    const acc = { 'X-Access-Code': 'class-code' };
    const j1 = (await call('POST', '/api/join', { code }, acc)).body; const j2 = (await call('POST', '/api/join', { code }, acc)).body;
    assert.strictEqual((await call('GET', `/api/console?code=${code}`, null, { 'X-Pid': j1.pid })).status, 403);
    await call('POST', '/api/host/start', { code, caseId: 'A' }, { 'X-Host-Key': hostKey });
    clock.now += 13 * MIN;
    await call('POST', '/api/verdict', { code, caseId: 'A', fields: { call: 'bubble', mind: 'secret reasoning of student one' } }, { 'X-Pid': j1.pid });
    const s2 = await call('GET', `/api/state?code=${code}`, null, { 'X-Pid': j2.pid });
    assert.strictEqual(s2.status, 200);
    assert(!JSON.stringify(s2.body).includes('secret reasoning'));
    assert.strictEqual((await call('GET', `/api/state?code=${code}`, null, { 'X-Pid': 'made-up' })).status, 403);
  });
  delete process.env.ACCESS_CODE; delete process.env.FACULTY_CODES;
});

test('platform: one catalogue announcement per cold start, signed, with this sim\'s facts', async () => {
  process.env.LAUNCH_SECRET = SECRET;
  await withPlatform(async (got) => {
    await withServer(async ({ call }) => { await call('GET', '/api/manifest'); await call('GET', '/api/manifest'); });
    const reg = got.filter((g) => g.path === '/api/register');
    assert.strictEqual(reg.length, 1);
    const p = reg[0].payload;
    assert(p && p.kind === 'register' && p.sim === 'rapid-10-bubble' && p.launchUrl === 'https://rapidsims.example/sim10' && p.title === config.title && p.minutes === config.minutes);
    assert.strictEqual(p.number, 10);
    assert.strictEqual(p.catalogueRevision, config.catalogueRevision);
    assert.deepStrictEqual(p.detail, config.detail);
    assert(p.detail.world && p.detail.seat && p.detail.beats.length === 3, 'catalogue receives the financial-analysis scenario details');
  });
});

test('platform: completion reported once, after the last outcome, with calls and reasons', async () => {
  process.env.LAUNCH_SECRET = SECRET;
  await withPlatform(async (got) => {
    await withServer(async ({ call, clock }) => {
      const fac = { 'X-Launch-Token': tok({ sub: 'f1', role: 'faculty', course: 'c1', mode: 'session' }) };
      const { code, hostKey } = (await call('POST', '/api/session', { mode: 'individual', cases: ['A'] }, fac)).body;
      const a = { 'X-Launch-Token': tok({ sub: 'sA', role: 'student', course: 'c1' }), 'X-Pid': 'platform:sA' };
      await call('POST', '/api/join', { code }, a);
      const host = { 'X-Host-Key': hostKey };
      await call('POST', '/api/host/start', { code, caseId: 'A' }, host);
      clock.now += 13 * MIN;
      await call('POST', '/api/verdict', { code, caseId: 'A', fields: { call: 'bubble', line: 'bs.cash', lineWhy: 'Cash halves in one quarter.', mind: longMind } }, a);
      clock.now += 10 * MIN;
      assert.strictEqual((await call('POST', '/api/finish', { code }, a)).status, 409, 'not finished before the outcome');
      for (let i = 0; i < 3; i++) await call('POST', '/api/host/reveal', { code, caseId: 'A' }, host);
      const r1 = await call('POST', '/api/finish', { code }, a);
      const r2 = await call('POST', '/api/finish', { code }, a);
      assert.strictEqual(r1.body.reported, true); assert.strictEqual(r2.body.already, true);
      const comp = got.filter((g) => g.path === '/api/complete');
      assert.strictEqual(comp.length, 1, 'reported exactly once');
      const p = comp[0].payload;
      assert(p && p.sub === 'sA' && p.sim === 'rapid-10-bubble' && p.course === 'c1');
      const c = p.summary.companies[0];
      assert.deepStrictEqual([c.company, c.call, c.line, c.status], ['Global Crossing Ltd.', 'bubble', 'Cash and cash equivalents', 'recorded']);
      assert(JSON.stringify(p.summary).length < 6000, 'fits the platform summary limit');
    });
  });
});

test('solo: platform Play starts a private timed run, with course-bound identity and staged completion', async () => {
  await withPlatform(async (got) => withServer(async ({ call, clock }) => {
    const auth = { 'X-Launch-Token': tok({ sub: 'solo', role: 'student', course: 'course-1' }) };
    const made = await call('POST', '/api/solo', { cases: ['A', 'B'] }, auth);
    assert.strictEqual(made.status, 200);
    assert(!made.body.hostKey, 'private host key stays on server');
    const { code, pid } = made.body;
    const me = { ...auth, 'X-Pid': pid };
    const state = () => call('GET', `/api/state?code=${code}`, null, me);
    assert.strictEqual((await state()).body.phase, 'read');
    assert((await state()).body.endsAt > clock.now, 'visible reading deadline immediately');
    assert.strictEqual((await call('POST', '/api/join', { code }, auth)).status, 403);
    assert.strictEqual((await call('GET', `/api/session?code=${code}`)).status, 403);
    assert.strictEqual((await call('GET', `/api/join?session=${code}`)).status, 403);
    const other = { 'X-Launch-Token': tok({ sub: 'other', role: 'student', course: 'course-1' }), 'X-Pid': pid };
    assert.strictEqual((await call('GET', `/api/state?code=${code}`, null, other)).status, 403);
    assert.strictEqual((await call('GET', `/api/state?code=${code}`, null, { ...me, 'X-Launch-Token': tok({ sub: 'solo', role: 'student', course: 'course-2' }) })).status, 403);
    assert.strictEqual((await call('POST', '/api/solo/advance', { code, caseId: 'A', stage: 0 }, me)).status, 409);
    assert.strictEqual((await call('POST', '/api/solo', { cases: ['A'] }, { 'X-Launch-Token': tok({ sub: 'faculty', role: 'faculty', mode: 'session' }) })).status, 403);
    for (const caseId of ['A', 'B']) {
      clock.now += 7 * MIN;
      assert.strictEqual((await call('POST', '/api/verdict', { code, caseId, fields: { call: 'infra', line: 'bs.cash', lineWhy: 'Cash supports the investment.', mind: longMind } }, me)).status, 200);
      clock.now += 4 * MIN;
      assert.strictEqual((await call('POST', '/api/finish', { code }, me)).status, 409);
      const first = await Promise.all([0, 1].map(() => call('POST', '/api/solo/advance', { code, caseId, stage: 0 }, me)));
      assert.deepStrictEqual(first.map(r => r.status).sort(), [200, 409], 'duplicate clicks release just one part');
      for (const stage of [1, 2]) assert.strictEqual((await call('POST', '/api/solo/advance', { code, caseId, stage }, me)).status, 200);
      if (caseId === 'A') {
        assert.strictEqual((await call('POST', '/api/finish', { code }, me)).status, 409, 'second company still pending');
        assert.strictEqual((await call('POST', '/api/solo/advance', { code, caseId, stage: 3 }, me)).status, 200);
        assert.strictEqual((await state()).body.caseId, 'B');
        assert.strictEqual((await state()).body.phase, 'read');
      }
    }
    assert.strictEqual((await state()).body.nextPart, null);
    assert.strictEqual((await call('POST', '/api/finish', { code }, me)).body.reported, true);
    assert.strictEqual((await call('POST', '/api/finish', { code }, me)).body.already, true);
    const reports = got.filter(x => x.path === '/api/complete');
    assert.strictEqual(reports.length, 1);
    assert.strictEqual(reports[0].payload.course, 'course-1');
    assert.strictEqual(reports[0].payload.summary.companies.length, 2);
  }));
});

test('solo recovery: a fresh owner token restores the same run without resetting progress or clocks', async () => {
  await withServer(async ({ call, clock, store }) => {
    const owner = { 'X-Launch-Token': tok({ sub: 'resume-owner', role: 'student', course: 'c1' }) };
    const made = await call('POST', '/api/solo', { cases: ['A', 'B'] }, owner);
    assert.strictEqual(made.status, 200);
    const { code, pid } = made.body;
    const me = { ...owner, 'X-Pid': pid };
    clock.now += 7 * MIN;
    assert.strictEqual((await call('POST', '/api/verdict', {
      code, caseId: 'A', fields: { call: 'bubble', line: 'bs.cash', lineWhy: 'Cash halves in one quarter.', mind: longMind },
    }, me)).status, 200);
    clock.now += 4 * MIN;
    assert.strictEqual((await call('POST', '/api/solo/advance', { code, caseId: 'A', stage: 0 }, me)).status, 200);

    const fresh = { 'X-Launch-Token': tok({ sub: 'resume-owner', role: 'student', course: 'c1', iat: clock.now, exp: clock.now + 3600e3 }) };
    const before = await E.getSession(store, code);
    const stateBefore = await call('GET', `/api/state?code=${code}`, null, me);
    const recovered = await call('GET', `/api/session?code=${code.toLowerCase()}`, null, fresh);
    assert.strictEqual(recovered.status, 200, 'no lost-tab X-Pid is needed to recover the account');
    assert.deepStrictEqual(recovered.body, { code, mode: 'individual', teams: null, cases: ['A', 'B'], platform: true, solo: true, pid },
      'recovery exposes entry metadata only, with no host key, answers or unreleased content');
    const resumed = { ...fresh, 'X-Pid': recovered.body.pid };
    assert.deepStrictEqual(await E.getSession(store, code), before, 'lookup does not change the stored run');
    assert.deepStrictEqual(await call('GET', `/api/state?code=${code}`, null, resumed), stateBefore);
    assert.strictEqual(stateBefore.body.soloStage, 1);
    assert.strictEqual(stateBefore.body.mine.mind, longMind);

    for (const stage of [1, 2, 3]) assert.strictEqual((await call('POST', '/api/solo/advance', { code, caseId: 'A', stage }, resumed)).status, 200);
    const next = await call('GET', `/api/state?code=${code}`, null, resumed);
    assert.strictEqual(next.body.caseId, 'B');
    assert.strictEqual(next.body.phase, 'read');
    clock.now += MIN;
    assert.strictEqual((await call('GET', `/api/session?code=${code}`, null, fresh)).status, 200);
    assert.strictEqual((await call('GET', `/api/state?code=${code}`, null, resumed)).body.endsAt, next.body.endsAt,
      'reopening the link does not restart the next company clock');
    clock.now += 10 * MIN;
    for (const stage of [0, 1, 2]) assert.strictEqual((await call('POST', '/api/solo/advance', { code, caseId: 'B', stage }, resumed)).status, 200);
    assert.strictEqual((await call('GET', `/api/session?code=${code}`, null, fresh)).status, 200, 'completed runs can still be recovered');
    assert.strictEqual((await call('GET', `/api/state?code=${code}`, null, resumed)).body.nextPart, null);
  });
});

test('solo recovery: anonymous, other-account, other-course and invalid-token requests cannot claim a run', async () => {
  await withServer(async ({ call, store }) => {
    const owner = { sub: 'private-owner', role: 'student', course: 'c1' };
    const made = await call('POST', '/api/solo', { cases: ['A'] }, { 'X-Launch-Token': tok(owner) });
    assert.strictEqual(made.status, 200);
    const { code, pid } = made.body;
    const before = await E.getSession(store, code);
    const valid = tok(owner);
    const attempts = [
      ['anonymous', null, 403],
      ['other account', tok({ ...owner, sub: 'intruder' }), 403],
      ['other course', tok({ ...owner, course: 'c2' }), 403],
      ['missing course', tok({ ...owner, course: undefined }), 403],
      ['other sim', tok({ ...owner, sim: 'rapid-08-later' }), 401],
      ['expired', tok({ ...owner, exp: T0 - 1 }), 401],
      ['tampered', valid.slice(0, -2) + 'xx', 401],
    ];
    for (const [label, token, status] of attempts) {
      const headers = { 'X-Pid': pid, ...(token ? { 'X-Launch-Token': token } : {}) };
      const response = await call('GET', `/api/session?code=${code}`, null, headers);
      assert.strictEqual(response.status, status, label);
      assert.deepStrictEqual(Object.keys(response.body).sort(), ['error', 'message'], `${label} receives no private metadata`);
      assert.strictEqual((await call('GET', `/api/state?code=${code}`, null, headers)).status, token ? status : 401, `${label} cannot read the owner's state`);
      assert.strictEqual((await call('POST', '/api/solo/advance', { code, caseId: 'A', stage: 0 }, headers)).status, token ? status : 401,
        `${label} cannot advance the owner's run`);
    }
    assert.deepStrictEqual(await E.getSession(store, code), before, 'failed recovery attempts leave the run intact');
  });
});

test('solo recovery: platform sign-in cannot take over a guest private run', async () => {
  process.env.ACCESS_CODE = 'guest-recovery-test';
  try {
    await withServer(async ({ call }) => {
      const made = await call('POST', '/api/solo', { cases: ['A'] }, { 'X-Access-Code': process.env.ACCESS_CODE });
      assert.strictEqual(made.status, 200);
      const { code, pid } = made.body;
      for (const headers of [{}, { 'X-Access-Code': process.env.ACCESS_CODE },
        { 'X-Launch-Token': tok({ sub: pid, role: 'student' }) }]) {
        assert.strictEqual((await call('GET', `/api/session?code=${code}`, null, headers)).status, 403);
      }
      assert.strictEqual((await call('GET', `/api/state?code=${code}`, null, { 'X-Pid': pid })).status, 200,
        'the original guest capability still works');
    });
  } finally { delete process.env.ACCESS_CODE; }
});

test('solo: direct play requires access, guest identity is private, class players cannot advance themselves', async () => {
  delete process.env.ACCESS_CODE;
  await withServer(async ({ call }) => {
    assert.strictEqual((await call('POST', '/api/solo', { cases: ['A'] })).status, 503);
    process.env.ACCESS_CODE = 'solo-code';
    assert.strictEqual((await call('POST', '/api/solo', { cases: ['A'] })).status, 401);
    const r = await call('POST', '/api/solo', { cases: ['A'] }, { 'X-Access-Code': 'solo-code' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await call('GET', `/api/state?code=${r.body.code}`, null, { 'X-Pid': r.body.pid })).status, 200);
    assert.strictEqual((await call('GET', `/api/state?code=${r.body.code}`, null, { 'X-Pid': 'wrong' })).status, 403);
    const fac = { 'X-Launch-Token': tok({ sub: 'fac', role: 'faculty' }) };
    const s = (await call('POST', '/api/session', { mode: 'individual', cases: ['A'] }, fac)).body;
    const student = { 'X-Launch-Token': tok({ sub: 'student', role: 'student' }) };
    const j = (await call('POST', '/api/join', { code: s.code }, student)).body;
    assert.strictEqual((await call('POST', '/api/solo/advance', { code: s.code, caseId: 'A', stage: 0 }, { ...student, 'X-Pid': j.pid })).status, 403);
  });
  delete process.env.ACCESS_CODE;
});

test('production: missing Redis fails clearly; dev access and accelerated clocks are disabled on Vercel', async () => {
  const saved = { ...process.env };
  try {
    for (const k of ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) delete process.env[k];
    process.env.VERCEL = '1'; process.env.DEV_OPEN = '1'; process.env.SIM10_CLOCK_SCALE = '0.01';
    await withServer(async ({ call }) => {
      assert.deepStrictEqual((await call('GET', '/api/health')).body, { ok: true, sim: config.simId });
      assert.strictEqual((await call('GET', '/api/whoami')).body.faculty, false);
      const r = await call('POST', '/api/solo', { cases: ['A'] }, { 'X-Launch-Token': tok({ sub: 's', role: 'student' }) });
      assert.strictEqual(r.status, 503); assert(r.body.message.includes('Redis'));
    }, { useDefault: true });
    await withServer(async ({ call }) => {
      assert.strictEqual((await call('POST', '/api/session', { mode: 'individual', cases: ['A'] })).status, 401);
      assert.strictEqual((await call('POST', '/api/solo', { cases: ['A'] })).status, 503, 'dev bypass does not enable direct entry');
    });
    const { s } = await setup('individual');
    assert.deepStrictEqual(s.clock, config.clock['1-individual']);
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});

test('completion: concurrent callbacks are serialized and a failed callback retries', async () => {
  const store = memoryStore(); let calls = 0;
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const attempt = () => E.markReported(store, 'TEST2', 'p', async () => { calls++; await blocked; return { ok: false }; }, T0);
  const one = attempt(); const two = attempt();
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(calls, 1);
  release();
  const results = await Promise.all([one, two]);
  assert(results.some(x => x.pending));
  assert.strictEqual((await E.markReported(store, 'TEST2', 'p', async () => ({ ok: true }), T0 + 1)).reported, true);
  assert.strictEqual((await E.markReported(store, 'TEST2', 'p', () => assert.fail('already reported'), T0 + 2)).already, true);
});

test('mount path: prefixed pages and APIs work without exposing server content', async () => {
  process.env.BASE_PATH = '/sim10/';
  try {
    await withServer(async ({ call }) => {
      for (const p of ['/sim10', '/sim10/', '/sim10/play', '/sim10/host', '/sim10/console']) {
        const r = await call('GET', p);
        assert.strictEqual(r.status, 200, p);
        assert(r.body.includes('<base href="/sim10/">'), p);
      }
      assert.strictEqual((await call('GET', '/sim10/api/health')).status, 200);
      assert.strictEqual((await call('GET', '/sim100/api/health')).status, 404);
      assert.strictEqual((await call('GET', '/sim10/data/config.js')).status, 404);
      assert.strictEqual((await call('GET', '/sim10/lib/launch.js')).status, 404);
    });
  } finally { delete process.env.BASE_PATH; }
});

test('client: solo entry, signed account rejoin and scoped tokens use the real API', async () => {
  await withServer(async ({ call }) => require('./client').check({ call, tok, T0 }));
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ok   ${t.name}`); }
    catch (e) { failed++; console.log(`  FAIL ${t.name}\n       ${e.message.split('\n').join('\n       ')}`); }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed`);
  process.exit(failed ? 1 : 0);
})();
