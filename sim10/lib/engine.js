'use strict';
const crypto = require('crypto');
const config = require('../data/config');
const copy = require('../data/copy');
const content = require('./content');
const { findHits } = require('./denylist');

const CALLS = ['infra', 'bubble'];
const MAX_TEXT = 2000;
const K = {
  sess: (c) => `s10:sess:${c}`,
  pids: (c) => `s10:sess:${c}:pids`,
  part: (c, p) => `s10:p:${c}:${p}`,
  resp: (c, cs, p) => `s10:r:${c}:${cs}:${p}`,
  draft: (c, cs, t) => `s10:t:${c}:${cs}:${t}`,
  commit: (c, cs, t) => `s10:tc:${c}:${cs}:${t}`,
  report: (c, p) => `s10:done:${c}:${p}`,
};

class SimError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const fail = (code, msg) => { throw new SimError(code, msg); };

const packCache = {};
const pack = (cs) => (packCache[cs] ||= content.buildPack(cs));
const pickerTags = (cs) => new Set(pack(cs).picker.map((p) => p.tag));
const pickerLabel = (cs, tag) => (pack(cs).picker.find((p) => p.tag === tag) || {}).label || tag;

function newCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = ''; const b = crypto.randomBytes(5);
  for (const x of b) s += alphabet[x % alphabet.length];
  return s;
}
const newId = () => crypto.randomBytes(12).toString('hex');

// ---------- clock ----------
function phaseList(session) {
  const c = session.clock;
  const min = (m) => Math.round(m * 60000);
  return session.mode === 'individual'
    ? [{ name: 'read', ms: min(c.read) }, { name: 'verdict', ms: min(c.verdict) }]
    : [{ name: 'read', ms: min(c.read) }, { name: 'private', ms: min(c.private) }, { name: 'team', ms: min(c.team) }];
}

function phaseOf(session, cs, now) {
  const run = session.runs[cs];
  if (!run || !run.startedAt) return { name: 'waiting', endsAt: null };
  let t = run.startedAt;
  for (const p of phaseList(session)) {
    if (now < t + p.ms) return { name: p.name, endsAt: t + p.ms };
    t += p.ms;
  }
  return { name: 'closed', endsAt: t };
}

// Which case a student should be looking at now.
function activeCase(session) {
  if (session.cases.length === 2 && session.runs.B.startedAt) return 'B';
  return 'A';
}

// ---------- sessions ----------
function platformJoinUrl(s) {
  const url = new URL((process.env.PLATFORM_URL || 'https://rapidsims.flexee.org').replace(/\/+$/, '') + '/session.html');
  url.searchParams.set('sim', config.simId);
  url.searchParams.set('session', s.code);
  if (s.courseId) url.searchParams.set('course', s.courseId);
  return url.href;
}

async function createSession(store, opts, now, who = {}) {
  const mode = opts && opts.mode;
  const cases = opts && opts.cases;
  if (!['individual', 'team'].includes(mode)) fail('bad_request', 'Choose individual or team mode.');
  if (!Array.isArray(cases) || !(cases.join() === 'A' || cases.join() === 'A,B')) fail('bad_request', 'Choose one case (A) or two cases (A then B).');
  let teams = null;
  if (mode === 'team') {
    teams = Number(opts.teams);
    if (!Number.isInteger(teams) || teams < 2 || teams > 30) fail('bad_request', 'Team mode needs between 2 and 30 teams.');
  }
  const clock = { ...config.clock[`${cases.length}-${mode}`] };
  // Dev playtests only: shrink the clock. Ignored unless DEV_OPEN=1.
  const speed = !process.env.VERCEL && process.env.DEV_OPEN === '1' ? Number(process.env.SIM10_CLOCK_SCALE) : 0;
  if (speed > 0) for (const k of Object.keys(clock)) clock[k] = clock[k] * speed;
  let code;
  for (let i = 0; i < 5; i++) { code = newCode(); if (!(await store.get(K.sess(code)))) break; }
  const session = {
    code, simId: config.simId, mode, cases, teams, clock, createdAt: now,
    hostKey: newId(),
    platformAuth: !!who.platformAuth, courseId: who.courseId || null, host: who.name || null,
    runs: Object.fromEntries(cases.map((c) => [c, { startedAt: null, reveal: 0 }])),
    projected: Object.fromEntries(cases.map((c) => [c, { pair: null, opposing: null }])),
    showHeld: false,
  };
  await store.set(K.sess(code), session);
  return session;
}

async function getSession(store, code) {
  const s = await store.get(K.sess(String(code || '').toUpperCase()));
  if (!s) fail('not_found', 'No session with that code.');
  return s;
}

function assertHost(session, hostKey) {
  if (!hostKey || hostKey !== session.hostKey) fail('forbidden', 'Only the session host can do that.');
}

async function join(store, code, opts, now, launch = null) {
  const s = await getSession(store, code);
  if (s.solo) fail('forbidden', 'This is a private run. Start your own from RapidSims.');
  let pid;
  if (s.platformAuth) {
    if (!launch) fail('forbidden', 'Open this session from RapidSims with your account.');
    if (s.courseId && launch.course !== s.courseId) fail('forbidden', 'This session belongs to a different course.');
    pid = `platform:${launch.sub}`;
    const existing = await store.get(K.part(s.code, pid));
    if (existing) return { code: s.code, pid, team: existing.team, rejoined: true };
  } else {
    pid = newId();
  }
  let team = null;
  if (s.mode === 'team') {
    team = Number(opts && opts.team);
    if (!Number.isInteger(team) || team < 1 || team > s.teams) fail('bad_request', `Choose a team from 1 to ${s.teams}.`);
  }
  await store.set(K.part(s.code, pid), { pid, team, joinedAt: now });
  await store.sadd(K.pids(s.code), pid);
  return { code: s.code, pid, team };
}

// Platform participants are bound to the signed account, not to a remembered id.
async function checkIdentity(store, code, pid, launch) {
  const s = await getSession(store, code);
  if (s.solo && pid !== s.soloPid) fail('forbidden', 'This private run belongs to someone else.');
  if (!s.platformAuth && !String(pid || '').startsWith('platform:')) return s;
  if (!launch) fail('unauthorized', 'Your RapidSims sign-in has expired. Open the sim again from RapidSims.');
  if (s.courseId && launch.course !== s.courseId) fail('forbidden', 'This session belongs to a different course.');
  if (pid !== `platform:${launch.sub}`) fail('forbidden', 'This browser is signed in as someone else.');
  return s;
}

async function participant(store, s, pid) {
  const p = pid && await store.get(K.part(s.code, pid));
  if (!p) fail('forbidden', 'Join the session first.');
  return p;
}

// Solo uses the same decision clocks and reveals as class play. Only its owner
// can release the next part; the private host capability never leaves the server.
async function createSolo(store, opts, now, launch = null) {
  const s = await createSession(store, { ...opts, mode: 'individual' }, now,
    { platformAuth: !!launch, courseId: launch && launch.course });
  const joined = await join(store, s.code, {}, now, launch);
  s.solo = true;
  s.soloPid = joined.pid;
  s.runs.A.startedAt = now;
  await store.set(K.sess(s.code), s);
  return joined;
}

async function advanceSolo(store, code, pid, launch, expected, now) {
  const s = await checkIdentity(store, code, pid, launch);
  await participant(store, s, pid);
  if (!s.solo) fail('forbidden', 'Only the host can advance a class session.');
  const cs = activeCase(s);
  if (phaseOf(s, cs, now).name !== 'closed') fail('conflict', 'The reveal opens after the clock runs out.');
  if (expected.caseId !== cs || expected.stage !== s.runs[cs].reveal) fail('conflict', 'This run has moved on. Refresh to see the current part.');
  const next = JSON.parse(JSON.stringify(s));
  if (next.runs[cs].reveal < 3) next.runs[cs].reveal++;
  else if (cs === 'A' && next.cases.includes('B')) next.runs.B.startedAt = now;
  else fail('conflict', 'Your run is complete.');
  if (!await store.compareAndSet(K.sess(s.code), s, next)) fail('conflict', 'This run has moved on. Refresh to see the current part.');
}

// ---------- host actions ----------
async function startCase(store, code, hostKey, cs, now) {
  const s = await getSession(store, code); assertHost(s, hostKey);
  if (!s.cases.includes(cs)) fail('bad_request', 'That case is not in this session.');
  if (s.runs[cs].startedAt) fail('conflict', 'That case has already started.');
  if (cs === 'B' && s.runs.A.reveal < 3) fail('conflict', 'Finish the Case A reveal before starting Case B.');
  s.runs[cs].startedAt = now;
  await store.set(K.sess(s.code), s);
  return s;
}

async function advanceReveal(store, code, hostKey, cs, now) {
  const s = await getSession(store, code); assertHost(s, hostKey);
  if (phaseOf(s, cs, now).name !== 'closed') fail('conflict', 'The reveal opens after the clock runs out.');
  if (s.runs[cs].reveal >= 3) fail('conflict', 'The reveal is already complete.');
  s.runs[cs].reveal += 1;
  await store.set(K.sess(s.code), s);
  return s;
}

async function project(store, code, hostKey, cs, what, now) {
  const s = await getSession(store, code); assertHost(s, hostKey);
  if (phaseOf(s, cs, now).name !== 'closed') fail('conflict', 'Nothing is projected until the clock runs out.');
  const p = s.projected[cs];
  if (what.pair !== undefined) p.pair = what.pair;
  if (what.opposing !== undefined) p.opposing = what.opposing;
  if (what.showHeld !== undefined && !!what.showHeld !== s.showHeld) {
    s.showHeld = !!what.showHeld;
    for (const c of s.cases) s.projected[c] = { pair: null, opposing: null };   // indexes change when the list changes
  }
  await store.set(K.sess(s.code), s);
  return s;
}

// ---------- student writes ----------
function cleanText(v) { return typeof v === 'string' ? v.slice(0, MAX_TEXT) : undefined; }
function cleanFields(cs, f) {
  const out = {};
  if (f.call !== undefined) { if (f.call !== null && !CALLS.includes(f.call)) fail('bad_request', 'Call must be infrastructure or bubble.'); out.call = f.call; }
  if (f.line !== undefined) { if (f.line !== null && !pickerTags(cs).has(f.line)) fail('bad_request', 'Pick a line shown in the pack.'); out.line = f.line; }
  if (f.lineWhy !== undefined) out.lineWhy = cleanText(f.lineWhy) || '';
  if (f.mind !== undefined) out.mind = cleanText(f.mind) || '';
  return out;
}

async function saveIndividual(store, code, pid, cs, fields, now) {
  const s = await getSession(store, code); await participant(store, s, pid);
  if (s.mode !== 'individual') fail('bad_request', 'This is a team session.');
  const ph = phaseOf(s, cs, now).name;
  if (ph !== 'verdict') fail('closed', ph === 'closed' ? 'Time is up. Your call is recorded as it stood.' : 'Calls open when the reading time ends.');
  const cur = (await store.get(K.resp(s.code, cs, pid))) || {};
  const next = { ...cur, ...cleanFields(cs, fields), updatedAt: now };
  await store.set(K.resp(s.code, cs, pid), next);
  return next;
}

async function savePrivate(store, code, pid, cs, call, now) {
  const s = await getSession(store, code); await participant(store, s, pid);
  if (s.mode !== 'team') fail('bad_request', 'This is an individual session.');
  const ph = phaseOf(s, cs, now).name;
  if (ph !== 'private') fail('closed', 'Private calls are taken in the private-call window only.');
  if (!CALLS.includes(call)) fail('bad_request', 'Call must be infrastructure or bubble.');
  const next = { private: call, updatedAt: now };
  await store.set(K.resp(s.code, cs, pid), next);
  return next;
}

async function saveTeamDraft(store, code, pid, cs, fields, now) {
  const s = await getSession(store, code); const p = await participant(store, s, pid);
  if (s.mode !== 'team') fail('bad_request', 'This is an individual session.');
  if (phaseOf(s, cs, now).name !== 'team') fail('closed', 'The team call is open in the team window only.');
  if (await store.get(K.commit(s.code, cs, p.team))) fail('conflict', 'Your team has already committed its call.');
  const cur = (await store.get(K.draft(s.code, cs, p.team))) || {};
  const next = { ...cur, ...cleanFields(cs, fields), updatedAt: now, lastBy: pid };
  await store.set(K.draft(s.code, cs, p.team), next);
  return next;
}

async function commitTeam(store, code, pid, cs, now) {
  const s = await getSession(store, code); const p = await participant(store, s, pid);
  if (s.mode !== 'team') fail('bad_request', 'This is an individual session.');
  if (phaseOf(s, cs, now).name !== 'team') fail('closed', 'The team call is open in the team window only.');
  const d = await store.get(K.draft(s.code, cs, p.team));
  if (!d || !d.call) fail('bad_request', 'Choose the team\'s call before committing.');
  const rec = { call: d.call, line: d.line || null, lineWhy: d.lineWhy || '', mind: d.mind || '', by: pid, at: now };
  const ok = await store.setnx(K.commit(s.code, cs, p.team), rec);
  if (!ok) fail('conflict', 'Your team has already committed its call.');
  return rec;
}

// ---------- evaluation ----------
function evaluate(r) {
  if (!r || !r.call) return { status: 'no_verdict' };
  const blanks = [];
  if (!r.line) blanks.push('line');
  if ((r.lineWhy || '').trim().length < config.minLineReasonChars) blanks.push('reason');
  if ((r.mind || '').trim().length < config.minMindChangerChars) blanks.push('mind');
  return { status: 'recorded', call: r.call, line: r.line || null, lineWhy: r.lineWhy || '', mind: r.mind || '', blanks };
}

async function collect(store, s, cs) {
  const pids = await store.smembers(K.pids(s.code));
  const parts = (await store.mget(pids.map((p) => K.part(s.code, p)))).filter(Boolean);
  const resps = await store.mget(parts.map((p) => K.resp(s.code, cs, p.pid)));
  const out = { parts, resps: Object.fromEntries(parts.map((p, i) => [p.pid, resps[i]])) };
  if (s.mode === 'team') {
    const ts = Array.from({ length: s.teams }, (_, i) => i + 1);
    const commits = await store.mget(ts.map((t) => K.commit(s.code, cs, t)));
    out.commits = Object.fromEntries(ts.map((t, i) => [t, commits[i]]));
  }
  return out;
}

// Anonymous verdict list for the console: individuals, or one per team.
function verdictsOf(s, data) {
  if (s.mode === 'individual') return data.parts.map((p) => evaluate(data.resps[p.pid]));
  return Object.values(data.commits).map((c) => evaluate(c));
}

function guard(s, cs, text) {
  if (s.runs[cs].reveal >= 1) return false;          // company already named
  return findHits(text).length > 0;
}

function matchPairs(items) {
  const byLine = {};
  for (const it of items) (byLine[it.line] ||= { infra: [], bubble: [] })[it.call].push(it);
  const pairs = [];
  for (const [line, g] of Object.entries(byLine)) {
    const n = Math.min(g.infra.length, g.bubble.length);
    for (let i = 0; i < n; i++) pairs.push({ line, infra: g.infra[i], bubble: g.bubble[i] });
  }
  return pairs;
}

function teamMovement(s, data) {
  const res = { moved: 0, held: 0, split: 0, noVerdict: 0 };
  for (let t = 1; t <= s.teams; t++) {
    const c = data.commits[t];
    if (!c) { res.noVerdict++; continue; }
    const members = data.parts.filter((p) => p.team === t);
    const tally = { infra: 0, bubble: 0 };
    for (const m of members) { const r = data.resps[m.pid]; if (r && r.private) tally[r.private]++; }
    if (tally.infra === tally.bubble) res.split++;
    else if ((tally.infra > tally.bubble ? 'infra' : 'bubble') === c.call) res.held++;
    else res.moved++;
  }
  return res;
}

// ---------- completion ----------
// Ready once the last company's outcome has been revealed. Returns the summary
// the platform stores for faculty: calls and reasons, no scores.
async function completionFor(store, code, pid, now) {
  const s = await getSession(store, code); const p = await participant(store, s, pid);
  const last = s.cases[s.cases.length - 1];
  if (phaseOf(s, last, now).name !== 'closed' || s.runs[last].reveal < 3) return null;
  const companies = [];
  for (const cs of s.cases) {
    const rec = s.mode === 'individual' ? await store.get(K.resp(s.code, cs, pid)) : await store.get(K.commit(s.code, cs, p.team));
    const e = evaluate(rec);
    const item = { company: copy.reveal[cs].name, status: e.status };
    if (e.status === 'recorded') Object.assign(item, { call: e.call === 'infra' ? 'infrastructure' : 'bubble', line: e.line ? pickerLabel(cs, e.line) : null, why: e.lineWhy.slice(0, 400), wouldHaveSwitchedIf: e.mind.slice(0, 800), blanks: e.blanks });
    if (s.mode === 'team') { const mine = await store.get(K.resp(s.code, cs, pid)); item.team = p.team; item.privateCall = mine && mine.private ? (mine.private === 'infra' ? 'infrastructure' : 'bubble') : null; }
    companies.push(item);
  }
  return {
    summary: { mode: s.mode, companies },
    metrics: { companies: s.cases.length, verdicts: companies.filter((c) => c.status === 'recorded').length, mode: s.mode },
  };
}

// Report at most once per person per session; a failed report can be retried.
async function markReported(store, code, pid, fn, now) {
  const key = K.report(code, pid);
  const cur = await store.get(key);
  if (cur && cur.reportedAt) return { reported: true, already: true };
  if (cur && cur.lockAt && now - cur.lockAt < 30000) return { reported: false, pending: true };
  const lock = { lockAt: now, id: newId() };
  if (!await store.compareAndSet(key, cur, lock)) return { reported: false, pending: true };
  let r;
  try { r = await fn(); } catch { r = { ok: false }; }
  const saved = await store.compareAndSet(key, lock, r.ok ? { reportedAt: now } : { failedAt: now });
  return { reported: !!r.ok && saved };
}

// ---------- read views ----------
async function studentState(store, code, pid, now) {
  const s = await getSession(store, code); const p = await participant(store, s, pid);
  const cs = activeCase(s);
  const ph = phaseOf(s, cs, now);
  const view = {
    code: s.code, mode: s.mode, cases: s.cases, caseId: cs, team: p.team,
    solo: !!s.solo,
    phase: ph.name, endsAt: ph.endsAt, serverNow: now,
    rules: { minMind: config.minMindChangerChars, minReason: config.minLineReasonChars },
  };
  if (s.solo && ph.name === 'closed') {
    view.soloStage = s.runs[cs].reveal;
    view.nextPart = s.runs[cs].reveal < 3 ? 'Show next part'
      : cs === 'A' && s.cases.includes('B') ? 'Start the next company' : null;
  }
  if (ph.name === 'waiting') return view;
  view.pack = pack(cs);
  const mine = await store.get(K.resp(s.code, cs, pid));
  let cited = null;
  if (s.mode === 'individual') {
    view.mine = mine || {};
    if (ph.name === 'closed') { view.result = evaluate(mine); cited = view.result.line; }
  } else {
    view.mine = mine ? { private: mine.private || null } : {};
    const committed = await store.get(K.commit(s.code, cs, p.team));
    if (ph.name === 'team' || ph.name === 'closed') {
      view.teamDraft = committed ? null : ((await store.get(K.draft(s.code, cs, p.team))) || {});
      view.teamCommitted = committed ? { call: committed.call, line: committed.line, lineWhy: committed.lineWhy, mind: committed.mind } : null;
    }
    if (ph.name === 'closed') { view.result = evaluate(committed); cited = view.result.line; }
  }
  if (ph.name === 'closed') view.reveal = content.buildReveal(cs, s.runs[cs].reveal, cited);
  return view;
}

async function consoleState(store, code, hostKey, now) {
  const s = await getSession(store, code); assertHost(s, hostKey);
  const joinUrl = s.platformAuth ? platformJoinUrl(s) : null;
  const out = { code: s.code, joinUrl, platform: s.platformAuth, mode: s.mode, cases: s.cases, teams: s.teams, clock: s.clock, serverNow: now, activeCase: activeCase(s), showHeld: s.showHeld, byCase: {} };
  for (const cs of s.cases) {
    const ph = phaseOf(s, cs, now);
    const data = await collect(store, s, cs);
    const c = { phase: ph.name, endsAt: ph.endsAt, reveal: s.runs[cs].reveal, joined: data.parts.length, canStart: !s.runs[cs].startedAt && (cs === 'A' || s.runs.A.reveal >= 3) };
    if (s.mode === 'individual') c.submitted = data.parts.filter((p) => data.resps[p.pid] && data.resps[p.pid].call).length;
    else {
      c.privateCalls = data.parts.filter((p) => data.resps[p.pid] && data.resps[p.pid].private).length;
      c.teamsCommitted = Object.values(data.commits).filter(Boolean).length;
    }
    if (ph.name === 'closed') {
      const verdicts = verdictsOf(s, data);
      const rec = verdicts.filter((v) => v.status === 'recorded');
      c.split = { infra: rec.filter((v) => v.call === 'infra').length, bubble: rec.filter((v) => v.call === 'bubble').length, noVerdict: verdicts.length - rec.length };
      const lines = {};
      for (const v of rec) if (v.line) { (lines[v.line] ||= { tag: v.line, label: pickerLabel(cs, v.line), infra: 0, bubble: 0 })[v.call]++; }
      c.linesByCall = Object.values(lines).sort((a, b) => (b.infra + b.bubble) - (a.infra + a.bubble));
      let held = 0;
      const items = rec.map((v, i) => {
        const isHeld = guard(s, cs, `${v.lineWhy} ${v.mind}`);
        if (isHeld) held++;
        return { id: i, call: v.call, line: v.line, lineLabel: v.line ? pickerLabel(cs, v.line) : null, lineWhy: v.lineWhy, mind: v.mind, held: isHeld };
      });
      const visible = items.filter((it) => s.showHeld || !it.held);
      c.heldCount = held;
      c.pairs = matchPairs(visible.filter((it) => it.line));
      const unanimous = rec.length >= 2 && (c.split.infra === 0 || c.split.bubble === 0);
      c.unanimous = unanimous ? (c.split.infra ? 'infra' : 'bubble') : null;
      if (unanimous) {
        c.opposingCandidates = visible.filter((it) => (it.mind || '').trim().length >= config.minMindChangerChars)
          .sort((a, b) => b.mind.length - a.mind.length).slice(0, 8);
        c.minorityCase = copy.notes[cs].beforeReveal.minorityCase[c.unanimous === 'infra' ? 'bubble' : 'infra'];
      }
      if (s.mode === 'team') c.movement = teamMovement(s, data);
      c.projected = s.projected[cs];
    }
    const nb = copy.notes[cs].beforeReveal;
    c.notes = { disagreement: nb.disagreement, turn: nb.turn, naming: nb.naming.map(([term, tag]) => ({ term, line: pickerLabel(cs, tag) })) };
    if (s.runs[cs].reveal >= 1) c.afterNotes = copy.notes[cs].afterReveal;
    c.reveal_preview = s.runs[cs].reveal >= 1 ? content.buildReveal(cs, s.runs[cs].reveal, null) : null;
    out.byCase[cs] = c;
  }
  return out;
}

module.exports = {
  SimError, createSession, createSolo, advanceSolo, getSession, join, checkIdentity, completionFor, markReported, platformJoinUrl, startCase, advanceReveal, project,
  saveIndividual, savePrivate, saveTeamDraft, commitTeam, studentState, consoleState,
  evaluate, matchPairs, phaseOf, activeCase, guard, pack,
};
