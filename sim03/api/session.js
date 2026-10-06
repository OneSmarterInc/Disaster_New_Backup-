const { body } = require('../lib/guard.js');
const { syncCourseRoster, approvedIds } = require('../lib/session-roster.js');
const store = require('../lib/store.js');
const { verifyLaunch } = require('../lib/launch.js');
const S = require('../lib/scenario.js');
const { accountJoinUrl, participantLaunch, participantError } = require('../lib/session-entry.js');
const { leadOf, runnerOf, revisionOf, screenOf } = require('../lib/team-runner.js');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const newId = () => Math.random().toString(36).slice(2, 10);

function facultyRoster() {
  const raw = process.env.FACULTY_CODES || '';
  const out = [];
  raw.split(',').map(s => s.trim()).filter(Boolean).forEach(entry => {
    const i = entry.lastIndexOf(':');
    if (i > 0) out.push({ name: entry.slice(0, i).trim(), code: entry.slice(i + 1).trim() });
  });
  if (process.env.FACULTY_CODE) out.push({ name: 'Facilitator', code: process.env.FACULTY_CODE });
  return out;
}

function whoIsFaculty(req, b) {
  const lt = req.headers['x-launch-token'] || (b && b.launchToken);
  if (lt) {
    const p = verifyLaunch(String(lt));
    if (p && p.sim === S.META.id && (p.role === 'faculty' || p.role === 'faculty_preview')) {
      return { name: p.name || 'Facilitator', userId: p.sub || null, platformAuth: true, courseId: p.course || null };
    }
  }

  // Fail closed. An empty standalone faculty roster is not authorization.
  // Platform-launched faculty use the signed launch token above; direct
  // standalone faculty access requires an explicitly configured code.
  const roster = facultyRoster();
  if (!roster.length) return null;
  const given = String((b && b.facultyCode) || req.headers['x-faculty-code'] || '').trim();
  if (!given) return null;
  const hit = roster.find(r => r.code === given);
  return hit ? { name: hit.name } : null;
}

function ownsSession(who, sess) {
  if (!who) return false;
  if (sess.platformAuth) {
    if (!who.platformAuth) return false;
    if (sess.courseId && sess.courseId !== who.courseId) return false;
    if (sess.ownerId) return sess.ownerId === who.userId;
    return !!sess.owner && sess.owner === who.name;
  }
  // Standalone sessions belong to the facilitator code that created them. A
  // platform account never matches one by display name.
  if (who.platformAuth) return false;
  return !!sess.owner && sess.owner === who.name;
}

function publicSession(sess) {
  return {
    code: sess.code,
    name: sess.name,
    mode: sess.mode,
    state: sess.state,
    paused: !!sess.paused,
    createdAt: sess.createdAt,
    startedAt: sess.startedAt || null,
    allocationRules: S.publicRules(S.sessionThresholds(sess))
  };
}

function captainMap(participants, explicit) {
  const groups = {};
  Object.values(participants).filter(Boolean).forEach(p => {
    if (!p.groupId) return;
    (groups[p.groupId] ||= []).push(p);
  });
  const result = {};
  for (const [gid, members] of Object.entries(groups)) {
    const requested = explicit && explicit[gid];
    const chosen = requested && members.find(m => m.id === requested)
      ? requested
      : members.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))[0].id;
    result[gid] = chosen;
  }
  return result;
}

function runIdFor(sess, participant) {
  if (!participant) return null;
  return sess.mode === 'individual' ? `individual:${participant.id}` : participant.groupId;
}

function publicRun(run) {
  if (!run) return null;
  const teamRunComplete = !!run.runId && !String(run.runId).startsWith('individual:') && Number(run.phase || 0) >= 3;
  return {
    runId: run.runId,
    phase: run.phase || 0,
    screen: screenOf(run),
    year2Event: run.year2Event || 0,
    runnerId: run.runnerId || null,
    runnerRevision: revisionOf(run),
    year1: run.year1 || null,
    year2: run.year2 || null,
    strategicView: run.strategicView || '',
    reflection1: run.reflection1 || '',
    reflection2: run.reflection2 || '',
    outcomes: run.outcomes || null,
    done: !!run.done || teamRunComplete,
    finishedBy: run.finishedBy || {},
    updatedAt: run.updatedAt || null
  };
}

function visibleFacultyRuns(sess, runs) {
  if (!sess || sess.mode !== 'team') return runs;
  return Object.fromEntries(Object.entries(runs || {}).map(([id, run]) => {
    const complete = !!run?.done || Number(run?.phase || 0) >= 3;
    return [id, complete ? { ...run, done: true, completedAt: run.completedAt || run.updatedAt || null } : run];
  }));
}

function sameAllocation(a, b) {
  return !!a && !!b && S.LINES.every(k => Number(a[k]) === Number(b[k]));
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!store.configured()) {
    return res.status(503).json({
      error: 'no_store',
      message: 'Session storage is not configured for this deployment.'
    });
  }

  const b = body(req);
  const action = String(b.action || '');
  const code = String(b.code || '').toUpperCase().trim();

  try {
    if (['join', 'state', 'submit', 'set_runner'].includes(action)) {
      const sess = await store.getSession(code);
      if (sess) {
        const error = participantError(req, b, sess, action === 'join' ? null : String(b.participantId || ''));
        if (error) return res.status(error.status).json({ error: error.error });
      }
    }
    for (let attempt = 0; attempt < 5; attempt++) {
    switch (action) {
      case 'create': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
        const mode = String(b.mode || '');
        if (!['individual', 'team'].includes(mode)) {
          return res.status(400).json({ error: 'play_mode_required' });
        }
        const thresholdCheck = S.validateThresholds(b.thresholds);
        if (!thresholdCheck.ok) return res.status(400).json(thresholdCheck);
        const c = newCode();
        const sess = {
          code: c,
          owner: who.name,
          ownerId: who.userId || null,
          platformAuth: !!who.platformAuth,
          courseId: who.courseId || null,
          name: String(b.name || 'Midland Equipment').slice(0, 80),
          mode,
          state: 'lobby',
          paused: false,
          thresholds: thresholdCheck.thresholds,
          createdAt: Date.now()
        };
        await store.putSession(c, sess);
        return res.status(200).json({ session: sess, you: who.name });
      }

      case 'faculty_state': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (!ownsSession(who, sess)) {
          return res.status(403).json({ error: 'not_your_session', message: `That session belongs to ${sess.owner}.` });
        }
        const [participants, runs] = await Promise.all([
          store.getParticipants(code),
          store.getRuns(code)
        ]);
        return res.status(200).json({
          session: { ...sess, thresholds: S.sessionThresholds(sess), joinUrl: sess.platformAuth ? accountJoinUrl(sess) : null },
          participants,
          runs: visibleFacultyRuns(sess, runs),
          you: who.name,
          defaultThresholds: S.DEFAULT_THRESHOLDS,
          responsePrompts: { opening: S.publicConfig().viewPrompt,
            reflections: S.publicConfig().reflectionPrompts, followups: S.publicConfig().reflectionFollowups }
        });
      }

      case 'faculty_enrolments': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (!ownsSession(who, sess)) return res.status(403).json({ error: 'not_your_session' });
        try {
          const roster = await syncCourseRoster(req, b, sess);
          return res.status(200).json({ ...roster, participants: await store.getParticipants(code) });
        }
        catch (error) {
          return res.status(error.status || 503).json({ error: 'course_roster_unavailable',
            message: error.message || 'Course enrolment could not be refreshed.' });
        }
      }

      case 'calibrate': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (!ownsSession(who, sess)) return res.status(403).json({ error: 'not_your_session' });
        if (sess.state !== 'lobby') {
          return res.status(409).json({ error: 'session_already_started', message: 'Calibration is locked once the session starts.' });
        }
        if (b.thresholds != null && (typeof b.thresholds !== 'object' || Array.isArray(b.thresholds))) {
          return res.status(400).json({ error: 'invalid_thresholds', errors: ['Calibration must be an object.'] });
        }
        const thresholdCheck = S.validateThresholds({ ...S.sessionThresholds(sess), ...(b.thresholds || {}) });
        if (!thresholdCheck.ok) return res.status(400).json(thresholdCheck);
        const next = { ...sess, thresholds: thresholdCheck.thresholds };
        if (!await store.compareAndSetSession(code, sess, next)) continue;
        return res.status(200).json({ session: next });
      }

      case 'group': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (!ownsSession(who, sess)) return res.status(403).json({ error: 'not_your_session' });
        if (sess.mode !== 'team') return res.status(409).json({ error: 'not_team_mode' });

        if (sess.state === 'closed') return res.status(409).json({ error: 'session_closed' });
        const roster = sess.platformAuth && sess.courseId ? await syncCourseRoster(req, b, sess) : null;
        const allowed = approvedIds(roster);
        const participants = await store.getParticipants(code);
        const previousParticipants = structuredClone(participants);
        const previousCaptains = {};
        for (const p of Object.values(participants)) if (p && p.groupId && p.isCaptain) previousCaptains[p.groupId] = p.id;
        const rawAssign = b.assign && typeof b.assign === 'object' ? b.assign : {};
        for (const [id, label] of Object.entries(rawAssign)) {
          if (!participants[id]) return res.status(404).json({ error: 'no_such_participant', message: 'Refresh students before assigning this person.' });
          if (allowed && !allowed.has(id) && label !== '__unassigned__' && label) {
            return res.status(403).json({ error: 'student_not_approved', message: 'Only currently approved course students can be assigned to teams.' });
          }
        }
        for (const p of Object.values(participants)) {
          if (!p || !Object.prototype.hasOwnProperty.call(rawAssign, p.id)) continue;
          const label = String(rawAssign[p.id] || '').trim().slice(0, 40);
          if (label === '__unassigned__' || !label) {
            p.groupId = null;
            p.teamLabel = '';
            p.isCaptain = false;
          } else if (label.startsWith('team:')) {
            const target = Object.values(participants).find(x => x && x.groupId === label);
            if (!target) return res.status(404).json({ error: 'no_such_team' });
            p.groupId = label;
            p.teamLabel = target.teamLabel || label.slice(5);
          } else if (label === '__solo__') {
            p.groupId = `solo:${p.id}`;
            p.teamLabel = p.name;
          } else {
            const norm = label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
            if (!norm) return res.status(400).json({ error: 'team_name_required' });
            p.groupId = `team:${norm}`;
            p.teamLabel = label;
          }
        }
        const caps = captainMap(participants, { ...previousCaptains, ...(b.captains || {}) });
        for (const p of Object.values(participants)) {
          if (!p) continue;
          p.isCaptain = !!(p.groupId && caps[p.groupId] === p.id);
        }
        if (!await store.compareAndSetRoster(code, previousParticipants, participants, sess)) continue;
        return res.status(200).json({ ok: true, captains: caps });
      }

      case 'rename_team': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (!ownsSession(who, sess)) return res.status(403).json({ error: 'not_your_session' });
        if (sess.mode !== 'team') return res.status(409).json({ error: 'not_team_mode' });
        if (sess.state === 'closed') return res.status(409).json({ error: 'session_closed' });
        const groupId = String(b.groupId || '').trim();
        const teamLabel = String(b.teamLabel || '').trim().slice(0, 40);
        if (!groupId || !teamLabel) return res.status(400).json({ error: 'team_name_required' });
        const participants = await store.getParticipants(code);
        const previousParticipants = structuredClone(participants);
        const members = Object.values(participants).filter(p => p && p.groupId === groupId);
        if (!members.length) return res.status(404).json({ error: 'no_such_team' });
        for (const p of members) {
          p.teamLabel = teamLabel;
        }
        if (!await store.compareAndSetRoster(code, previousParticipants, participants, sess)) continue;
        return res.status(200).json({ ok: true, groupId, teamLabel });
      }

      // Older clients must not silently change team leadership to take control.
      case 'claim_lead':
        return res.status(409).json({ error: 'runner_assignment_required', message: 'Reload this page. Your team lead can select a simulation runner without changing team leadership.' });

      case 'set_runner': {
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (sess.mode !== 'team') return res.status(409).json({ error: 'not_team_mode' });
        if (sess.state === 'closed') return res.status(409).json({ error: 'session_closed' });
        const participants = await store.getParticipants(code);
        const me = participants[String(b.participantId || '')];
        if (!me) return res.status(403).json({ error: 'not_joined' });
        if (!me.groupId) return res.status(409).json({ error: 'team_not_assigned' });
        if (leadOf(participants, me.groupId)?.id !== me.id) {
          return res.status(403).json({ error: 'team_lead_only', message: 'Agree as a team, then ask your team lead to assign the runner.' });
        }
        const chosen = participants[String(b.runnerId || '')];
        if (!chosen || chosen.groupId !== me.groupId) {
          return res.status(400).json({ error: 'runner_must_be_teammate' });
        }
        const previous = (await store.getRuns(code))[me.groupId] || null;
        if (Number(previous?.phase || 0) >= 3 || previous?.done) {
          return res.status(409).json({ error: 'run_already_completed' });
        }
        const runner = runnerOf(participants, me.groupId, previous);
        if (b.expectedRunnerId !== (runner?.id || null) || b.runnerRevision !== revisionOf(previous)) {
          return res.status(409).json({ error: 'runner_changed', message: 'The runner changed. Review the current selection and try again.' });
        }
        const next = {
          ...(previous || { runId: me.groupId, phase: 0, done: false, createdAt: Date.now() }),
          runnerId: chosen.id,
          runnerRevision: revisionOf(previous) + 1,
          runnerAssignedBy: me.id,
          runnerAssignedAt: Date.now(),
          updatedAt: Date.now()
        };
        if (!await store.compareAndSetRun(code, me.groupId, previous, next, sess, participants)) continue;
        return res.status(200).json({ ok: true, runnerId: chosen.id, runnerRevision: next.runnerRevision });
      }

      case 'set_captain': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (!ownsSession(who, sess)) return res.status(403).json({ error: 'not_your_session' });
        if (sess.mode !== 'team') return res.status(409).json({ error: 'not_team_mode' });
        if (sess.state === 'closed') return res.status(409).json({ error: 'session_closed' });
        const participants = await store.getParticipants(code);
        const previousParticipants = structuredClone(participants);
        const pid = String(b.participantId || '');
        const chosen = participants[pid];
        if (!chosen || !chosen.groupId) return res.status(404).json({ error: 'no_such_participant' });
        for (const p of Object.values(participants)) {
          if (!p || p.groupId !== chosen.groupId) continue;
          p.isCaptain = p.id === pid;
        }
        if (!await store.compareAndSetRoster(code, previousParticipants, participants, sess)) continue;
        return res.status(200).json({ ok: true, groupId: chosen.groupId, captainId: pid });
      }

      case 'control': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (!ownsSession(who, sess)) return res.status(403).json({ error: 'not_your_session' });

        const previousSession = structuredClone(sess);
        if (b.set === 'start' && sess.state !== 'lobby') {
          return res.status(409).json({ error: 'session_already_started', message: 'This session has already started. Use Resume for a paused session.' });
        }
        if (b.set === 'start') {
          if (sess.mode === 'team') {
            const roster = sess.platformAuth && sess.courseId ? await syncCourseRoster(req, b, sess) : null;
            const allowed = approvedIds(roster);
            const participants = await store.getParticipants(code);
            const inactiveAssigned = Object.values(participants).filter(p => p && p.groupId && allowed && !allowed.has(p.id));
            if (inactiveAssigned.length) return res.status(409).json({ error: 'student_not_approved',
              message: 'Some assigned students no longer have course access. Unassign them or restore approval before starting.' });
            const all = Object.values(participants).filter(p => p && (!allowed || allowed.has(p.id)));
            if (!all.length) {
              return res.status(409).json({ error: 'participants_required', message: 'Approve at least one course student and assign a team before starting. Standalone students join using the session link.' });
            }
            const unassigned = all.filter(p => !p.groupId);
            if (unassigned.length) {
              return res.status(409).json({
                error: 'unassigned_participants',
                count: unassigned.length,
                participantIds: unassigned.map(p => p.id),
                message: `${unassigned.length} student${unassigned.length === 1 ? ' is' : 's are'} still unassigned. Assign every student to a team before starting.`
              });
            }
            const groups = {};
            for (const p of all) (groups[p.groupId] ||= []).push(p);
            const missingLead = Object.entries(groups).filter(([, members]) => !members.some(p => p.isCaptain)).map(([gid]) => gid);
            if (missingLead.length) {
              return res.status(409).json({ error: 'team_lead_required', groupIds: missingLead, message: 'Every team must have one team lead before the session starts.' });
            }
          }
          sess.state = 'running';
          sess.startedAt = Date.now();
        }
        if (b.set === 'pause') sess.paused = true;
        if (b.set === 'resume') sess.paused = false;
        if (b.set === 'close') sess.state = 'closed';
        if (!await store.compareAndSetSession(code, previousSession, sess)) continue;
        return res.status(200).json({ session: sess });
      }

      case 'join': {
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (sess.state === 'closed') return res.status(410).json({ error: 'session_closed' });

        const launched = participantLaunch(req, b);
        if ((req.headers['x-launch-token'] || b.launchToken) && !launched) {
          return res.status(401).json({ error: 'launch_token_invalid' });
        }
        if (launched && sess.courseId && launched.course !== sess.courseId) {
          return res.status(403).json({ error: 'session_course_mismatch' });
        }
        const name = String(launched ? launched.name || '' : b.name || '').slice(0, 60).trim();
        if (!name) return res.status(400).json({ error: 'name_required' });
        const all = await store.getParticipants(code);
        const key = x => String(x || '').trim().toLowerCase();
        let id = launched ? `platform:${launched.sub}` : String(b.participantId || '').trim();
        if (!launched && (!id || !all[id])) {
          const match = Object.values(all).find(p => p && !p.id.startsWith('platform:') && key(p.name) === key(name));
          id = match ? match.id : (id || newId());
        }
        if (!launched && id.startsWith('platform:')) {
          return res.status(401).json({ error: 'platform_signin_required' });
        }
        const existing = all[id];

        let groupId = existing ? existing.groupId : null;
        let teamLabel = existing ? (existing.teamLabel || '') : '';
        if (sess.mode === 'individual') {
          groupId = `individual:${id}`;
          teamLabel = name;
        } else if (!existing) {
          // Team sessions are instructor-managed. New students always enter the
          // unassigned pool; the faculty console creates teams and chooses leads.
          groupId = null;
          teamLabel = '';
        }

        const participant = {
          ...existing,
          id,
          name,
          groupId,
          teamLabel,
          isCaptain: existing ? !!existing.isCaptain : sess.mode === 'individual',
          joinedAt: existing?.joinedAt || Date.now()
        };
        if (!await store.compareAndSetParticipant(code, id, existing, participant, sess)) continue;
        return res.status(200).json({ participantId: id, session: publicSession(sess), me: participant });
      }

      case 'state': {
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        const pid = String(b.participantId || '');
        const participants = await store.getParticipants(code);
        const me = participants[pid] || null;
        if (!me) return res.status(403).json({ error: 'not_joined' });

        const runs = await store.getRuns(code);
        const rid = runIdFor(sess, me);
        const rawRun = rid ? runs[rid] : null;
        const runner = runnerOf(participants, me.groupId, rawRun);
        const canSubmit = sess.mode === 'individual' || runner?.id === me.id;
        const mates = Object.values(participants).filter(p => p && me.groupId && p.groupId === me.groupId)
          .map(p => ({ id: p.id, name: p.name, isCaptain: !!p.isCaptain, isRunner: p.id === runner?.id }));
        const run = publicRun(rawRun);
        if (run && sess.mode === 'team') {
          const runnerReflection = rawRun.reflections?.[runner?.id] || {};
          run.reflection1 = rawRun.reflection1 || runnerReflection.reflection1 || '';
          run.reflection2 = rawRun.reflection2 || runnerReflection.reflection2 || '';
          run.done = !!rawRun.done || Number(rawRun.phase || 0) >= 3;
        }
        return res.status(200).json({
          session: publicSession(sess),
          me: { ...me, isRunner: canSubmit },
          mates,
          canSubmit,
          canAssignRunner: sess.mode === 'team' && leadOf(participants, me.groupId)?.id === me.id && sess.state !== 'closed' && Number(rawRun?.phase || 0) < 3,
          runnerId: sess.mode === 'team' ? runner?.id || null : me.id,
          runnerRevision: revisionOf(rawRun),
          run
        });
      }

      case 'submit': {
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (sess.state !== 'running') return res.status(409).json({ error: 'session_not_running' });
        if (sess.paused) return res.status(409).json({ error: 'session_paused' });

        const pid = String(b.participantId || '');
        const participants = await store.getParticipants(code);
        const me = participants[pid];
        if (!me) return res.status(403).json({ error: 'not_joined' });
        if (sess.mode === 'team' && !me.groupId) return res.status(409).json({ error: 'team_not_assigned' });
        const wantsSharedDecision = ['strategicView', 'year1', 'year2', 'screen', 'year2Event'].some(k => b[k] !== undefined);
        const rid = runIdFor(sess, me);
        const runs = await store.getRuns(code);
        const previous = runs[rid] || null;
        const current = previous || { runId: rid, phase: 0, done: false, createdAt: Date.now() };
        const isRunner = sess.mode === 'individual' || runnerOf(participants, me.groupId, current)?.id === pid;
        if (sess.mode === 'team' && (wantsSharedDecision || b.done) && !isRunner) {
          return res.status(403).json({ error: 'runner_only', message: 'Only the selected simulation runner can submit or advance the shared run.' });
        }
        if (sess.mode === 'team' && (wantsSharedDecision || (b.done && Number(current.phase || 0) < 3)) &&
            b.runnerRevision !== revisionOf(current)) {
          return res.status(409).json({ error: 'runner_changed', message: 'Runner control changed. Refresh before continuing.' });
        }
        if ((current.done || (sess.mode === 'team' && Number(current.phase || 0) >= 3)) && wantsSharedDecision ||
            (current.done && sess.mode === 'individual')) {
          return res.status(409).json({ error: 'run_already_completed' });
        }

        const next = { ...current };
        if (sess.mode === 'team') {
          next.runnerId = runnerOf(participants, me.groupId, current)?.id || null;
          next.runnerRevision = revisionOf(current);
        }
        if (b.strategicView !== undefined) {
          const proposed = String(b.strategicView || '').slice(0, 500);
          if (current.strategicView && current.strategicView !== proposed) {
            return res.status(409).json({ error: 'strategic_view_locked' });
          }
          next.strategicView = current.strategicView || proposed;
          if (!current.strategicView) next.screen = 4;
        }
        if (b.year1 !== undefined) {
          const v = S.validateAllocation(b.year1, S.sessionThresholds(sess));
          if (!v.ok) return res.status(400).json(v);
          if (current.year1 && !sameAllocation(current.year1, v.allocation)) {
            return res.status(409).json({ error: 'year1_locked' });
          }
          next.year1 = current.year1 || v.allocation;
          if (!current.year1) next.screen = 5;
          next.phase = Math.max(next.phase || 0, 1);
        }
        if (b.year2 !== undefined) {
          if (!next.year1) return res.status(409).json({ error: 'year1_required' });
          const v = S.validateAllocation(b.year2, S.sessionThresholds(sess));
          if (!v.ok) return res.status(400).json(v);
          if (current.year2 && !sameAllocation(current.year2, v.allocation)) {
            return res.status(409).json({ error: 'year2_locked' });
          }
          next.year2 = current.year2 || v.allocation;
          if (!current.year2) next.screen = 7;
          next.phase = Math.max(next.phase || 0, 2);
        }
        if (b.reflection1 !== undefined || b.reflection2 !== undefined) {
          const map = { ...(current.reflections || {}) };
          const mine = map[pid] || {};
          map[pid] = {
            participantId: pid,
            name: me.name,
            reflection1: b.reflection1 !== undefined ? String(b.reflection1 || '').slice(0, 1500) : (mine.reflection1 || ''),
            reflection2: b.reflection2 !== undefined ? String(b.reflection2 || '').slice(0, 1500) : (mine.reflection2 || ''),
            at: Date.now()
          };
          next.reflections = map;
          if (isRunner) {
            next.reflection1 = map[pid].reflection1;
            next.reflection2 = map[pid].reflection2;
          }
        }

        if (b.screen !== undefined) {
          if (!Number.isInteger(b.screen) || b.screen < 0 || b.screen > 10) return res.status(400).json({ error: 'invalid_screen' });
          if (b.screen >= 4 && !next.strategicView && !next.year1) return res.status(409).json({ error: 'strategic_view_required' });
          if (b.screen >= 5 && !next.year1) return res.status(409).json({ error: 'year1_required' });
          if (b.screen >= 7 && !next.year2) return res.status(409).json({ error: 'year2_required' });
          next.screen = b.screen;
        }
        if (b.year2Event !== undefined) {
          if (![0, 1].includes(b.year2Event)) return res.status(400).json({ error: 'invalid_year2_event' });
          if (!next.year2) return res.status(409).json({ error: 'year2_required' });
          next.year2Event = b.year2Event;
        }
        if (next.year1 && next.year2) {
          next.outcomes = S.evaluateAll(next.year1, next.year2, S.sessionThresholds(sess));
        } else if (next.year1) {
          next.outcomes = { year1: S.evaluateYear1(next.year1, S.sessionThresholds(sess)) };
        }
        if (b.done) {
          if (!next.year1 || !next.year2) return res.status(409).json({ error: 'allocations_incomplete' });
          if (sess.mode === 'team') {
            if (!isRunner) return res.status(403).json({ error: 'runner_only', message: 'Only the selected simulation runner can complete the shared team run.' });
            const finishedAt = Date.now();
            const members = Object.values(participants).filter(p => p && p.groupId === rid);
            next.finishedBy = { ...(current.finishedBy || {}) };
            for (const m of members) next.finishedBy[m.id] = finishedAt;
            next.done = true;
            next.completedBy = pid;
            next.completedByName = me.name;
          } else {
            next.done = true;
          }
          next.phase = 3;
          next.screen = 10;
          if (next.done) next.completedAt = Date.now();
        }
        next.updatedAt = Date.now();
        if (sess.mode === 'team') {
          if (!await store.compareAndSetRun(code, rid, previous, next, sess, participants)) continue;
        } else {
          await store.setRun(code, rid, next);
        }
        return res.status(200).json({ ok: true, run: publicRun(next) });
      }

      default:
        return res.status(400).json({ error: 'unknown_action' });
    }
    }
    return res.status(409).json({ error: 'run_changed', message: 'The team state changed. Refresh and try again.' });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: 'course_roster_unavailable', message: e.message });
    if (e.code === 'NO_STORE') return res.status(503).json({ error: 'no_store', message: e.message });
    console.error('session failure', action, e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
