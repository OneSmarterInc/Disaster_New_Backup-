'use strict';
// One endpoint, action-dispatched, matching the other team-mode sims.
// Every write is compare-and-set with retry, so four seats on one table never overwrite each other.
const { store, keys } = require('../lib/store');
const { body, faculty, entrant, owns, participant } = require('../lib/guard');
const { announce } = require('../lib/launch');
const R = require('../lib/room');
const T = require('../engine/table');
const { walkthrough } = require('../data/content');

const FACULTY_ACTIONS = new Set(['create', 'seat', 'phase', 'extend', 'notice', 'close', 'reveal', 'console']);
const TABLE_ACTIONS = { move: T.move, sign: T.sign, unsign: T.unsign, unlock: T.unlock };
const clone = v => JSON.parse(JSON.stringify(v));
const busy = () => Object.assign(new Error('busy_retry'), { status: 409 });
const reject = (m, status = 400) => Object.assign(new Error(m), { status });

async function retry(fn) {
  for (let i = 0; i < 6; i++) { const r = await fn(); if (r !== undefined) return r; }
  throw busy();
}

async function loadTables(code, ids) {
  const vals = await store.getMany(ids.map(id => keys.table(code, id)));
  return Object.fromEntries(ids.map((id, i) => [id, vals[i]]));
}

// Lazy deadline: whichever request first arrives after the clock runs out closes every table.
async function settleDeadline(code, now) {
  let sess = await store.get(keys.session(code));
  if (!sess || !R.dueToClose(sess, now)) return sess;
  for (const id of sess.tableIds) {
    await retry(async () => {
      const t = await store.get(keys.table(code, id));
      if (t.phase === 'closed') return true;
      const next = T.closeTable(clone(t), now);
      return (await store.cas(keys.table(code, id), t, next)) ? true : undefined;
    });
  }
  return retry(async () => {
    const s = await store.get(keys.session(code));
    if (s.phase !== 'negotiation') return s;
    const next = { ...s, phase: 'closed', phaseEndsAt: null };
    return (await store.cas(keys.session(code), s, next)) ? next : undefined;
  });
}

async function facultyAction(a, b, who, now) {
  if (a === 'create') {
    for (let i = 0; i < 5; i++) {
      const code = R.newCode(), sess = { ...R.newSession(code, who.name, now), owner: who.owner,
        platformAuth: !!who.launch, courseId: who.launch && who.launch.course || null };
      if (await store.cas(keys.session(code), null, sess)) {
        await store.cas(keys.roster(code), null, {});
        if (sess.courseId) await retry(async () => {
          const previous = await store.get(keys.course(sess.courseId));
          return await store.cas(keys.course(sess.courseId), previous, { code }) ? true : undefined;
        });
        return { code };
      }
    }
    throw busy();
  }
  const code = String(b.code || '').toUpperCase().trim();
  let sess = await store.get(keys.session(code));
  if (!sess) throw reject('no_such_session', 404);
  if (!owns(sess, who)) throw reject('not_session_owner', 403);
  sess = await settleDeadline(code, now);

  if (a === 'seat') {
    return retry(async () => {
      const s = await store.get(keys.session(code)), roster = await store.get(keys.roster(code));
      if (Object.keys(roster).length < 4) throw reject('A table needs at least four students');
      const out = R.seatRoom(s, roster);
      for (const [id, t] of Object.entries(out.tables)) await store.cas(keys.table(code, id), await store.get(keys.table(code, id)), t);
      if (!await store.cas(keys.roster(code), roster, out.roster)) return undefined;
      if (!await store.cas(keys.session(code), s, out.sess)) return undefined;
      return { tables: out.sess.tableIds.length };
    });
  }
  if (a === 'phase' || a === 'extend' || a === 'reveal') {
    return retry(async () => {
      const s = await store.get(keys.session(code));
      let walkthroughOverride;
      if (a === 'phase' && b.to === 'briefing' && s.phase === 'lobby' && s.tableIds.length) {
        const roster = await store.get(keys.roster(code));
        const waiting = Object.entries(roster).filter(([, p]) => p.table && !R.walkthroughComplete(s, p));
        if (waiting.length) {
          if (b.skipWalkthrough !== true) throw reject('walkthrough_incomplete', 409);
          walkthroughOverride = { at: now, by: who.name, participants: waiting.map(([id, p]) => ({ id, name: p.name })) };
        }
      }
      const next = a === 'phase' ? R.setPhase(s, String(b.to), now) : a === 'extend' ? R.extend(s) : { ...s, reveal: Boolean(b.on) };
      if (walkthroughOverride) next.walkthroughOverride = walkthroughOverride;
      return (await store.cas(keys.session(code), s, next)) ? { phase: next.phase, phaseEndsAt: next.phaseEndsAt } : undefined;
    });
  }
  if (a === 'close') {
    // Force the deadline now.
    await retry(async () => {
      const s = await store.get(keys.session(code));
      if (s.phase !== 'negotiation') throw reject('Only negotiation can be closed');
      return (await store.cas(keys.session(code), s, { ...s, phaseEndsAt: now })) ? true : undefined;
    });
    sess = await settleDeadline(code, now);
    return { phase: sess.phase };
  }
  if (a === 'notice') {
    const id = String(b.tableId || '');
    if (!sess.tableIds.includes(id)) throw reject('no_such_table', 404);
    return retry(async () => {
      const t = await store.get(keys.table(code, id));
      return (await store.cas(keys.table(code, id), t, R.addNotice(t, String(b.noticeId), now))) ? { ok: true } : undefined;
    });
  }
  if (a === 'console') {
    const roster = await store.get(keys.roster(code));
    return R.consoleView(sess, roster, await loadTables(code, sess.tableIds), now);
  }
}

async function studentAction(a, req, b, now) {
  const code = String(b.code || '').toUpperCase().trim();
  if (a === 'entry') {
    const who = entrant(req, b);
    if (!who || !who.launch) throw reject('sign_in_required', 401);
    if (!who.launch.course) return { code: null };
    const room = await store.get(keys.course(who.launch.course));
    const sess = room && await store.get(keys.session(room.code));
    return { code: sess && sess.courseId === who.launch.course && ['lobby', 'briefing', 'openings', 'negotiation'].includes(sess.phase) ? sess.code : null };
  }
  if (a === 'join') {
    const who = entrant(req, b);
    if (!who) throw reject('access_code_required', 401);
    const sess = await store.get(keys.session(code));
    if (!sess) throw reject('no_such_session', 404);
    if (sess.platformAuth && (!who.launch || (sess.courseId && who.launch.course !== sess.courseId))) throw reject('wrong_course', 403);
    const name = b.name || (who.launch && who.launch.name);
    return retry(async () => {
      const roster = await store.get(keys.roster(code));
      const existing = who.launch && roster['platform:' + who.launch.sub];
      if (existing) {
        if ((existing.launch.course || null) !== (who.launch.course || null)) throw reject('wrong_course', 403);
        return { participantId: 'platform:' + who.launch.sub, participantKey: existing.key, rejoined: true };
      }
      const current = await store.get(keys.session(code));
      if (current.phase !== 'lobby' || current.tableIds.length) throw reject('seating_closed', 409);
      const j = R.join(roster, name, who.launch, now);
      return (await store.cas(keys.roster(code), roster, j.roster)) ? { participantId: j.pid, participantKey: j.key } : undefined;
    });
  }
  const pid = String(b.participantId || '');
  let sess = await store.get(keys.session(code));
  if (!sess) throw reject('no_such_session', 404);
  const roster = await store.get(keys.roster(code));
  const me = roster[pid];
  if (!participant(req, b, sess, me)) throw reject('not_joined', 403);
  sess = await settleDeadline(code, now);

  if (a === 'view') {
    const table = me.table ? await store.get(keys.table(code, me.table)) : null;
    return R.studentView(sess, roster, pid, table, now);
  }
  if (a === 'walkthrough') {
    if (sess.phase !== 'lobby' || sess.walkthroughVersion !== 1) throw reject('walkthrough_closed', 409);
    return retry(async () => {
      const current = await store.get(keys.roster(code)), person = current[pid], step = Number(b.step);
      const previous = person.walkthroughStep || 0;
      if (!Number.isInteger(step) || step < 1 || step > walkthrough.length || step > previous + 1) throw reject('invalid_walkthrough_step');
      const next = { ...current, [pid]: { ...person, walkthroughStep: Math.max(previous, step) } };
      if (!await store.cas(keys.roster(code), current, next)) return undefined;
      const table = person.table ? await store.get(keys.table(code, person.table)) : null;
      return R.studentView(sess, next, pid, table, now);
    });
  }
  const op = TABLE_ACTIONS[a];
  if (!op) throw reject('unknown_action');
  if (!R.canNegotiate(sess, now)) throw reject('not_negotiating', 409);
  if (!me.table) throw reject('not_seated', 409);
  return retry(async () => {
    const t = await store.get(keys.table(code, me.table));
    const next = clone(t);
    if (a === 'move') op(next, me.seat, String(b.dial), Number(b.value), now);
    else if (a === 'unlock') op(next, me.seat, String(b.group), now);
    else op(next, me.seat, String(b.dial), now);
    return (await store.cas(keys.table(code, me.table), t, next)) ? R.studentView(sess, roster, pid, next, now) : undefined;
  });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!store.configured()) return res.status(503).json({ error: 'no_store' });
  const b = body(req), a = String(b.action || ''), now = Date.now();
  await announce();
  try {
    if (FACULTY_ACTIONS.has(a)) {
      const who = faculty(req, b);
      if (!who) return res.status(401).json({ error: 'faculty_only' });
      return res.status(200).json(await facultyAction(a, b, who, now));
    }
    return res.status(200).json(await studentAction(a, req, b, now));
  } catch (e) {
    if (e.code === 'REJECTED') return res.status(400).json({ error: e.message });
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('session failed', e);
    return res.status(503).json({ error: 'session_unavailable' });
  }
};
module.exports.settleDeadline = settleDeadline;
