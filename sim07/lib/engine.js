// Pure functions for RapidSim 07. No I/O, so the checks can exercise them directly.
const { SETTINGS, PRE_REVEAL, REVEAL } = require('../data/config.js');

const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

function settingsOf(sess) { return { ...SETTINGS, ...(sess && sess.settings || {}) }; }

function deadline(sess) {
  if (!sess || !sess.startedAt) return null;
  return sess.startedAt + settingsOf(sess).decisionMinutes * 60000;
}

// Decisions close at the clock or when the instructor ends them early.
function closedAt(sess) {
  const d = deadline(sess);
  if (d == null) return null;
  return sess.closedEarlyAt ? Math.min(d, sess.closedEarlyAt) : d;
}
function decisionsOpen(sess, now) {
  const c = closedAt(sess);
  return !!sess && sess.state === 'running' && c != null && now < c;
}
// A decision arriving within the grace window after the close still counts.
function acceptsDecision(sess, now) {
  const c = closedAt(sess);
  return !!sess && sess.state === 'running' && c != null && now < c + settingsOf(sess).lapseGraceSeconds * 1000;
}

function consolePresent(sess, lastBeat, now) {
  return !!lastBeat && now - lastBeat < settingsOf(sess).consoleHeartbeatSeconds * 1000;
}

// The released stage. With a live console (presenter or projector polling) the
// instructor controls it. Without one, stages auto-advance one interval at a
// time, counted from the later of the close and the last console contact, so a
// laptop lid closed mid-debrief moves the room on by one stage, not to the end.
// The presenter persists any auto-advanced stage when it reconnects, so the
// released stage never goes backwards.
function effectiveStage(sess, lastBeat, now) {
  if (!sess || !sess.startedAt) return 0;
  const manual = Math.max(0, Math.min(3, Number(sess.stage) || 0));
  if (consolePresent(sess, lastBeat, now)) return manual;
  const c = closedAt(sess);
  if (c == null || now < c) return manual;
  const base = Math.max(c, lastBeat || 0);
  const steps = Math.floor((now - base) / (settingsOf(sess).autoAdvanceSeconds * 1000));
  return Math.min(3, manual + Math.max(0, steps));
}

function phaseOf(sess, now) {
  if (!sess) return 'none';
  if (sess.state === 'lobby') return 'lobby';
  if (sess.state === 'closed') return 'closed';
  return decisionsOpen(sess, now) ? 'deciding' : 'decided';
}

// A participant's recorded position. Anyone without a decision after the close
// is treated as a lapsed offer, which counts as declining.
function positionOf(p, sess, now) {
  if (p && p.choice) return { choice: p.choice, lapsed: !!p.lapsed, text: p.justification || '' };
  if (sess && sess.state !== 'lobby' && !acceptsDecision(sess, now)) return { choice: 'decline', lapsed: true, text: '' };
  return null;
}

function teamOutcomes(participants, sess, now) {
  const groups = {};
  for (const p of Object.values(participants || {})) {
    if (!p || !p.groupId) continue;
    const g = (groups[p.groupId] ||= { groupId: p.groupId, label: p.teamLabel || '', buy: 0, decline: 0, open: 0 });
    const pos = positionOf(p, sess, now);
    if (!pos) g.open++; else g[pos.choice]++;
  }
  return Object.values(groups).map(g => ({
    ...g,
    // Majority decides. A tie declines: an offer nobody can agree to accept lapses.
    outcome: g.open ? null : (g.buy > g.decline ? 'buy' : 'decline'),
    tie: !g.open && g.buy === g.decline
  })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

function stageContent(n) {
  return REVEAL.stages.filter(s => s.n <= n).map(s => (s.n === 3 ? { ...s, close: REVEAL.close } : { ...s }));
}

// Projector payload: aggregates only. Never names, never participant ids.
function projectorView(sess, participants, lastBeat, now) {
  const people = Object.values(participants || {}).filter(Boolean);
  const phase = phaseOf(sess, now);
  const decided = people.filter(p => p.choice).length;
  const out = {
    title: sess.name, mode: sess.mode, phase,
    now, closesAt: closedAt(sess),
    joined: people.length, decided,
    stage: effectiveStage(sess, lastBeat, now),
    prompts: sess.showPrompts ? PRE_REVEAL.debriefPrompts : null
  };
  if (phase === 'decided' || phase === 'closed') {
    const split = { bought: 0, declined: 0, lapsed: 0 };
    const rec = {};
    for (const key of ['yes', 'no', 'unsure', 'none']) rec[key] = { buy: 0, decline: 0 };
    for (const p of people) {
      const pos = positionOf(p, sess, now);
      if (!pos) continue;
      if (pos.choice === 'buy') split.bought++; else split.declined++;
      if (pos.lapsed) split.lapsed++;
      rec[['yes', 'no', 'unsure'].includes(p.recognised) ? p.recognised : 'none'][pos.choice]++;
    }
    out.split = split;
    out.recognition = rec;
    if (sess.mode === 'team') out.teams = teamOutcomes(participants, sess, now).map(t => ({
      label: t.label, buy: t.buy, decline: t.decline, outcome: t.outcome, tie: t.tie
    }));
    out.pinned = (sess.pinned || []).map(id => participants[id]).filter(Boolean)
      .map(p => { const pos = positionOf(p, sess, now); return { choice: pos.choice, lapsed: pos.lapsed, text: pos.text }; });
  }
  if (out.stage > 0) {
    const s = REVEAL.stages.find(x => x.n === out.stage);
    out.stageTitle = { year: s.year, title: s.title, names: out.stage === 3 ? s.names : null };
  }
  return out;
}

// Presenter list: anonymous labels, stable per session, in join order.
function responseList(sess, participants, now) {
  return Object.values(participants || {}).filter(Boolean)
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0) || a.id.localeCompare(b.id))
    .map((p, i) => {
      const pos = positionOf(p, sess, now);
      return { id: p.id, label: `Response ${i + 1}`, name: p.name, team: p.teamLabel || '',
        choice: pos ? pos.choice : null, lapsed: pos ? pos.lapsed : false, text: pos ? pos.text : '',
        recognised: p.recognised || null };
    });
}

// "Suggest a pair": the longest bought and the longest declined justification.
function suggestPair(list) {
  const longest = (c) => list.filter(r => r.choice === c && r.text && !r.lapsed)
    .sort((a, b) => words(b.text) - words(a.text))[0];
  const a = longest('buy'), b = longest('decline');
  return a && b ? [a.id, b.id] : null;
}

function autoTeams(participants, size) {
  const n = Math.max(2, Math.min(8, Number(size) || 4));
  const ids = Object.values(participants).filter(Boolean)
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0) || a.id.localeCompare(b.id)).map(p => p.id);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const teams = Math.max(1, Math.ceil(ids.length / n));
  const assign = {};
  ids.forEach((id, i) => { const t = (i % teams) + 1; assign[id] = { groupId: `team:${t}`, teamLabel: `Team ${t}` }; });
  return assign;
}

function smallestTeam(participants) {
  const counts = {};
  for (const p of Object.values(participants || {})) if (p && p.groupId) counts[p.groupId] = (counts[p.groupId] || 0) + 1;
  const entries = Object.entries(counts).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], undefined, { numeric: true }));
  if (!entries.length) return { groupId: 'team:1', teamLabel: 'Team 1' };
  const gid = entries[0][0];
  return { groupId: gid, teamLabel: `Team ${gid.split(':')[1]}` };
}

module.exports = {
  words, settingsOf, deadline, closedAt, decisionsOpen, acceptsDecision, consolePresent,
  effectiveStage, phaseOf, positionOf, teamOutcomes, stageContent, projectorView,
  responseList, suggestPair, autoTeams, smallestTeam
};
