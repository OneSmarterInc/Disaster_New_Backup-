'use strict';
// Execute shipped entry scripts against the real HTTP handler, with only the
// DOM/storage substituted. These checks do not claim browser rendering coverage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const publicDir = path.join(__dirname, '../public');
function browserMount(html, pathname, injectedBase) {
  let base = { href: injectedBase };
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const document = { querySelector: () => base, createElement: () => ({}), head: { appendChild: el => { base = el; } } };
  vm.runInNewContext(script, { document, location: { pathname } });
  return base.href;
}
const storage = () => {
  const m = new Map();
  return { getItem: k => m.get(k) || null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
};

async function page(url, call, ss = storage(), kind = 'index', platformCall = null) {
  let current = new URL(url), navigated = null, base = null;
  class Element {
    constructor() { this.hidden = false; this.disabled = false; this.value = ''; this.textContent = ''; this.events = {}; }
    addEventListener(name, fn) { this.events[name] = fn; }
    focus() {}
  }
  const html = fs.readFileSync(path.join(publicDir, `${kind}.html`), 'utf8');
  const elements = new Map();
  for (const [tag, id] of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    const el = new Element(); el.hidden = /\shidden(?:\s|>)/.test(tag); elements.set('#' + id, el);
  }
  const document = {
    querySelector: selector => selector === 'base' ? base : elements.get(selector),
    createElement: () => new Element(),
    head: { appendChild(el) { base = el; } }
  };
  const resolvedBase = () => new URL(base?.href || current.href, current);
  const location = {
    get pathname() { return current.pathname; }, get search() { return current.search; }, get hash() { return current.hash; },
    set href(value) { navigated = new URL(value, resolvedBase()).href; },
    replace(value) { navigated = new URL(value, resolvedBase()).href; }
  };
  const requests = [];
  const ctx = vm.createContext({
    document, location, sessionStorage: ss, localStorage: storage(), URLSearchParams, AbortSignal, console,
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    history: { replaceState(a, b, u) { current = new URL(u, current); } },
    fetch: async (u, opt = {}) => {
      const target = new URL(u, resolvedBase()); requests.push(target.pathname + target.search);
      const r = target.pathname === '/api/launch' && platformCall
        ? await platformCall(target.pathname + target.search)
        : await call(opt.method || 'GET', target.pathname + target.search,
          opt.body ? JSON.parse(opt.body) : undefined, opt.headers);
      return { status: r.status, ok: r.status >= 200 && r.status < 300, json: async () => r.body };
    }
  });
  for (const [tag] of html.matchAll(/<script(?:\s+src="([^"]+)")?>([\s\S]*?)<\/script>/g)) {
    // Destructure explicitly: optional external script filename is group 1.
    const match = tag.match(/src="([^"]+)"/);
    let code = match ? fs.readFileSync(path.join(publicDir, match[1]), 'utf8') : tag.replace(/^<script>/, '').replace(/<\/script>$/, '');
    if (match && match[1] === 'play.js') continue; // Render is covered by syntax checks, not a fake layout engine.
    code = code.replace(/initEntry\(\);\s*$/, 'globalThis.ready = initEntry();');
    vm.runInContext(code, ctx);
  }
  if (ctx.ready) await ctx.ready;
  return {
    el: id => elements.get('#' + id), ss, requests, run: code => vm.runInContext(code, ctx),
    target: () => navigated, base: () => base?.href,
    submit: async id => elements.get('#' + id).events.submit({ preventDefault() {} }),
  };
}

async function check({ call, tok }) {
  const previous = process.env.BASE_PATH;
  process.env.BASE_PATH = '/sim10/';
  try {
    for (const file of ['index.html', 'play.html', 'host.html', 'console.html']) {
      const html = fs.readFileSync(path.join(publicDir, file), 'utf8');
      assert.equal(browserMount(html, '/sim10/play', '/'), '/sim10/', `${file} corrects the base behind the platform rewrite`);
      assert.equal(browserMount(html, '/play', '/sim10/'), '/', `${file} corrects the base on the sim's own domain`);
    }
    for (const file of fs.readdirSync(publicDir)) {
      const text = fs.readFileSync(path.join(publicDir, file), 'utf8');
      if (file.endsWith('.js')) new vm.Script(text, { filename: file });
      if (file.endsWith('.html')) for (const [, script] of text.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script, { filename: file });
    }
    const token = tok({ sub: 'first', role: 'student', course: 'c1' });
    const root = await page(`https://fixture/sim10#lt=${token}`, call);
    assert.equal(root.base(), '/sim10/');
    assert.equal(root.el('solo').hidden, false);
    assert.equal(root.el('entry-options').hidden, false, 'valid platform Play bypasses the standalone gate');
    assert.equal(root.el('access-gate').hidden, true);
    root.el('solo-cases').value = 'A';
    await root.submit('solo-form');
    const next = new URL(root.target()); const code = next.searchParams.get('code');
    assert.equal(next.pathname, '/sim10/play');
    assert.equal(root.ss.getItem('s10-lt:' + code), token);
    assert.equal(root.ss.getItem('s10:' + code), 'platform:first');
    const play = await page(next.href, call, root.ss, 'play');
    assert.equal(play.run('launchToken()'), token, 'navigation preserves this run token');
    const state = await play.run(`api('GET', 'api/state?code=${code}', null, {'X-Pid':'platform:first'})`);
    assert(state.solo && state.phase === 'read' && state.endsAt > state.serverNow);
    const resume = await page(`https://fixture/sim10/#lt=${token}`, call, root.ss);
    assert.equal(resume.el('solo-resume').hidden, false);
    const otherCourse = await page(`https://fixture/sim10/#lt=${tok({ sub: 'first', role: 'student', course: 'c2' })}`, call, root.ss);
    assert.equal(otherCourse.el('solo-resume').hidden, true, 'different course cannot resume this solo');

    const fac = tok({ sub: 'faculty', role: 'faculty', course: 'c1', mode: 'session' });
    const facultyPage = await page(`https://fixture/sim10/#lt=${fac}`, call);
    assert.equal(facultyPage.target(), 'https://fixture/sim10/host');
    const made = await call('POST', '/sim10/api/session', { mode: 'individual', cases: ['A'] }, { 'X-Launch-Token': fac });
    const classCode = made.body.code;
    const first = await page(`https://fixture/sim10/?session=${classCode}#lt=${token}`, call, root.ss);
    assert.equal(first.ss.getItem('s10:' + classCode), 'platform:first');
    const secondToken = tok({ sub: 'second', role: 'student', course: 'c1' });
    const second = await page(`https://fixture/sim10/?session=${classCode}#lt=${secondToken}`, call, root.ss);
    assert.equal(second.ss.getItem('s10:' + classCode), 'platform:second', 'new account re-joins instead of trusting old pid');
    assert.equal(second.ss.getItem('s10-lt:' + code), token, 'class token does not overwrite a private run');
    assert(second.target().includes('/sim10/play?code='));
    assert(second.requests.every(p => p.startsWith('/sim10/api/')));
    const noPid = fs.readFileSync(path.join(publicDir, 'play.js'), 'utf8').split('let view = null;')[0];
    let recovery = null;
    const noPidLocation = { pathname: '/sim10/play', search: `?code=${classCode}`, replace: (url) => { recovery = url; } };
    vm.runInNewContext(noPid, {
      URLSearchParams, encodeURIComponent, location: noPidLocation,
      participantKey: code => `s10:${code}`,
      sessionStorage: { getItem: () => null }
    });
    assert.equal(recovery, `./?session=${classCode}`, 'a missing same-tab participant returns to the class-session join path');

    const ownerToken = tok({ sub: 'resume', role: 'student', course: 'c1' });
    const privateRun = await call('POST', '/sim10/api/solo', { cases: ['A'] }, { 'X-Launch-Token': ownerToken });
    assert.equal(privateRun.status, 200);
    const resumedEntry = await page(`https://fixture/sim10/?session=${privateRun.body.code}`, call, storage(), 'index', async (path) => {
      assert.equal(path, `/api/launch?sim=rapid-10-bubble&format=json&session=${privateRun.body.code}`);
      return { status: 200, body: { url: `https://fixture/sim10/?session=${privateRun.body.code}#lt=${ownerToken}` } };
    });
    assert.equal(resumedEntry.target(), `https://fixture/sim10/?session=${privateRun.body.code}#lt=${ownerToken}`,
      'a signed-in student gets a fresh launch token for the run-code link');
    const resumed = await page(resumedEntry.target(), call, storage(), 'index');
    assert.equal(resumed.target(), `https://fixture/sim10/play?code=${privateRun.body.code}`,
      'the owner returns to the same private run without the lost tab id');
    assert.equal(resumed.ss.getItem(`s10:${privateRun.body.code}`), 'platform:resume');
    const resumedPlay = await page(resumed.target(), call, resumed.ss, 'play');
    const resumedState = await resumedPlay.run(`api('GET', 'api/state?code=${privateRun.body.code}', null, {'X-Pid':sessionStorage.getItem('s10:${privateRun.body.code}')})`);
    assert.equal(resumedState.phase, 'read', 'the recovered run reconnects to its live state');

    const unknown = await page('https://fixture/sim10/?session=ZZZZ2', call, root.ss);
    assert.equal(unknown.run('launchToken()'), null, 'a different invitation does not borrow a prior account token');

    process.env.ACCESS_CODE = 'entry-code-test';
    try {
      const direct = await page('https://fixture/sim10/', call);
      assert.equal(direct.el('access-gate').hidden, false);
      assert.equal(direct.el('entry-options').hidden, true, 'direct visitor sees no play/join choices before code verification');
      const guest = await page('https://fixture/sim10/?guest=1', call);
      assert.equal(guest.el('access-gate').hidden, false);
      assert.equal(guest.el('entry-error').textContent, '', 'a guest is not told the code is invalid before entering one');
      direct.el('entry-code').value = 'wrong'; await direct.submit('access-gate');
      assert.equal(direct.el('entry-options').hidden, true);
      assert.equal(direct.ss.getItem('s10-access'), null, 'wrong code is not remembered');
      direct.el('entry-code').value = 'entry-code-test'; await direct.submit('access-gate');
      assert.equal(direct.el('entry-options').hidden, false);
      assert.equal(direct.el('access-gate').hidden, true);
      const refreshed = await page('https://fixture/sim10/', call, direct.ss);
      assert.equal(refreshed.el('entry-options').hidden, false, 'remembered code is revalidated on refresh');
      process.env.ACCESS_CODE = 'rotated-code';
      const rotated = await page('https://fixture/sim10/', call, direct.ss);
      assert.equal(rotated.el('entry-options').hidden, true, 'revoked code closes the entry gate');
      const forged = await page('https://fixture/sim10/#lt=not.a.valid.token', call);
      assert.equal(forged.el('entry-options').hidden, true, 'invalid launch cannot bypass the gate');
      assert(forged.el('entry-error').textContent.includes('RapidSims'));
    const invitation = await page(`https://fixture/sim10/?session=${classCode}`, call);
    assert(new URL(invitation.target()).pathname === '/session.html', 'unsigned class invitation goes to platform sign-in');

    const autoLaunchToken = tok({ sub: 'auto', role: 'student', course: 'c1' });
    const autoLaunch = await page('https://fixture/sim10/', call, storage(), 'index', async (path) => {
      assert.equal(path, '/api/launch?sim=rapid-10-bubble&format=json');
      return { status: 200, body: { url: `https://fixture/sim10/#lt=${autoLaunchToken}` } };
    });
    assert.equal(autoLaunch.target(), `https://fixture/sim10/#lt=${autoLaunchToken}`, 'a signed-in student at the sim URL is routed through RapidSims entitlement');

    const notEntitled = await page('https://fixture/sim10/', call, storage(), 'index', async () => ({
      status: 403, body: { message: 'This simulation is not assigned to your course.' }
    }));
    assert.equal(notEntitled.el('entry-status').textContent, 'This simulation is not assigned to your course.');
    assert.equal(notEntitled.el('access-gate').hidden, true, 'a signed-in account without entitlement gets an explanation instead of an access-code prompt');
    assert.equal(notEntitled.el('manual-access').hidden, true, 'an assigned account without entitlement cannot fall into the guest code path');
    } finally { delete process.env.ACCESS_CODE; }

    // The completion endpoint can return HTTP 200 with reported:false after a
    // transient platform failure. The shipped player must retry that too.
    const player = fs.readFileSync(path.join(publicDir, 'play.js'), 'utf8');
    let attempts = 0;
    const completion = vm.createContext({ CODE: code, headers: {}, launchToken: () => token,
      api: async () => { attempts++; return { reported: attempts >= 3, pending: attempts === 2 }; }
    });
    vm.runInContext(player.slice(player.indexOf('let finishSent = false;')), completion);
    const complete = "maybeFinish({cases:['A'],caseId:'A',reveal:{stage:3}})";
    for (let i = 0; i < 4; i++) { vm.runInContext(complete, completion); await new Promise(resolve => setImmediate(resolve)); }
    assert.equal(attempts, 3, 'failed and pending reports retry; successful report stops');
  } finally {
    if (previous === undefined) delete process.env.BASE_PATH; else process.env.BASE_PATH = previous;
  }
}

module.exports = { check };
