// RapidSim 08 room logic. Pure functions over a session, its participants, its
// question runs and a timestamp, so every rule can be tested without Redis.
//
// Nothing is written when a phase closes. The vendor and plan are computed from
// the votes on record whenever they are read, so the record never needs a sweeper.
const C = require('../config/content.js');
const E = require('./engine.js');

const MODES = ['individual', 'team'];

function elapsedSeconds(sess, now) {
  if (!sess || !sess.startedAt) return 0;
  const at = sess.state === 'closed' && sess.closedAt ? Math.min(now, sess.closedAt) : now;
  const pausedMs = (sess.pausedTotalMs || 0) + (sess.paused && sess.pausedAt ? at - sess.pausedAt : 0);
  return Math.max(0, (at - sess.startedAt - pausedMs) / 1000);
}

function clock(sess, now) {
  if (!sess || sess.state === 'lobby' || !sess.startedAt) return { phase: 'lobby', remaining: 0, paused: false, closed: false };
  const p = E.phaseAt(elapsedSeconds(sess, now));
  return { ...p, remaining: Math.ceil(p.remaining), paused: !!sess.paused, closed: sess.state === 'closed' };
}

// Individual students who join after questions open still play, but stay out
// of the room's comparisons. Teams are frozen at start, so nobody is late.
function isLate(sess, p) {
  if (sess.mode !== 'individual' || !sess.startedAt || !p.joinedAt) return false;
  return p.joinedAt >= sess.startedAt + E.phaseStart('questions') * 1000 + (sess.pausedTotalMs || 0);
}

const members = (sess, groupId) => sess.mode === 'team' ? ((sess.teams || {})[groupId] || []) : [String(groupId || '').replace(/^individual:/, '')];
const isMember = (sess, p) => !!p && !!p.groupId && members(sess, p.groupId).includes(p.id);
const askedIds = run => ((run && run.questions) || []).map(q => q.id);

// The committed facts of one run as they stand at `phase`.
function runFacts(sess, participants, runs, groupId, phase) {
  const ids = members(sess, groupId);
  const run = runs[groupId] || { questions: [] };
  const facts = { groupId, questionIds: askedIds(run), questions: run.questions || [] };
  if (E.reached(phase, 'plan')) {
    Object.assign(facts, E.decideVendor(ids.map(id => participants[id]?.vendorVote).filter(Boolean)));
  }
  if (E.reached(phase, 'report')) {
    facts.plan = E.decidePlan(ids.map(id => participants[id]?.planVote).filter(Boolean)).plan;
    facts.report = E.report(facts);
  }
  return facts;
}

const vendorPublic = v => ({ key: v.key, name: v.name, rep: v.rep, pitch: v.pitch, implementation: v.implementation, fee: v.fee, monthly: v.monthly, threeYear: v.threeYear });
const vendorName = k => (C.VENDORS.find(v => v.key === k) || {}).name || '';

// Everything one student may see. Answers leave the server only once spent;
// plans only once the vendor is locked; the report only when the clock reaches it.
function studentView(sess, participants, runs, pid, now) {
  const me = participants[pid];
  const clk = clock(sess, now);
  const team = sess.mode === 'team';
  const member = isMember(sess, me);
  const view = {
    clock: clk, mode: sess.mode,
    team: team ? { label: me.teamLabel || '', size: members(sess, me.groupId).length, assigned: member } : null,
    budget: C.QUESTION_BUDGET
  };
  if (clk.phase === 'lobby') return view;
  const phase = clk.phase;
  view.vendors = C.VENDORS.map(vendorPublic);
  if (E.reached(phase, 'demos')) view.demos = C.VENDORS.map(v => ({ vendor: v.key, text: v.demo }));
  if (!member) return view;

  const f = runFacts(sess, participants, runs, me.groupId, phase);
  const byName = id => (team ? (participants[id]?.name || '') : '');
  if (E.reached(phase, 'questions')) {
    const spent = new Set(f.questionIds);
    view.menu = C.QUESTIONS.map(q => ({ id: q.id, text: q.text, asked: spent.has(q.id) }));
    view.asked = E.answers(f.questionIds).map((a, i) => ({ ...a, by: byName(f.questions[i].by) }));
    view.left = Math.max(0, C.QUESTION_BUDGET - f.questionIds.length);
    view.canAsk = phase === 'questions' && !clk.paused && !clk.closed && view.left > 0;
  }
  if (E.reached(phase, 'commit')) {
    view.myVendorVote = me.vendorVote || null;
    view.canVoteVendor = phase === 'commit' && !clk.paused && !clk.closed && !me.vendorVote;
  }
  if (E.reached(phase, 'plan')) {
    view.vendor = { key: f.vendor, name: vendorName(f.vendor), boardChose: f.boardChose };
    view.plans = C.PLANS.map(p => ({ key: p.key, text: p.text }));
    view.myPlanVote = me.planVote || null;
    view.canVotePlan = phase === 'plan' && !clk.paused && !clk.closed && !me.planVote;
  }
  if (phase === 'report') {
    const plan = C.PLANS.find(p => p.key === f.plan);
    view.report = { vendor: vendorName(f.vendor), text: f.report.text, plan: plan ? plan.text : null };
  }
  return view;
}

function roomRuns(sess, participants) {
  const all = Object.values(participants || {}).filter(Boolean);
  if (sess.mode === 'team') {
    return Object.keys(sess.teams || {}).map(g => ({ groupId: g, label: all.find(p => p.groupId === g)?.teamLabel || g.replace(/^team:/, '') }));
  }
  return all.filter(p => !isLate(sess, p)).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0) || a.id.localeCompare(b.id))
    .map((p, i) => ({ groupId: p.groupId, label: `Player ${i + 1}` }));
}

// The projector. During play it shows counts only. After the report opens it
// carries every run, and the console reveals them one step at a time.
function projectorView(sess, participants, runs, now) {
  const clk = clock(sess, now);
  const all = Object.values(participants || {}).filter(Boolean);
  const room = roomRuns(sess, participants);
  const out = {
    clock: clk, mode: sess.mode, joined: all.length,
    late: sess.mode === 'individual' ? all.filter(p => isLate(sess, p)).length : 0,
    teams: sess.mode === 'team' ? room.length : null,
    revealStep: sess.revealStep || 0, live: null, rows: null,
    steps: C.DEBRIEF.steps
  };
  if (clk.phase === 'questions') {
    const spent = room.map(r => askedIds(runs[r.groupId]).length);
    out.live = { kind: 'questions', spent: spent.reduce((a, b) => a + b, 0), of: room.length * C.QUESTION_BUDGET, finished: spent.filter(n => n >= C.QUESTION_BUDGET).length, runs: room.length };
  } else if (clk.phase === 'commit' || clk.phase === 'plan') {
    const key = clk.phase === 'commit' ? 'vendorVote' : 'planVote';
    const voters = sess.mode === 'team' ? all.filter(p => isMember(sess, p)) : all.filter(p => !isLate(sess, p));
    out.live = { kind: clk.phase, decided: voters.filter(p => p[key]).length, of: voters.length };
  }
  if (clk.phase === 'report') {
    out.rows = room.map(r => {
      const f = runFacts(sess, participants, runs, r.groupId, 'report');
      const routes = E.routesFor(f.vendor, f.questionIds);
      return {
        label: r.label, vendor: f.vendor, vendorName: vendorName(f.vendor), boardChose: f.boardChose,
        questions: f.questionIds.map(id => ({ id, text: C.QUESTIONS.find(q => q.id === id).text, route: C.QUESTIONS.find(q => q.id === id).routes[f.vendor] || null })),
        plan: f.plan, planText: (C.PLANS.find(p => p.key === f.plan) || {}).text || null,
        tier: f.report.tier, tierLabel: C.DEBRIEF.tierLabels[f.report.tier], headline: f.report.headline,
        found: routes.direct.length >= 1 || routes.partial.length >= 2
      };
    });
    const pair = E.disagreement(out.rows);
    out.disagreement = pair
      ? C.DEBRIEF.disagreement.replace('{a}', pair.a).replace('{b}', pair.b).replace('{vendor}', vendorName(pair.vendor))
      : C.DEBRIEF.disagreementNone;
    out.routes = C.VENDORS.map(v => ({
      vendor: v.key, name: v.name, risk: C.DEBRIEF.riskLabels[v.key],
      direct: C.QUESTIONS.filter(q => q.routes[v.key] === 'direct').map(q => ({ id: q.id, text: q.text, answer: q.answers[v.key] })),
      partial: C.QUESTIONS.filter(q => q.routes[v.key] === 'partial').map(q => ({ id: q.id, text: q.text, answer: q.answers[v.key] }))
    }));
    out.debrief = { naming: C.DEBRIEF.naming, turn: C.DEBRIEF.turn };
  }
  return out;
}

function playable(sess, participant, clk, phase) {
  if (sess.state !== 'running') return { error: 'session_not_running', status: 409 };
  if (sess.paused) return { error: 'session_paused', status: 409 };
  if (clk.phase !== phase) return { error: 'phase_closed', status: 409 };
  if (!isMember(sess, participant)) return { error: 'team_not_assigned', status: 409 };
  return null;
}

// Spend one question from the run's shared budget. Returns { next } or { error }.
function applyAsk(sess, participant, run, questionId, now) {
  const clk = clock(sess, now);
  const bad = playable(sess, participant, clk, 'questions'); if (bad) return bad;
  if (!E.QUESTION_IDS.includes(questionId)) return { error: 'invalid_question', status: 400 };
  const questions = (run && run.questions) || [];
  if (questions.some(q => q.id === questionId)) return { error: 'already_asked', status: 409 };
  if (questions.length >= C.QUESTION_BUDGET) return { error: 'budget_spent', status: 409 };
  return { next: { questions: [...questions, { id: questionId, by: participant.id, at: now }] } };
}

function applyVote(sess, participant, kind, choice, now) {
  const clk = clock(sess, now);
  const phase = kind === 'vendor' ? 'commit' : 'plan';
  const field = kind === 'vendor' ? 'vendorVote' : 'planVote';
  const keys = kind === 'vendor' ? E.VENDOR_KEYS : E.PLAN_KEYS;
  if (!['vendor', 'plan'].includes(kind)) return { error: 'invalid_vote', status: 400 };
  const bad = playable(sess, participant, clk, phase); if (bad) return bad;
  if (!keys.includes(choice)) return { error: 'invalid_choice', status: 400 };
  if (participant[field]) return { error: 'already_voted', status: 409 };
  return { next: { ...participant, [field]: choice } };
}

function freezeTeams(participants) {
  const teams = {};
  for (const p of Object.values(participants)) if (p && p.groupId) (teams[p.groupId] ||= []).push(p.id);
  for (const k of Object.keys(teams)) teams[k].sort();
  return teams;
}

function applyControl(sess, set, now, step) {
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
    if (sess.paused) { next.pausedTotalMs = (sess.pausedTotalMs || 0) + (now - (sess.pausedAt || now)); next.pausedAt = null; }
    next.state = 'closed'; next.paused = false; next.closedAt = now;
  } else if (set === 'reveal') {
    if (clock(sess, now).phase !== 'report') return { error: 'report_not_open', status: 409 };
    const n = Number(step);
    if (!Number.isInteger(n) || n < 0 || n > C.DEBRIEF.steps.length) return { error: 'invalid_step', status: 400 };
    next.revealStep = n;
  } else {
    return { error: 'invalid_control', status: 400 };
  }
  return { next };
}

// Platform completion report: the facts of the run, no score and no verdict.
function completionSummary(sess, participants, runs, pid, now) {
  const me = participants[pid];
  if (!me || clock(sess, now).phase !== 'report' || !isMember(sess, me)) return null;
  const f = runFacts(sess, participants, runs, me.groupId, 'report');
  return {
    summary: `Bought ${vendorName(f.vendor)} after ${f.questionIds.length} of ${C.QUESTION_BUDGET} questions`,
    metrics: { mode: sess.mode, vendor: f.vendor, boardChose: f.boardChose, questions: f.questionIds, plan: f.plan, outcome: f.report.tier }
  };
}

module.exports = {
  MODES, elapsedSeconds, clock, isLate, isMember, members, runFacts, freezeTeams,
  studentView, projectorView, applyAsk, applyVote, applyControl, completionSummary
};
