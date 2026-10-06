'use strict';
const fs = require('fs');
const path = require('path');
const config = require('../data/config');
const engine = require('./engine');
const L = require('./launch');
const { defaultStore } = require('./store');
const { health } = require('./health');

const PUBLIC = path.join(__dirname, '..', 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const PAGES = { '/': 'index.html', '/play': 'play.html', '/host': 'host.html', '/console': 'console.html' };
const STATUS = { bad_request: 400, unauthorized: 401, forbidden: 403, not_found: 404, conflict: 409, closed: 423, unavailable: 503 };
const DEV = () => !process.env.VERCEL && process.env.DEV_OPEN === '1';

// Faculty: a platform launch token for this sim, or a standalone FACULTY_CODES
// entry ("Name:code,Other:code"). Fails closed when neither is configured.
function facultyOf(req, launch) {
  if (L.isFaculty(launch)) return { platformAuth: true, courseId: launch.course || null, name: launch.name || 'Facilitator' };
  const given = String(req.headers['x-faculty-code'] || '').trim();
  const roster = String(process.env.FACULTY_CODES || '').split(',').map((x) => x.trim()).filter(Boolean)
    .filter((x) => x.lastIndexOf(':') > 0)
    .map((x) => { const i = x.lastIndexOf(':'); return { name: x.slice(0, i).trim(), code: x.slice(i + 1).trim() }; })
    .filter((x) => x.name && x.code);
  const hit = given && roster.find((r) => r.code === given);
  if (hit) return { platformAuth: false, name: hit.name };
  if (DEV()) return { platformAuth: false, name: 'Local host' };
  return null;
}

// Standalone (non-platform) student entry needs ACCESS_CODE; unset means closed.
function standaloneOk(req) {
  if (DEV()) return true;
  const need = process.env.ACCESS_CODE;
  if (!need) throw new engine.SimError('unavailable', 'Open this sim from RapidSims. Direct access is not set up.');
  if (req.headers['x-access-code'] !== need) throw new engine.SimError('unauthorized', 'Enter the class access code.');
  return true;
}

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string';
  res.writeHead(status, { 'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(isJson ? JSON.stringify(body) : body);
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;   // Vercel pre-parses
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new engine.SimError('bad_request', 'Body must be JSON.'); }
}

function basePath() {
  const b = process.env.BASE_PATH || '/';
  return b.endsWith('/') ? b : `${b}/`;
}

function serveStatic(res, rel) {
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) return send(res, 404, 'Not found');
  let body = fs.readFileSync(file, 'utf8');
  if (rel.endsWith('.html')) body = body.replace('<!--BASE-->', `<base href="${basePath()}">`);
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'text/plain', 'Cache-Control': 'no-cache' });
  res.end(body);
}

function createApp({ store: injectedStore, clock = () => Date.now() } = {}) {
  return async function handler(req, res) {
    const url = new URL(req.url, 'http://x');
    let p = url.pathname;
    const base = basePath();
    if (base !== '/' && (p === base.slice(0, -1) || p.startsWith(base))) p = p.slice(base.length - 1) || '/';
    const now = clock();
    const pid = req.headers['x-pid'];
    if (req.method === 'GET' && p === '/api/health') return send(res, 200, health(req), { 'Cache-Control': 'no-store, max-age=0, must-revalidate' });
    await L.announce();                                  // once per cold start
    const rawToken = req.headers['x-launch-token'];
    const launch = rawToken ? L.launchFor(String(rawToken), now) : null;
    if (rawToken && !launch && p.startsWith('/api/')) return send(res, 401, { error: 'launch_token_invalid', message: 'Your RapidSims sign-in is not valid for this sim. Open it again from RapidSims.' });
    const hostKey = req.headers['x-host-key'];
    try {
      if (req.method === 'GET' && PAGES[p]) return serveStatic(res, PAGES[p]);
      if (req.method === 'GET' && /^\/[a-z0-9-]+\.(css|js|svg)$/.test(p)) return serveStatic(res, p.slice(1));

      if (p === '/api/manifest') return send(res, 200, { simId: config.simId, title: config.title, tagline: config.tagline, description: config.description, minutes: config.minutes, route: config.route });
      if (req.method === 'GET' && p === '/api/access') {
        if (!launch) standaloneOk(req);
        return send(res, 200, { ok: true });
      }
      if (req.method === 'GET' && p === '/api/whoami') {
        const f = facultyOf(req, launch);
        return send(res, 200, { faculty: !!f, platform: !!(f && f.platformAuth), student: !!launch && !L.isFaculty(launch) });
      }
      const store = injectedStore || defaultStore();
      if (!store) throw new engine.SimError('unavailable', 'Session storage is not configured. Ask the administrator to connect Redis and redeploy this sim.');
      if (req.method === 'GET' && p === '/api/join') {
        const s = await engine.getSession(store, url.searchParams.get('session'));
        if (s.solo) throw new engine.SimError('forbidden', 'This is a private run. Start your own from RapidSims.');
        res.writeHead(302, { Location: s.platformAuth ? engine.platformJoinUrl(s) : `${basePath()}?session=${encodeURIComponent(s.code)}` });
        return res.end();
      }

      const body = req.method === 'POST' ? await readBody(req) : {};
      const q = (k) => url.searchParams.get(k);

      const STUDENT = ['GET /api/state', 'POST /api/verdict', 'POST /api/private', 'POST /api/team/draft', 'POST /api/team/commit'];
      if (STUDENT.includes(`${req.method} ${p}`)) await engine.checkIdentity(store, q('code') || body.code, pid, launch);

      switch (`${req.method} ${p}`) {
        case 'POST /api/solo': {
          if (!launch) standaloneOk(req);
          if (launch && launch.mode === 'session') throw new engine.SimError('forbidden', 'Use the class session setup for this launch.');
          return send(res, 200, await engine.createSolo(store, body, now, launch));
        }
        case 'POST /api/solo/advance': {
          await engine.advanceSolo(store, body.code, pid, launch, body, now);
          return send(res, 200, { ok: true });
        }
        case 'POST /api/session': {
          const who = facultyOf(req, launch);
          if (!who) throw new engine.SimError('unauthorized', 'Open this sim from RapidSims as faculty, or enter your facilitator code.');
          const s = await engine.createSession(store, body, now, who);
          return send(res, 200, { code: s.code, hostKey: s.hostKey });
        }
        case 'GET /api/session': {
          const s = await engine.getSession(store, q('code'));
          if (s.solo) {
            if (!launch) throw new engine.SimError('forbidden', 'This is a private run. Sign in to the RapidSims account that started it to resume.');
            const ownerPid = `platform:${launch.sub}`;
            if (s.soloPid !== ownerPid || (s.courseId && launch.course !== s.courseId)) {
              throw new engine.SimError('forbidden', 'This private run belongs to another RapidSims account.');
            }
            return send(res, 200, { code: s.code, mode: s.mode, teams: s.teams, cases: s.cases, platform: true, solo: true, pid: ownerPid });
          }
          return send(res, 200, { code: s.code, mode: s.mode, teams: s.teams, cases: s.cases, platform: s.platformAuth, joinUrl: s.platformAuth ? engine.platformJoinUrl(s) : null });
        }
        case 'POST /api/join': {
          const s = await engine.getSession(store, body.code);
          if (!s.platformAuth) standaloneOk(req);
          return send(res, 200, await engine.join(store, body.code, body, now, launch));
        }
        case 'POST /api/finish': {
          if (!launch) return send(res, 200, { ok: true, reported: false, reason: 'not_platform_launch' });
          const s = await engine.checkIdentity(store, body.code, pid, launch);
          if (!s.platformAuth) return send(res, 200, { ok: true, reported: false, reason: 'standalone' });
          const done = await engine.completionFor(store, s.code, pid, now);
          if (!done) throw new engine.SimError('conflict', 'Not finished yet.');
          const r = await engine.markReported(store, s.code, pid, () => L.reportCompletion({ launch, ...done }), now);
          return send(res, 200, { ok: true, ...r });
        }
        case 'GET /api/state': return send(res, 200, await engine.studentState(store, q('code'), pid, now));
        case 'POST /api/verdict': return send(res, 200, await engine.saveIndividual(store, body.code, pid, body.caseId, body.fields || {}, now));
        case 'POST /api/private': return send(res, 200, await engine.savePrivate(store, body.code, pid, body.caseId, body.call, now));
        case 'POST /api/team/draft': return send(res, 200, await engine.saveTeamDraft(store, body.code, pid, body.caseId, body.fields || {}, now));
        case 'POST /api/team/commit': return send(res, 200, await engine.commitTeam(store, body.code, pid, body.caseId, now));
        case 'GET /api/console': return send(res, 200, await engine.consoleState(store, q('code'), hostKey, now));
        case 'POST /api/host/start': await engine.startCase(store, body.code, hostKey, body.caseId, now); return send(res, 200, { ok: true });
        case 'POST /api/host/reveal': await engine.advanceReveal(store, body.code, hostKey, body.caseId, now); return send(res, 200, { ok: true });
        case 'POST /api/host/project': await engine.project(store, body.code, hostKey, body.caseId, body, now); return send(res, 200, { ok: true });
        default: return send(res, 404, { error: 'not_found', message: 'Unknown route.' });
      }
    } catch (e) {
      if (e instanceof engine.SimError) return send(res, STATUS[e.code] || 400, { error: e.code, message: e.message });
      console.error(e);
      return send(res, 500, { error: 'server', message: 'Something went wrong on the server. Try again in a moment.' });
    }
  };
}

module.exports = { createApp };
