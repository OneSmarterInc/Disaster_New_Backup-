const { checkAccess, body } = require('../lib/guard.js');
const { reportCompletion, verifyLaunch } = require('../lib/launch.js');
const S = require('../lib/scenario.js');
const { buildClosingLesson } = require('../lib/closingLesson.js');
const store = require('../lib/store.js');
const submitSession = require('./session.js');
const { participantError } = require('../lib/session-entry.js');

async function sessionRun(req, b) {
  const code = String(b.sessionCode || '').toUpperCase().trim();
  const pid = String(b.participantId || '');
  // Standalone launches may retain a participant ID from an earlier session.
  // No session code means the normal standalone access guard must handle it.
  if (!code) return null;
  const reject = (status, message) => { const e = new Error(message); e.status = status; throw e; };
  if (!code || !pid) reject(400, 'session_identity_required');
  if (!store.configured()) reject(503, 'no_store');
  const beforeSession = await store.getSession(code);
  if (!beforeSession) reject(404, 'no_such_session');
  const denied = participantError(req, b, beforeSession, pid);
  if (denied) reject(denied.status, denied.error);
  const beforeParticipants = await store.getParticipants(code);
  const beforeMe = beforeParticipants[pid];
  if (!beforeMe) reject(403, 'not_joined');
  const beforeRid = beforeSession.mode === 'individual' ? `individual:${pid}` : beforeMe.groupId;
  const beforeRun = beforeRid ? (await store.getRuns(code))[beforeRid] : null;
  const alreadySaved = beforeSession.mode === 'individual' ? beforeRun?.done : beforeRun?.done;
  // The browser saves its reflection before requesting the completion report.
  // Repeated reports must not resubmit a completed individual run or overwrite
  // a previously saved reflection with an empty/missing request field.
  if (alreadySaved && beforeRun?.year1 && beforeRun?.year2) {
    return { sess: beforeSession, run: beforeRun, participants: beforeParticipants,
      me: beforeMe, rid: beforeRid, code, pid };
  }
  // All facilitated completion writes use the same authorized, optimistic
  // transaction as /session. A second read-modify-write here would lose other
  // members' reflections and could race a runner handoff.
  const saved = {
    statusCode: 200, payload: null,
    status(n) { this.statusCode = n; return this; },
    json(value) { this.payload = value; return this; },
    end() { return this; }
  };
  await submitSession({ method: 'POST', headers: req.headers, body: {
    action: 'submit', code, participantId: pid, runnerRevision: b.runnerRevision,
    reflection1: b.reflection1, reflection2: b.reflection2, done: true
  } }, saved);
  // Includes runner_only, runner_changed, and team_run_not_complete checks.
  if (saved.statusCode !== 200) reject(saved.statusCode, saved.payload?.error || 'completion_failed');
  const sess = await store.getSession(code);
  if (!sess) reject(404, 'no_such_session');
  const participants = await store.getParticipants(code);
  const me = participants[pid];
  if (!me) reject(403, 'not_joined');
  // Use the run ID authorized by submit, not a possibly changed roster group.
  const rid = saved.payload.run.runId;
  const run = (await store.getRuns(code))[rid];
  if (!run || !run.year1 || !run.year2) reject(409, 'allocations_incomplete');
  return { sess, run, participants, me, rid, code, pid };
}

function overallOutcomeText(outcomes) {
  const y1 = outcomes && outcomes.year1 && outcomes.year1.band;
  const heat = outcomes && outcomes.year2 && outcomes.year2.heat && outcomes.year2.heat.band;
  const competitor = outcomes && outcomes.year2 && outcomes.year2.competitor && outcomes.year2.competitor.band;
  const y3 = outcomes && outcomes.year3 && outcomes.year3.band;
  const a = { strong:'Customer reporting became a real capability early.', middle:'Customer reporting became possible, but slowly and with manual work.', weak:'The first customer request exposed a reporting gap.' }[y1] || '';
  const b = { strong:'Operational resilience held when the heat wave tested the company.', middle:'The heat wave strained operations but did not fully break them.', weak:'The heat wave exposed a serious resilience weakness.' }[heat] || '';
  const c = { strong:'Midland could answer the competitor from a position of strength.', middle:'Midland could only mount a limited pilot response to the competitor.', weak:'Midland could not respond quickly to the competitor’s new service model.' }[competitor] || '';
  const d = { strong:'By Year 3, the architecture supported predictive service as something Midland could actually sell.', data_no_room:'You have three years of fault history and nowhere to put it.', pilot:'By Year 3, predictive service was promising, but still only a pilot.', weak:'By Year 3, the architecture still lacked the usable data foundation for predictive service.' }[y3] || '';
  return [a,b,c,d].filter(Boolean).join(' ');
}
function publicOutcome(o) { return o ? { title:o.title, narrative:o.narrative, band:o.band } : null; }
function allocationLabel(a) {
  return `Run ${a.run} · Uptime ${a.uptime} · Capacity ${a.capacity} · Connect ${a.connect} · Features ${a.features}`;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = body(req);
  let y1, y2, outcomes, summary, lessonThresholds, sr = null;
  try {
    sr = await sessionRun(req, b);
    if (sr) {
      y1 = sr.run.year1;
      y2 = sr.run.year2;
      lessonThresholds = S.sessionThresholds(sr.sess);
      outcomes = sr.run.outcomes || S.evaluateAll(y1, y2, lessonThresholds);
      const mine = sr.sess.mode === 'team'
        ? { reflection1: sr.run.reflection1 || '', reflection2: sr.run.reflection2 || '' }
        : (sr.run.reflections?.[sr.pid] || {});
      summary = {
        strategicView: sr.run.strategicView || '', year1: y1, year2: y2,
        reflection1: mine.reflection1 || '', reflection2: mine.reflection2 || '',
        teamRunId: sr.sess.mode === 'team' ? sr.rid : null,
        teamLabel: sr.sess.mode === 'team' ? (sr.me.teamLabel || sr.rid) : null,
        completedBy: sr.sess.mode === 'team' ? (sr.run.completedByName || sr.me.name) : null,
        year3Band: outcomes.year3.band
      };
    } else {
      if (!checkAccess(req, res)) return;
      const standalone = S.standaloneThresholds(b.calibrationId);
      const v1 = S.validateAllocation(b.year1, standalone);
      const v2 = S.validateAllocation(b.year2, standalone);
      if (!v1.ok || !v2.ok) return res.status(400).json({ error: 'invalid_allocations' });
      y1 = v1.allocation; y2 = v2.allocation;
      lessonThresholds = standalone;
      outcomes = S.evaluateAll(y1, y2, lessonThresholds);
      summary = {
        strategicView: String(b.strategicView || '').slice(0, 500),
        year1: y1, year2: y2,
        reflection1: String(b.reflection1 || '').slice(0, 1500),
        reflection2: String(b.reflection2 || '').slice(0, 1500),
        year3Band: outcomes.year3.band
      };
    }
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.code || e.message || 'server_error', message: e.message });
  }
  const closingLesson = buildClosingLesson(y1, y2, outcomes, lessonThresholds);
  summary.result = {
    overall: overallOutcomeText(outcomes),
    year1: publicOutcome(outcomes.year1),
    year2: { heat: publicOutcome(outcomes.year2 && outcomes.year2.heat), competitor: publicOutcome(outcomes.year2 && outcomes.year2.competitor) },
    year3: publicOutcome(outcomes.year3),
    cumulative: outcomes.year3 && outcomes.year3.cumulative ? outcomes.year3.cumulative : null,
    buyers: outcomes.buyers || null
  };
  const metrics = {
    openingView: summary.strategicView,
    year1Allocation: allocationLabel(y1),
    reflection1: summary.reflection1,
    reflection2: summary.reflection2,
    year1Connect: y1.connect,
    cumulativeConnect: outcomes.year3.cumulative.connect,
    cumulativeUptime: outcomes.year3.cumulative.uptime,
    cumulativeCapacity: outcomes.year3.cumulative.capacity,
    year3Band: outcomes.year3.band
  };
  const lt = req.headers['x-launch-token'];
  const launch = lt ? verifyLaunch(String(lt)) : null;
  let report = { ok: false, skipped: true };
  if (launch && (!launch.sim || launch.sim === S.META.id)) {
    let subjects = [launch.sub];
    if (sr && sr.sess.mode === 'team') {
      const teamSubjects = Object.values(sr.participants || {})
        .filter(p => p && p.groupId === sr.rid && String(p.id || '').startsWith('platform:'))
        .map(p => String(p.id).slice('platform:'.length));
      if (teamSubjects.length) subjects = teamSubjects;
    }
    const reports = [];
    for (const sub of [...new Set(subjects)]) {
      reports.push(await reportCompletion({
        launch: { ...launch, sub },
        summary: sr && sr.sess.mode === 'team' ? { ...summary, completedFor: sub } : summary,
        metrics
      }));
    }
    report = { ok: reports.some(r => r.ok), reports };
  }
  return res.status(200).json({ ok: true, completionReported: !!report.ok, outcomes, closingLesson });
};
