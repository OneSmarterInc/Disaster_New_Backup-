// RapidSim 05 engine. Pure functions only: no storage, no clock reads, no I/O.
// The picture of what Loopwell can work out is always computed from the set of
// approved data, never authored per path, so every one of the 32 paths is covered.
const C = require('../config/content.js');

const DECISIONS = ['approve', 'decline', 'timeout'];
const KEYS = C.ROUNDS.map(r => r.key);
const LEVEL_RANK = { high: 3, moderate: 2, low: 1 };

function normalise(d) {
  return DECISIONS.includes(d) ? d : 'timeout';
}

// A timeout ships the feature, so it counts as an approval for the data.
function ships(d) {
  return normalise(d) !== 'decline';
}

// decisions: array indexed by round (0..4). Rounds not yet reached are ignored
// by passing `upTo`, the number of rounds decided so far.
function approvedKeys(decisions, upTo = KEYS.length) {
  const set = new Set();
  for (let i = 0; i < upTo; i++) if (ships(decisions[i])) set.add(KEYS[i]);
  return set;
}

function picture(keys, intensity = 'standard') {
  const lighter = intensity === 'lighter';
  const out = [];
  for (const inf of C.INFERENCES) {
    const hit = inf.levels.find(l => l.requires.every(k => keys.has(k)));
    if (!hit) continue;
    out.push({
      id: inf.id,
      label: lighter && inf.lighterLabel ? inf.lighterLabel : hit.label || inf.label,
      level: hit.level,
      text: lighter && hit.lighter ? hit.lighter : hit.text
    });
  }
  return out;
}

// What the student sees after round r (1-based). "changed" marks inferences that
// are new or whose text moved since the previous round. A decline never reports
// what it prevented: it shows the unchanged picture plus the cost line.
function roundResult(decisions, r, intensity = 'standard') {
  const round = C.ROUNDS[r - 1];
  const decision = normalise(decisions[r - 1]);
  const before = picture(approvedKeys(decisions, r - 1), intensity);
  const after = picture(approvedKeys(decisions, r), intensity);
  const prev = new Map(before.map(p => [p.id, p.text]));
  const changed = after.filter(p => prev.get(p.id) !== p.text).map(p => p.id);
  const added = changed.filter(id => !prev.has(id));
  return {
    round: r,
    title: round.title,
    decision,
    picture: after,
    changed,
    added,
    cost: decision === 'decline' ? round.cost : null
  };
}

function endingGroup(pic) {
  const byId = new Map(pic.map(p => [p.id, p.level]));
  for (const e of C.ENDINGS) {
    if (!e.when) return e.group;
    const ok = Object.entries(e.when).some(([id, levels]) => levels.includes(byId.get(id)));
    if (ok) return e.group;
  }
  return C.ENDINGS[C.ENDINGS.length - 1].group;
}

function endingLabel(group, intensity = 'standard') {
  const e = C.ENDINGS.find(x => x.group === group);
  return intensity === 'lighter' && e.lighterLabel ? e.lighterLabel : e.label;
}

function ending(decisions, intensity = 'standard') {
  const norm = KEYS.map((_, i) => normalise(decisions[i]));
  const pic = picture(approvedKeys(norm), intensity);
  return {
    decisions: C.ROUNDS.map((r, i) => ({ round: r.n, title: r.title, decision: norm[i] })),
    knows: pic,
    missing: C.ROUNDS.filter((r, i) => norm[i] === 'decline').map(r => r.missing),
    group: endingGroup(pic)
  };
}

// Team rule: private votes, majority decides, a tie ships, and a member who has
// not voted when the clock runs out counts as approving (silence ships).
function teamDecision(memberIds, votes) {
  let approve = 0, decline = 0, missing = 0;
  for (const id of memberIds) {
    const v = votes[id];
    if (v === 'approve') approve++;
    else if (v === 'decline') decline++;
    else missing++;
  }
  const yes = approve + missing;
  let decision;
  if (decline > yes) decision = 'decline';
  // It shipped, but nobody actually approved it: silence carried it, so say so.
  else if (approve === 0) decision = 'timeout';
  else decision = 'approve';
  return { decision, approve, decline, missing, split: approve > 0 && decline > 0 };
}

// Room clock. Everyone shares one schedule measured from the session start,
// minus any paused time the caller has already subtracted.
function schedule(clock = C.CLOCK) {
  const segs = [{ phase: 'briefing', round: 0, seconds: clock.briefingSeconds }];
  for (const r of C.ROUNDS) {
    segs.push({ phase: 'decide', round: r.n, seconds: clock.decisionSeconds });
    segs.push({ phase: 'reveal', round: r.n, seconds: clock.revealSeconds });
  }
  segs.push({ phase: 'ending', round: 0, seconds: clock.endingSeconds });
  return segs;
}

function totalSeconds(clock = C.CLOCK) {
  return schedule(clock).reduce((s, x) => s + x.seconds, 0);
}

function phaseAt(elapsedSeconds, clock = C.CLOCK) {
  let t = Math.max(0, elapsedSeconds);
  for (const seg of schedule(clock)) {
    if (t < seg.seconds) return { phase: seg.phase, round: seg.round, remaining: seg.seconds - t };
    t -= seg.seconds;
  }
  return { phase: 'closed', round: 0, remaining: 0 };
}

// Projector aggregates. `runs` is a list of { decisions: [...5] }, one per
// student (individual) or per team. Nothing here identifies anyone.
function aggregate(runs, intensity = 'standard', opts = {}) {
  const team = opts.mode === 'team';
  const rounds = C.ROUNDS.map(r => ({ round: r.n, title: r.title, approve: 0, decline: 0, timeout: 0, splitTeams: 0 }));
  const groups = C.ENDINGS.map(e => ({ group: e.group, label: endingLabel(e.group, intensity), count: 0 }));
  let reached = 0, reachedAndDeclined = 0, complete = 0;
  for (const run of runs) {
    const d = run.decisions || [];
    d.forEach((x, i) => { if (i < rounds.length && x) rounds[i][normalise(x)]++; });
    (run.splits || []).forEach((s, i) => { if (s && rounds[i]) rounds[i].splitTeams++; });
    if (d.filter(Boolean).length < KEYS.length) continue;
    complete++;
    const e = ending(d, intensity);
    groups.find(g => g.group === e.group).count++;
    if (e.knows.some(p => p.id === 'health' && C.DEBRIEF.headlineLevels.includes(p.level))) {
      reached++;
      if (d.some(x => normalise(x) === 'decline')) reachedAndDeclined++;
    }
  }
  // Disagreement across the class: the closest approve/decline split of a round.
  const contested = rounds.filter(r => r.approve > 0 && r.decline > 0);
  const across = contested.length
    ? contested.slice().sort((a, b) =>
        Math.abs(a.approve - a.decline) - Math.abs(b.approve - b.decline) || a.round - b.round)[0]
    : null;
  // In team mode, disagreement inside teams counts too, and usually matters more.
  const inside = team ? rounds.filter(r => r.splitTeams > 0).sort((a, b) => b.splitTeams - a.splitTeams || a.round - b.round)[0] || null : null;
  const useInside = inside && (!across || inside.splitTeams >= Math.min(across.approve, across.decline));
  const mostDivided = useInside ? inside : across;
  const what = C.DEBRIEF.headlineWhat[intensity === 'lighter' ? 'lighter' : 'standard'];
  const unit = complete === 1 ? (team ? 'team' : 'student') : (team ? 'teams' : 'students');
  let headline = null;
  if (complete) {
    headline = reached === 0
      ? fill(C.DEBRIEF.headlineZero, { total: complete, unit, what })
      : fill(C.DEBRIEF.headlineMain, { reached, total: complete, unit, what }) + ' ' +
        (reachedAndDeclined === 0 ? C.DEBRIEF.headlineNoneDeclined : fill(C.DEBRIEF.headlineSomeDeclined, { declinedSome: reachedAndDeclined }));
  }
  let disagreement = C.DEBRIEF.noDisagreement;
  if (useInside) {
    const n = inside.splitTeams;
    disagreement = fill(C.DEBRIEF.disagreementTeams, { round: inside.round, teams: n === 1 ? '1 team' : `${n} teams`, whose: n === 1 ? 'its' : 'their' });
  } else if (across) {
    disagreement = fill(C.DEBRIEF.disagreement, { round: across.round, approve: across.approve, decline: across.decline });
  }
  return { rounds, groups, complete, reached, reachedAndDeclined, headline, mostDivided: mostDivided && mostDivided.round, disagreement };
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in values ? String(values[k]) : `{${k}}`));
}

module.exports = {
  DECISIONS, KEYS, LEVEL_RANK,
  normalise, ships, approvedKeys, picture, roundResult,
  endingGroup, endingLabel, ending, teamDecision,
  schedule, totalSeconds, phaseAt, aggregate, fill
};
