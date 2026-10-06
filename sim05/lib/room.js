// RapidSim 05 room logic. Pure functions over a session, its participants and a
// timestamp, so every rule can be tested without Redis or a real clock.
//
// Nothing is written when a round closes. A vote missing at close is read as a
// timeout, and a timeout ships, so the record never needs a sweeper.
const C = require('../config/content.js');
const E = require('./engine.js');

const INTENSITIES = ['standard', 'lighter'];
const MODES = ['individual', 'team'];

function elapsedSeconds(sess, now) {
  if (!sess || !sess.startedAt) return 0;
  const pausedMs = (sess.pausedTotalMs || 0) + (sess.paused && sess.pausedAt ? now - sess.pausedAt : 0);
  return Math.max(0, (now - sess.startedAt - pausedMs + (sess.skipMs || 0)) / 1000);
}

function clock(sess, now) {
  if (!sess || sess.state === 'lobby') return { phase: 'lobby', round: 0, remaining: 0, closedRounds: 0, openedRounds: 0 };
  if (sess.state === 'closed') return { phase: 'closed', round: 0, remaining: 0, closedRounds: 5, openedRounds: 5 };
  const p = E.phaseAt(elapsedSeconds(sess, now));
  let closedRounds = 0, openedRounds = 0;
  if (p.phase === 'decide') { closedRounds = p.round - 1; openedRounds = p.round; }
  else if (p.phase === 'reveal') { closedRounds = p.round; openedRounds = p.round; }
  else if (p.phase === 'ending' || p.phase === 'closed') { closedRounds = 5; openedRounds = 5; }
  return { ...p, remaining: Math.ceil(p.remaining), closedRounds, openedRounds, paused: !!sess.paused };
}

// A participant who joined after round 1 closed still plays, but their missed
// rounds are timeouts they never saw, so they stay out of the room's totals.
function isLate(sess, participant) {
  return Number(participant.lateFrom || 0) >= 1;
}

// Only people who actually opened the session count. Course students imported
// ahead of time have no joinedAt until they arrive.
function joined(participants) {
  return Object.values(participants || {}).filter(p => p && p.joinedAt);
}

// Everyone whose decision the room is waiting for in the open round.
function deciders(sess, participants) {
  if (sess.mode === 'team') {
    const ids = new Set(Object.values(sess.teams || {}).flat());
    return joined(participants).filter(p => ids.has(p.id));
  }
  return joined(participants);
}

// True when every decider has voted in the open round, so it can close early.
function allDecided(sess, participants, now) {
  const clk = clock(sess, now);
  if (clk.phase !== 'decide' || sess.paused) return false;
  const who = deciders(sess, participants);
  return who.length > 0 && who.every(p => (p.votes || {})[clk.round]);
}

// Move the shared clock to the end of the current segment.
function skipSegment(sess, now) {
  const clk = clock(sess, now);
  if (sess.state !== 'running' || sess.paused) return { error: 'cannot_skip', status: 409 };
  if (!['briefing', 'decide', 'reveal'].includes(clk.phase)) return { error: 'cannot_skip', status: 409 };
  return { next: { ...sess, skipMs: (sess.skipMs || 0) + clk.remaining * 1000 }, from: { phase: clk.phase, round: clk.round } };
}

function ownVotes(participant, closedRounds) {
  const v = participant.votes || {};
  return C.ROUNDS.map((r, i) => (i < closedRounds ? E.normalise(v[r.n]) : v[r.n] || undefined));
}

function teamMembers(sess, groupId) {
  return (sess.teams && sess.teams[groupId]) || [];
}

function teamDecisions(sess, participants, groupId, closedRounds) {
  const members = teamMembers(sess, groupId);
  return C.ROUNDS.map((r, i) => {
    if (i >= closedRounds) return { decision: undefined, split: false };
    const votes = {};
    for (const id of members) if (participants[id]?.votes?.[r.n]) votes[id] = participants[id].votes[r.n];
    return E.teamDecision(members, votes);
  });
}

function teamLabel(sess, participants, groupId) {
  if (!groupId) return '';
  if (sess.teamLabels && sess.teamLabels[groupId]) return sess.teamLabels[groupId];
  const any = Object.values(participants || {}).find(p => p && p.groupId === groupId && p.teamLabel);
  return any ? any.teamLabel : groupId.replace(/^team:/, '');
}

function teamGroups(sess, participants) {
  if (sess.teams && sess.state !== 'lobby') return Object.keys(sess.teams);
  return [...new Set(Object.values(participants || {}).filter(p => p && p.groupId && p.groupId.startsWith('team:')).map(p => p.groupId))];
}

function appFor(r) {
  return r.app ? { ...r.app } : null;
}

// Everything one student may see. Future rounds never leave the server.
function studentView(sess, participants, pid, now) {
  const me = participants[pid];
  const clk = clock(sess, now);
  const intensity = sess.intensity || 'standard';
  const inTeam = sess.mode === 'team';
  const mine = ownVotes(me, clk.closedRounds);
  let decisions;
  if (inTeam) decisions = teamDecisions(sess, participants, me.groupId, clk.closedRounds).map(t => t.decision);
  else decisions = mine.map((d, i) => (i < clk.closedRounds ? d : undefined));

  const rounds = [];
  for (let n = 1; n <= clk.openedRounds; n++) {
    const r = C.ROUNDS[n - 1];
    const entry = {
      n, title: r.title, request: r.request, reason: r.reason, adds: r.adds, app: appFor(r),
      myVote: (me.votes || {})[n] || null
    };
    if (n <= clk.closedRounds) {
      entry.result = E.roundResult(decisions, n, intensity);
      if (inTeam) entry.myVote = mine[n - 1];
    }
    rounds.push(entry);
  }

  const onTeam = !inTeam || (!!me.groupId && teamMembers(sess, me.groupId).includes(pid));
  const view = {
    clock: clk,
    mode: sess.mode,
    solo: !!sess.solo,
    ready: !!me.ready,
    late: sess.state === 'running' && clk.phase !== 'briefing' && !me.ready,
    team: inTeam ? { label: teamLabel(sess, participants, me.groupId), assigned: !!me.groupId, canRename: sess.state === 'lobby' && !!me.groupId, size: teamMembers(sess, me.groupId).length } : null,
    rounds,
    canVote: clk.phase === 'decide' && !clk.paused && !(me.votes || {})[clk.round] && onTeam,
    canSkip: !!sess.solo && !clk.paused && (clk.phase === 'briefing' || clk.phase === 'reveal' || (clk.phase === 'decide' && !!(me.votes || {})[clk.round])),
    ending: null
  };
  if (clk.closedRounds === 5 && (clk.phase === 'ending' || clk.phase === 'closed')) {
    const e = E.ending(decisions, intensity);
    const counts = { approve: 0, decline: 0, timeout: 0 };
    e.decisions.forEach(d => { counts[d.decision]++; });
    view.ending = {
      decisions: e.decisions.map((d, i) => ({ ...d, myVote: inTeam ? mine[i] : undefined, app: appFor(C.ROUNDS[i]) })),
      counts,
      knows: e.knows,
      missing: e.missing
    };
  }
  return view;
}

// The projector sees totals only. During a decision window it shows how many
// have decided, never which way: a live split on the wall invites herding.
function projectorView(sess, participants, now) {
  const clk = clock(sess, now);
  const intensity = sess.intensity || 'standard';
  const present = joined(participants);
  let runs = [];
  if (sess.mode === 'team') {
    for (const groupId of Object.keys(sess.teams || {})) {
      const t = teamDecisions(sess, participants, groupId, clk.closedRounds);
      runs.push({ decisions: t.map(x => x.decision), splits: t.map(x => x.split) });
    }
  } else {
    const counted = present.filter(p => !isLate(sess, p));
    runs = counted.map(p => ({ decisions: ownVotes(p, clk.closedRounds).map((d, i) => (i < clk.closedRounds ? d : undefined)) }));
  }
  const who = deciders(sess, participants);
  const agg = E.aggregate(runs, intensity, { mode: sess.mode });
  const live = clk.phase === 'decide'
    ? { round: clk.round, decided: who.filter(p => (p.votes || {})[clk.round]).length, of: who.length }
    : null;
  return {
    clock: clk,
    mode: sess.mode,
    intensity,
    joined: present.length,
    ready: present.filter(p => p.ready).length,
    late: sess.mode === 'individual' ? present.filter(p => isLate(sess, p)).length : 0,
    teams: sess.mode === 'team' ? Object.keys(sess.teams || {}).length : null,
    live,
    rounds: agg.rounds.slice(0, clk.closedRounds),
    endings: clk.closedRounds === 5 ? agg.groups : null,
    headline: clk.closedRounds === 5 ? agg.headline : null,
    disagreement: clk.closedRounds === 5 ? agg.disagreement : null,
    progress: progress(sess, participants, now),
    debrief: {
      naming: C.DEBRIEF.naming,
      turn: C.DEBRIEF.turn,
      teamPrompt: sess.mode === 'team' ? C.DEBRIEF.teamPrompt : null
    }
  };
}

// Instructor-only. Who is here, who has finished the walkthrough, who has decided
// in the open round. Never which way anyone voted. Team tallies appear only for
// closed rounds and carry counts, never names.
function progress(sess, participants, now) {
  const clk = clock(sess, now);
  const open = clk.phase === 'decide' ? clk.round : 0;
  const person = p => ({ name: p.name, joined: !!p.joinedAt, ready: !!p.ready, decided: open ? !!(p.votes || {})[open] : null });
  if (sess.mode !== 'team') {
    return { students: Object.values(participants || {}).filter(p => p && p.joinedAt).map(p => ({ ...person(p), late: isLate(sess, p) })).sort((a, b) => a.name.localeCompare(b.name)) };
  }
  const teams = teamGroups(sess, participants).map(gid => {
    const ids = sess.teams && sess.state !== 'lobby' ? sess.teams[gid] : Object.values(participants).filter(p => p && p.groupId === gid).map(p => p.id);
    const t = teamDecisions(sess, participants, gid, clk.closedRounds);
    return {
      groupId: gid,
      label: teamLabel(sess, participants, gid),
      members: ids.map(id => participants[id]).filter(Boolean).map(person).sort((a, b) => a.name.localeCompare(b.name)),
      tallies: t.slice(0, clk.closedRounds).map((x, i) => ({ round: i + 1, approve: x.approve, decline: x.decline, missing: x.missing, decision: x.decision }))
    };
  }).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  return { teams };
}

// Read-only: exactly what one team sees, minus every member's own vote.
function teamView(sess, participants, groupId, now) {
  const ids = teamMembers(sess, groupId).length ? teamMembers(sess, groupId) : Object.values(participants).filter(p => p && p.groupId === groupId).map(p => p.id);
  if (!ids.length || !participants[ids[0]]) return null;
  const v = studentView(sess, participants, ids[0], now);
  v.rounds.forEach(r => { delete r.myVote; });
  if (v.ending) v.ending.decisions.forEach(d => { delete d.myVote; });
  v.canVote = false; v.canSkip = false;
  return { ...v, team: { ...v.team, label: teamLabel(sess, participants, groupId) } };
}

// The round in front of students right now, for the instructor's preview.
function preview(sess, now) {
  const clk = clock(sess, now);
  if (!clk.openedRounds) return { clock: clk, round: null };
  const r = C.ROUNDS[(clk.round || clk.openedRounds) - 1];
  return { clock: clk, round: { n: r.n, title: r.title, request: r.request, reason: r.reason, adds: r.adds, app: appFor(r) } };
}

// Validate and apply one vote. Returns { next } or { error }.
function applyVote(sess, participant, round, decision, now) {
  const clk = clock(sess, now);
  if (sess.state !== 'running') return { error: 'session_not_running', status: 409 };
  if (sess.paused) return { error: 'session_paused', status: 409 };
  if (clk.phase !== 'decide') return { error: 'no_round_open', status: 409 };
  if (Number(round) !== clk.round) return { error: 'round_closed', status: 409 };
  if (!['approve', 'decline'].includes(decision)) return { error: 'invalid_decision', status: 400 };
  if (sess.mode === 'team' && !teamMembers(sess, participant.groupId).includes(participant.id)) {
    return { error: 'team_not_assigned', status: 409 };
  }
  if ((participant.votes || {})[clk.round]) return { error: 'already_decided', status: 409 };
  return { next: { ...participant, votes: { ...(participant.votes || {}), [clk.round]: decision } } };
}

// Freeze team membership at start so a vote can never move between teams.
function freezeTeams(participants) {
  const teams = {};
  for (const p of joined(participants)) {
    if (p.groupId) (teams[p.groupId] ||= []).push(p.id);
  }
  for (const k of Object.keys(teams)) teams[k].sort();
  return teams;
}

function applyControl(sess, set, now) {
  const next = { ...sess };
  if (set === 'pause') {
    if (sess.state !== 'running' || sess.paused) return { error: 'cannot_pause', status: 409 };
    next.paused = true; next.pausedAt = now;
  } else if (set === 'resume') {
    if (!sess.paused) return { error: 'not_paused', status: 409 };
    next.paused = false;
    next.pausedTotalMs = (sess.pausedTotalMs || 0) + (now - (sess.pausedAt || now));
    next.pausedAt = null;
  } else if (set === 'close') {
    next.state = 'closed'; next.paused = false; next.closedAt = now;
  } else {
    return { error: 'invalid_control', status: 400 };
  }
  return { next };
}

// Ending summary for the platform completion report: no score, no verdict.
function completionSummary(sess, participants, pid, now) {
  const v = studentView(sess, participants, pid, now);
  if (!v.ending) return null;
  return {
    summary: `${v.ending.decisions.filter(d => d.decision === 'decline').length} of 5 declined`,
    metrics: {
      mode: sess.mode,
      intensity: sess.intensity || 'standard',
      decisions: v.ending.decisions.map(d => d.decision),
      endingGroup: E.endingGroup(v.ending.knows)
    }
  };
}

module.exports = {
  INTENSITIES, MODES,
  elapsedSeconds, clock, isLate, joined, teamLabel, teamGroups, progress, teamView, preview, deciders, allDecided, skipSegment, ownVotes, teamDecisions, freezeTeams,
  studentView, projectorView, applyVote, applyControl, completionSummary
};
