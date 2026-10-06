'use strict';
// Session logic over plain objects: seating, phases, deadline, views. No I/O here.
const crypto = require('crypto');
const C = require('../data/config');
const T = require('../engine/table');
const M = require('../engine/model');
const { playForward } = require('../engine/playforward');
const { publicBrief, seatBriefs, staffNotices, walkthrough } = require('../data/content');

const MIN = 60000;
const PHASES = ['lobby', 'briefing', 'openings', 'negotiation', 'closed', 'debrief'];
const TIMED = { briefing: 'briefing', openings: 'openings', negotiation: 'negotiation' };

function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(5), b => A[b % A.length]).join('');
}

function newSession(code, by, now) {
  return { code, createdAt: now, createdBy: by, seed: crypto.randomBytes(8).toString('hex'),
           phase: 'lobby', phaseEndsAt: null, negotiationStartedAt: null, extended: false,
           tableIds: [], reveal: false, walkthroughVersion: 1 };
}

function join(roster, name, launch, now) {
  const pid = launch ? 'platform:' + launch.sub : 'p' + crypto.randomBytes(6).toString('hex');
  if (roster[pid]) return { pid, key: roster[pid].key, roster, rejoined: true };
  const key = crypto.randomBytes(12).toString('base64url');
  const clean = String(name || '').trim().slice(0, 40) || 'Participant';
  return { pid, key, roster: { ...roster, [pid]: { name: clean, key, launch: launch || null, joinedAt: now, table: null, seat: null } } };
}

// Deterministic shuffle so a room can be re-seated identically from the seed.
function shuffle(arr, seed) {
  const a = [...arr]; let h = parseInt(crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8), 16);
  for (let i = a.length - 1; i > 0; i--) { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function seatRoom(sess, roster) {
  if (sess.phase !== 'lobby' || sess.tableIds.length) throw Object.assign(new Error('The room is already seated'), { code: 'REJECTED' });
  const pids = shuffle(Object.keys(roster).sort(), sess.seed);
  const plan = T.planTables(pids.length);
  const next = { ...roster }, tables = {}, ids = [];
  let i = 0;
  plan.forEach((counts, n) => {
    const id = 'T' + (n + 1); ids.push(id);
    tables[id] = { ...T.createTable(id, `${sess.seed}:${id}`), notices: [] };
    for (const seat of T.SEATS) for (let c = 0; c < counts[seat]; c++) {
      const pid = pids[i++];
      next[pid] = { ...next[pid], table: id, seat };
    }
  });
  return { sess: { ...sess, tableIds: ids }, roster: next, tables };
}

function setPhase(sess, to, now) {
  const from = PHASES.indexOf(sess.phase), dest = PHASES.indexOf(to);
  if (dest !== from + 1) throw Object.assign(new Error(`Cannot go from ${sess.phase} to ${to}`), { code: 'REJECTED' });
  if (to === 'briefing' && !sess.tableIds.length) throw Object.assign(new Error('Seat the room first'), { code: 'REJECTED' });
  const next = { ...sess, phase: to, phaseEndsAt: TIMED[to] ? now + C.timing[TIMED[to]] * MIN : null };
  if (to === 'negotiation') next.negotiationStartedAt = now;
  return next;
}

function extend(sess) {
  if (sess.phase !== 'negotiation') throw Object.assign(new Error('Only negotiation can be extended'), { code: 'REJECTED' });
  if (sess.extended) throw Object.assign(new Error('Negotiation has already been extended once'), { code: 'REJECTED' });
  return { ...sess, extended: true, phaseEndsAt: sess.phaseEndsAt + C.timing.extension * MIN };
}

const dueToClose = (sess, now) => sess.phase === 'negotiation' && now >= sess.phaseEndsAt;
const canNegotiate = (sess, now) => sess.phase === 'negotiation' && now < sess.phaseEndsAt;

function addNotice(table, noticeId, now) {
  if (!staffNotices.some(n => n.id === noticeId)) throw Object.assign(new Error('Unknown notice'), { code: 'REJECTED' });
  return { ...table, notices: [...table.notices, { id: noticeId, t: now }] };
}

// A seat's own floor metric for the current sheet. Its own numbers only; no pass or fail.
function myNumbers(seat, dials) {
  const m = M.metrics(dials, 0), pct = x => `${(x * 100).toFixed(1)}%`, mil = x => `$${(x / 1e6).toFixed(1)} million`;
  switch (seat) {
    case 'utility': return [
      { label: 'Build backed by contracted minimum payments', value: pct(m.utilityBacking) },
      { label: 'Cost to shareholders if demand misses', value: mil(m.misses.shareholderCost) }];
    case 'developer': return [
      { label: "Halvorsen's total contingent obligation", value: mil(m.developerObligation) }];
    case 'manufacturers': return [
      { label: 'Industrial rate rise if demand arrives', value: pct(m.arrives.industrialRateRise) },
      { label: 'Industrial rate rise if demand misses', value: pct(m.misses.industrialRateRise) },
      { label: 'Member plants inside the tariff', value: m.captured ? 'Yes' : 'No' }];
    case 'advocate': return [
      { label: "Hammonds' monthly bill rise if demand misses", value: `$${m.misses.householdMonthly.toFixed(2)}` }];
  }
  return [];
}

const sheet = t => ({ dials: t.dials, signatures: t.signatures, locked: t.locked, groups: C.settlementGroups });
// Rooms already running when this version ships retain their original flow.
const walkthroughComplete = (sess, person) => sess.walkthroughVersion !== 1 || (person.walkthroughStep || 0) >= walkthrough.length;

function studentView(sess, roster, pid, table, now) {
  const me = roster[pid];
  const base = { phase: sess.phase, phaseEndsAt: sess.phaseEndsAt, now, name: me.name };
  if (sess.walkthroughVersion === 1 && sess.phase === 'lobby') {
    base.walkthrough = { screens: walkthrough, step: me.walkthroughStep || 0, complete: walkthroughComplete(sess, me) };
  }
  if (!me.seat) return { ...base, seated: false };
  const co = Object.entries(roster).filter(([id, p]) => id !== pid && p.table === me.table && p.seat === me.seat).map(([, p]) => p.name);
  const view = {
    ...base, seated: true, table: me.table, seat: me.seat, coCounsel: co,
    publicBrief, brief: seatBriefs[me.seat],
    dialsInfo: C.dials,
  };
  if (['openings', 'negotiation', 'closed', 'debrief'].includes(sess.phase)) {
    view.sheet = sheet(table);
    view.editable = canNegotiate(sess, now);
    view.log = table.log;
    view.notices = table.notices.map(n => ({ ...staffNotices.find(s => s.id === n.id), t: n.t }));
    view.myNumbers = myNumbers(me.seat, table.dials);
  }
  if (table && table.result) view.outcome = playForward(table.result);
  return view;
}

function tableStatus(sess, table, members, now) {
  const last = table.log.length ? table.log.at(-1).t : (sess.negotiationStartedAt || now);
  return {
    id: table.id || null, members,
    moves: table.log.filter(e => e.action === 'move').length,
    locked: table.locked,
    minutesSinceActivity: Math.floor((now - last) / MIN),
    stalled: sess.phase === 'negotiation' && now - last >= C.timing.staleMinutes * MIN,
    notices: table.notices.length,
    closed: table.phase === 'closed',
  };
}

// The console never carries a brief or a floor, so a laptop left on the projector leaks nothing.
function consoleView(sess, roster, tables, now) {
  const byTable = {};
  for (const p of Object.values(roster)) if (p.table) (byTable[p.table] ||= []).push({ name: p.name, seat: p.seat });
  const out = {
    code: sess.code, phase: sess.phase, phaseEndsAt: sess.phaseEndsAt, now, extended: sess.extended,
    joined: Object.keys(roster).length,
    walkthrough: { finished: Object.values(roster).filter(p => walkthroughComplete(sess, p)).length,
      pending: Object.values(roster).filter(p => !walkthroughComplete(sess, p)).map(p => p.name) },
    unseated: Object.values(roster).filter(p => !p.table).map(p => p.name),
    tables: sess.tableIds.map(id => ({ ...tableStatus(sess, tables[id], byTable[id] || [], now), id })),
    staffNotices: staffNotices.map(({ id, label }) => ({ id, label })),
    reveal: sess.reveal,
    revealContent: sess.reveal ? require('../data/reveal') : null,
  };
  if (['closed', 'debrief'].includes(sess.phase)) {
    out.results = sess.tableIds.map(id => ({ id, ...tables[id].result, playForward: playForward(tables[id].result) }));
  }
  return out;
}

function completionSummary(roster, pid, table) {
  const me = roster[pid];
  if (!table || !table.result) return null;
  return {
    summary: { table: me.table, seat: me.seat, settledGroups: table.result.settled, imposedTerms: table.result.imposed, terms: table.result.terms },
    metrics: { groupsSettled: table.result.settled.length, freezeMonths: table.result.freezeMonths },
  };
}

module.exports = { PHASES, newCode, newSession, join, seatRoom, setPhase, extend, dueToClose, canNegotiate, walkthroughComplete,
                   addNotice, myNumbers, studentView, consoleView, completionSummary };
