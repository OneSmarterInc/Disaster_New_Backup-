// RapidSim 09 room logic. Pure functions over a session, its participants and a
// timestamp, so every rule can be tested without Redis or a real clock.
//
// A "unit" is whoever decides: one student in individual mode, one team in team
// mode. A team's statements and allocation live on a record keyed by its group id
// (kind: 'team') in the same participant hash, so first press wins by
// compare-and-set and no member can overwrite another.
const C = require('../config/content.js');
const E = require('./engine.js');

const MODES = ['individual', 'team'];
const CONTROLS = ['pause', 'resume', 'advance', 'close_allocation', 'release', 'close'];

function elapsedSeconds(sess, now) {
  if (!sess || !sess.startedAt) return 0;
  const pausedMs = (sess.pausedTotalMs || 0) + (sess.paused && sess.pausedAt ? now - sess.pausedAt : 0);
  return Math.max(0, (now - sess.startedAt - pausedMs) / 1000 + (sess.skipSeconds || 0));
}

function clock(sess, now) {
  if (!sess || sess.state === 'lobby') return { phase: 'lobby', remaining: 0, stage: 0, paused: false };
  const p = E.phaseAt(elapsedSeconds(sess, now), !!sess.allocationClosed, sess.released || 0);
  const out = { ...p, remaining: Math.ceil(p.remaining), stage: p.stage || 0, paused: !!sess.paused };
  if (sess.state === 'closed') return { ...out, phase: 'closed', remaining: 0 };
  return out;
}

const people = (participants) => Object.values(participants || {}).filter(p => p && p.kind !== 'team');
const teamMembers = (sess, groupId) => (sess.teams && sess.teams[groupId]) || [];

function unitIdFor(sess, participant) {
  return sess.mode === 'team' ? participant.groupId || null : participant.id;
}
function unitRecord(sess, participants, participant) {
  if (sess.mode !== 'team') return participant;
  return participant.groupId ? participants[participant.groupId] || null : null;
}
function isMember(sess, participant) {
  return sess.mode !== 'team' || (!!participant.groupId && teamMembers(sess, participant.groupId).includes(participant.id));
}

function units(sess, participants) {
  if (sess.mode === 'team') {
    return Object.keys(sess.teams || {}).sort().map(g => {
      const rec = participants[g] || {};
      const first = participants[teamMembers(sess, g)[0]] || {};
      return { id: g, label: first.teamLabel || g.replace(/^team:/, ''), statements: rec.statements || null, allocation: rec.allocation || null };
    });
  }
  return people(participants).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))
    .map((p, i) => ({ id: p.id, label: `Student ${i + 1}`, statements: p.statements || null, allocation: p.allocation || null }));
}

function stageFor(year, allocation) {
  const s = C.REVEAL.stages.find(x => x.year === year);
  const fund = allocation ? E.fundAt(allocation, year) : null;
  return {
    year, heading: s.heading, direction: s.direction, destination: s.destination,
    companies: E.KEYS.map(k => ({
      key: k, descriptor: E.COMPANY[k].descriptor, event: s.companies[k],
      placed: allocation ? E.money(allocation[k]) : null,
      value: fund ? E.display(fund.parts[k]) : null,
      held: !!(allocation && allocation[k] > 0)
    })),
    cash: allocation && allocation.cash > 0 ? E.money(allocation.cash) : null,
    fund: fund ? E.display(fund.total) : null
  };
}

// Everything one student may see. Unreleased history never leaves the server.
function studentView(sess, participants, pid, now) {
  const me = participants[pid];
  const clk = clock(sess, now);
  const rec = unitRecord(sess, participants, me) || {};
  const member = isMember(sess, me);
  const open = !clk.paused && sess.state === 'running';
  const statements = rec.statements || null;
  const allocation = rec.allocation || null;
  const released = sess.released || 0;
  const view = {
    clock: clk,
    mode: sess.mode,
    solo: !!sess.solo,
    team: sess.mode === 'team' ? { label: me.teamLabel || '', size: teamMembers(sess, me.groupId).length } : null,
    statements,
    statementsBy: sess.mode === 'team' && rec.statementsBy ? rec.statementsBy : null,
    allocation,
    canWriteStatements: open && member && clk.phase === 'wall' && !statements,
    canAllocate: open && member && clk.phase === 'allocate' && !allocation,
    cashAllowed: E.cashAllowed(statements),
    stages: C.REVEAL.stages.slice(0, released).map(s => stageFor(s.year, allocation)),
    names: released >= C.REVEAL.stages.length ? { heading: C.REVEAL.namesHeading, list: E.KEYS.map(k => ({ key: k, descriptor: E.COMPANY[k].descriptor, name: C.REVEAL.names[k] })) } : null,
    closing: released >= C.REVEAL.stages.length ? C.REVEAL.closing : null,
    canAdvance: false
  };
  if (sess.solo && open) {
    view.canAdvance = clk.phase === 'briefing' || (clk.phase === 'wall' && !!statements) ||
      (['held', 'reveal'].includes(clk.phase) && released < C.REVEAL.stages.length);
  }
  return view;
}

function projectorView(sess, participants, now) {
  const clk = clock(sess, now);
  const all = people(participants);
  const list = units(sess, participants);
  const released = sess.released || 0;
  const afterAllocation = ['held', 'reveal'].includes(clk.phase) ||
    (clk.phase === 'closed' && (!!sess.allocationClosed || released > 0 || elapsedSeconds(sess, sess.closedAt || now) >= E.ALLOCATION_CLOSES));
  const view = {
    clock: clk,
    mode: sess.mode,
    joined: all.length,
    teams: sess.mode === 'team' ? Object.keys(sess.teams || {}).length : null,
    units: list.length,
    statementsIn: list.filter(u => u.statements).length,
    allocationsIn: list.filter(u => u.allocation).length,
    released,
    stagesTotal: C.REVEAL.stages.length,
    nextYear: released < C.REVEAL.stages.length ? C.REVEAL.stages[released].year : null,
    room: null,
    debrief: {
      facilitatorNote: C.DEBRIEF.facilitatorNote,
      disagreement: C.DEBRIEF.disagreement,
      naming: C.DEBRIEF.naming,
      turn: C.DEBRIEF.turn,
      cashPrompt: C.DEBRIEF.cashPrompt,
      teamPrompt: sess.mode === 'team' ? C.DEBRIEF.teamPrompt : null,
      sawItComing: released >= 1 ? C.DEBRIEF.sawItComing : null,
      epilogue: released >= C.REVEAL.stages.length ? C.DEBRIEF.epilogue : null
    }
  };
  // Nothing about positions reaches the wall until allocation has closed.
  if (afterAllocation) {
    const agg = E.aggregate(list, released);
    view.room = {
      ...agg,
      totals: Object.fromEntries(E.BUCKETS.map(k => [k, agg.totals[k]])),
      labels: { ...Object.fromEntries(E.KEYS.map(k => [k, E.COMPANY[k].descriptor])), cash: C.FUND.cashLabel },
      pickLabels: Object.fromEntries(C.WALL.destination.options.map(o => [o.key, o.text])),
      statements: list.filter(u => u.statements).map(u => ({
        id: u.id, label: u.label, direction: u.statements.direction, pick: u.statements.pick, reason: u.statements.reason,
        allocation: u.allocation ? Object.fromEntries(E.BUCKETS.map(k => [k, u.allocation[k]])) : null
      })),
      flagText: C.FLAGS.contradictionText,
      pairHeading: C.FLAGS.pairHeading,
      names: released >= C.REVEAL.stages.length ? C.REVEAL.names : null
    };
  }
  return view;
}

function writable(sess, clk, participant, phase) {
  if (sess.state !== 'running') return { error: 'session_not_running', status: 409 };
  if (sess.paused) return { error: 'session_paused', status: 409 };
  if (clk.phase !== phase) return { error: phase === 'wall' ? 'statements_closed' : 'allocation_closed', status: 409 };
  if (!isMember(sess, participant)) return { error: 'team_not_assigned', status: 409 };
  return null;
}

// Returns { id, prev, next } for the record to compare-and-set, or { error }.
function applyStatements(sess, participants, participant, input, now) {
  const clk = clock(sess, now);
  const bad = writable(sess, clk, participant, 'wall'); if (bad) return bad;
  const rec = unitRecord(sess, participants, participant);
  if (rec && rec.statements) return { error: 'statements_locked', status: 409 };
  const v = E.validateStatements(input);
  if (v.error) return { error: v.error, status: 400 };
  const id = unitIdFor(sess, participant);
  const base = rec || { id, kind: 'team' };
  const next = { ...base, statements: v.value, statementsAt: now };
  if (sess.mode === 'team') next.statementsBy = participant.name || '';
  return { id, prev: rec || undefined, next };
}

function applyAllocation(sess, participants, participant, input, now) {
  const clk = clock(sess, now);
  const bad = writable(sess, clk, participant, 'allocate'); if (bad) return bad;
  const rec = unitRecord(sess, participants, participant);
  if (rec && rec.allocation) return { error: 'allocation_locked', status: 409 };
  const v = E.validateAllocation(input, rec && rec.statements);
  if (v.error) return { error: v.error, status: 400, left: v.left };
  const id = unitIdFor(sess, participant);
  const base = rec || { id, kind: 'team' };
  const next = { ...base, allocation: v.value, allocationAt: now };
  if (sess.mode === 'team') next.allocationBy = participant.name || '';
  return { id, prev: rec || undefined, next };
}

function allCommitted(sess, participants) {
  const list = units(sess, participants);
  return list.length > 0 && list.every(u => u.allocation);
}

// Instructor controls (and the solo player's "advance"). Returns { next } or { error }.
function applyControl(sess, set, now, participants, force = false) {
  if (!CONTROLS.includes(set)) return { error: 'invalid_control', status: 400 };
  const clk = clock(sess, now);
  const next = { ...sess };
  if (set === 'close') {
    if (sess.state === 'closed') return { error: 'already_closed', status: 409 };
    next.state = 'closed'; next.paused = false; next.closedAt = now;
    if (['held', 'reveal'].includes(clk.phase) || sess.allocationClosed) next.released = C.REVEAL.stages.length;
    return { next };
  }
  if (sess.state !== 'running') return { error: 'session_not_running', status: 409 };
  if (set === 'pause') {
    if (sess.paused) return { error: 'cannot_pause', status: 409 };
    next.paused = true; next.pausedAt = now; return { next };
  }
  if (set === 'resume') {
    if (!sess.paused) return { error: 'not_paused', status: 409 };
    next.paused = false; next.pausedTotalMs = (sess.pausedTotalMs || 0) + (now - (sess.pausedAt || now)); next.pausedAt = null;
    return { next };
  }
  if (sess.paused) return { error: 'session_paused', status: 409 };
  if (set === 'advance') {
    // Skip the rest of the briefing or the statement window. Never skips allocation.
    if (!['briefing', 'wall'].includes(clk.phase)) return { error: 'cannot_advance', status: 409 };
    next.skipSeconds = (sess.skipSeconds || 0) + clk.remaining + 0.001;
    return { next };
  }
  if (set === 'close_allocation') {
    if (clk.phase !== 'allocate') return { error: 'allocation_not_open', status: 409 };
    if (!force && !allCommitted(sess, participants)) return { error: 'allocations_outstanding', status: 409 };
    next.allocationClosed = true; next.allocationClosedAt = now; return { next };
  }
  // release
  if (!['held', 'reveal'].includes(clk.phase)) return { error: 'allocation_still_open', status: 409 };
  if ((sess.released || 0) >= C.REVEAL.stages.length) return { error: 'history_complete', status: 409 };
  next.released = (sess.released || 0) + 1;
  next.releasedAt = [...(sess.releasedAt || []), now];
  return { next };
}

// Freeze team membership at start so a submission can never move between teams.
function freezeTeams(participants) {
  const teams = {};
  for (const p of people(participants)) if (p.groupId) (teams[p.groupId] ||= []).push(p.id);
  for (const k of Object.keys(teams)) teams[k].sort();
  return teams;
}

// Completion report: no score. Sent once every stage is out.
function completionSummary(sess, participants, pid, now) {
  const v = studentView(sess, participants, pid, now);
  if (v.stages.length < C.REVEAL.stages.length) return null;
  const last = v.stages[v.stages.length - 1];
  return {
    summary: v.allocation ? `Fund worth ${last.fund} by ${last.year}` : 'Fund left unplaced',
    metrics: {
      mode: sess.mode,
      destination: v.statements ? v.statements.pick : null,
      allocation: v.allocation,
      fund: Object.fromEntries(v.stages.map(s => [s.year, s.fund]))
    }
  };
}

module.exports = {
  MODES, CONTROLS,
  elapsedSeconds, clock, units, unitRecord, isMember, freezeTeams, allCommitted,
  studentView, projectorView, applyStatements, applyAllocation, applyControl, completionSummary
};
