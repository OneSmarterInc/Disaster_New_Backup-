const { body } = require('../lib/guard.js');
const store = require('../lib/store.js');
const { verifyLaunch } = require('../lib/launch.js');
const { META, SETTINGS } = require('../data/config.js');
const E = require('../lib/engine.js');
const { accountJoinUrl, participantLaunch, participantError } = require('../lib/session-entry.js');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const newId = () => require('crypto').randomBytes(16).toString('hex');
const now = () => Date.now();

function facultyRoster() {
  const out = [];
  String(process.env.FACULTY_CODES || '').split(',').map(s => s.trim()).filter(Boolean).forEach(entry => {
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
    if (p && p.sim === META.id && (p.role === 'faculty' || p.role === 'faculty_preview')) {
      return { name: p.name || 'Facilitator', userId: p.sub || null, platformAuth: true, courseId: p.course || null };
    }
  }
  // Fail closed: an empty roster is not authorization.
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
  return { code: sess.code, name: sess.name, mode: sess.mode, state: sess.state, startedAt: sess.startedAt || null };
}

function clampSettings(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const n = (v, lo, hi, d) => { const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.round(x))) : d; };
  return {
    decisionMinutes: n(r.decisionMinutes, 3, 30, SETTINGS.decisionMinutes),
    justificationMinWords: n(r.justificationMinWords, 3, 40, SETTINGS.justificationMinWords),
    autoAdvanceSeconds: n(r.autoAdvanceSeconds, 30, 300, SETTINGS.autoAdvanceSeconds)
  };
}

// Student-facing state. Reveal content is included only once this participant
// has a recorded position and has answered the recognition question.
function studentView(sess, participants, me, lastBeat, t) {
  const phase = E.phaseOf(sess, t);
  const out = {
    session: publicSession(sess), phase, now: t, closesAt: E.closedAt(sess),
    decisionMinutes: E.settingsOf(sess).decisionMinutes,
    acceptsDecision: E.acceptsDecision(sess, t),
    me: { name: me.name, team: me.teamLabel || '', choice: me.choice || null, lapsed: !!me.lapsed,
      justification: me.justification || '', recognised: me.recognised || null },
    needsLapseLine: !me.choice && sess.state !== 'lobby' && !E.acceptsDecision(sess, t),
    stage: 0, stages: []
  };
  const ready = !!me.choice && !!me.recognised;
  if (sess.mode === 'team' && me.groupId && ready) {
    const t2 = E.teamOutcomes(participants, sess, t).find(x => x.groupId === me.groupId);
    if (t2 && t2.outcome) out.team = { label: t2.label, outcome: t2.outcome, tie: t2.tie, buy: t2.buy, decline: t2.decline };
  }
  if (ready) {
    out.stage = E.effectiveStage(sess, lastBeat, t);
    out.stages = E.stageContent(out.stage);
  }
  return out;
}

async function persistAutoStage(code, sess) {
  const lastBeat = await store.lastBeat(code);
  const eff = E.effectiveStage(sess, lastBeat, now());
  if (eff <= (Number(sess.stage) || 0)) return 'ok';
  return await store.compareAndSetSession(code, sess, { ...sess, stage: eff }) ? 'ok' : 'retry';
}

async function facultySession(req, res, b, code) {
  const who = whoIsFaculty(req, b);
  if (!who) { res.status(401).json({ error: 'faculty_authorization_required' }); return null; }
  const sess = await store.getSession(code);
  if (!sess) { res.status(404).json({ error: 'no_such_session' }); return null; }
  if (!ownsSession(who, sess)) { res.status(403).json({ error: 'not_your_session', message: `That session belongs to ${sess.owner}.` }); return null; }
  return { who, sess };
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!store.configured()) return res.status(503).json({ error: 'no_store', message: 'Session storage is not configured for this deployment.' });

  const b = body(req);
  const action = String(b.action || '');
  const code = String(b.code || '').toUpperCase().trim();

  try {
    if (['join', 'state', 'decide', 'lapse', 'recognise'].includes(action)) {
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
          // Mode is a required choice with no default.
          if (!['individual', 'team'].includes(mode)) return res.status(400).json({ error: 'play_mode_required' });
          const c = newCode();
          const sess = {
            code: c, owner: who.name, ownerId: who.userId || null, platformAuth: !!who.platformAuth,
            courseId: who.courseId || null, name: String(b.name || META.title).slice(0, 80),
            mode, state: 'lobby', settings: clampSettings(b.settings), stage: 0, pinned: [],
            showPrompts: false, teamSize: 4, createdAt: now()
          };
          await store.putSession(c, sess);
          return res.status(200).json({ session: sess, you: who.name });
        }

        case 'faculty_state': {
          const f = await facultySession(req, res, b, code); if (!f) return;
          // Persist any stage the fallback released while the console was away,
          // before this poll marks the console present again.
          if (await persistAutoStage(code, f.sess) === 'retry') continue;
          const sess = await store.getSession(code);
          await store.beat(code);
          const [participants, lastBeat] = await Promise.all([store.getParticipants(code), store.lastBeat(code)]);
          const t = now();
          f.sess = sess;
          return res.status(200).json({
            session: { ...f.sess, joinUrl: f.sess.platformAuth ? accountJoinUrl(f.sess) : null },
            phase: E.phaseOf(f.sess, t), now: t, closesAt: E.closedAt(f.sess),
            stage: E.effectiveStage(f.sess, lastBeat, t),
            responses: E.responseList(f.sess, participants, t),
            teams: f.sess.mode === 'team' ? E.teamOutcomes(participants, f.sess, t) : null,
            projector: E.projectorView(f.sess, participants, lastBeat, t),
            you: f.who.name
          });
        }

        case 'projector': {
          const f = await facultySession(req, res, b, code); if (!f) return;
          if (await persistAutoStage(code, f.sess) === 'retry') continue;
          const sess = await store.getSession(code);
          await store.beat(code);
          const [participants, lastBeat] = await Promise.all([store.getParticipants(code), store.lastBeat(code)]);
          return res.status(200).json(E.projectorView(sess, participants, lastBeat, now()));
        }

        case 'control': {
          const f = await facultySession(req, res, b, code); if (!f) return;
          const sess = f.sess, prev = structuredClone(sess), t = now();
          const set = String(b.set || '');
          if (set === 'start') {
            if (sess.state !== 'lobby') return res.status(409).json({ error: 'session_already_started' });
            if (sess.mode === 'team') {
              const people = await store.getParticipants(code);
              if (Object.values(people).some(p => p && !p.groupId)) {
                return res.status(409).json({ error: 'unassigned_participants', message: 'Split or assign every student into a team before starting.' });
              }
            }
            sess.state = 'running'; sess.startedAt = t;
          } else if (set === 'end_decisions') {
            if (sess.state !== 'running' || !E.decisionsOpen(sess, t)) return res.status(409).json({ error: 'decisions_not_open' });
            sess.closedEarlyAt = t;
          } else if (set === 'release') {
            const n = Number(b.stage);
            if (![1, 2, 3].includes(n)) return res.status(400).json({ error: 'invalid_stage' });
            if (E.phaseOf(sess, t) !== 'decided') return res.status(409).json({ error: 'decisions_still_open' });
            const lastBeat = await store.lastBeat(code);
            const current = E.effectiveStage(sess, lastBeat, t);
            if (n !== current + 1 && n !== current) return res.status(409).json({ error: 'stage_out_of_order' });
            sess.stage = Math.max(current, n);
          } else if (set === 'prompts') {
            sess.showPrompts = !!b.on;
          } else if (set === 'close') {
            sess.state = 'closed';
          } else if (set === 'settings') {
            if (sess.state !== 'lobby') return res.status(409).json({ error: 'session_already_started' });
            sess.settings = clampSettings({ ...sess.settings, ...(b.settings || {}) });
          } else return res.status(400).json({ error: 'unknown_control' });
          if (!await store.compareAndSetSession(code, prev, sess)) continue;
          return res.status(200).json({ session: sess });
        }

        case 'pin': {
          const f = await facultySession(req, res, b, code); if (!f) return;
          const sess = f.sess, prev = structuredClone(sess);
          const people = await store.getParticipants(code);
          const ids = Array.isArray(b.ids) ? b.ids.map(String).slice(0, 2) : [];
          if (ids.some(id => !people[id])) return res.status(404).json({ error: 'no_such_response' });
          sess.pinned = ids;
          if (!await store.compareAndSetSession(code, prev, sess)) continue;
          return res.status(200).json({ pinned: ids });
        }

        case 'suggest_pair': {
          const f = await facultySession(req, res, b, code); if (!f) return;
          const people = await store.getParticipants(code);
          const pair = E.suggestPair(E.responseList(f.sess, people, now()));
          return res.status(200).json({ pair });
        }

        case 'teams': {
          const f = await facultySession(req, res, b, code); if (!f) return;
          if (f.sess.mode !== 'team') return res.status(409).json({ error: 'not_team_mode' });
          if (f.sess.state !== 'lobby') return res.status(409).json({ error: 'session_already_started' });
          const people = await store.getParticipants(code);
          const prev = structuredClone(people);
          const plan = E.autoTeams(people, b.size);
          for (const [id, g] of Object.entries(plan)) Object.assign(people[id], g);
          if (!await store.compareAndSetRoster(code, prev, people, f.sess)) continue;
          return res.status(200).json({ ok: true });
        }

        case 'assign': {
          const f = await facultySession(req, res, b, code); if (!f) return;
          if (f.sess.mode !== 'team') return res.status(409).json({ error: 'not_team_mode' });
          if (f.sess.state === 'closed') return res.status(409).json({ error: 'session_closed' });
          const people = await store.getParticipants(code);
          const pid = String(b.participantId || '');
          const n = Number(b.team);
          if (!people[pid]) return res.status(404).json({ error: 'no_such_participant' });
          if (!Number.isInteger(n) || n < 1 || n > 60) return res.status(400).json({ error: 'invalid_team' });
          const prev = structuredClone(people[pid]);
          const next = { ...prev, groupId: `team:${n}`, teamLabel: `Team ${n}` };
          if (!await store.compareAndSetParticipant(code, pid, prev, next, f.sess)) continue;
          return res.status(200).json({ ok: true });
        }

        case 'join': {
          const sess = await store.getSession(code);
          if (!sess) return res.status(404).json({ error: 'no_such_session' });
          if (sess.state === 'closed') return res.status(410).json({ error: 'session_closed' });
          const launched = participantLaunch(req, b);
          if ((req.headers['x-launch-token'] || b.launchToken) && !launched) return res.status(401).json({ error: 'launch_token_invalid' });
          if (launched && sess.courseId && launched.course !== sess.courseId) return res.status(403).json({ error: 'session_course_mismatch' });
          const name = String(launched ? launched.name || '' : b.name || '').slice(0, 60).trim();
          if (!name) return res.status(400).json({ error: 'name_required' });
          const all = await store.getParticipants(code);
          const key = x => String(x || '').trim().toLowerCase();
          let id = launched ? `platform:${launched.sub}` : String(b.participantId || '').trim();
          if (!launched && (!id || !all[id])) {
            const match = Object.values(all).find(p => p && !p.id.startsWith('platform:') && key(p.name) === key(name));
            id = match ? match.id : (id || newId());
          }
          if (!launched && id.startsWith('platform:')) return res.status(401).json({ error: 'platform_signin_required' });
          const existing = all[id] || null;
          let group = existing ? { groupId: existing.groupId, teamLabel: existing.teamLabel } : { groupId: null, teamLabel: '' };
          if (sess.mode === 'individual') group = { groupId: `individual:${id}`, teamLabel: '' };
          // Late arrivals to a running team session join the smallest team.
          else if (!existing && sess.state === 'running') group = E.smallestTeam(all);
          const participant = { ...(existing || {}), id, name, ...group, joinedAt: existing?.joinedAt || now() };
          if (!await store.compareAndSetParticipant(code, id, existing, participant, sess)) continue;
          return res.status(200).json({ participantId: id, session: publicSession(sess) });
        }

        case 'state': {
          const sess = await store.getSession(code);
          if (!sess) return res.status(404).json({ error: 'no_such_session' });
          const pid = String(b.participantId || '');
          const [participants, lastBeat] = await Promise.all([store.getParticipants(code), store.lastBeat(code)]);
          const me = participants[pid];
          if (!me) return res.status(403).json({ error: 'not_joined' });
          return res.status(200).json(studentView(sess, participants, me, lastBeat, now()));
        }

        case 'decide':
        case 'lapse':
        case 'recognise': {
          const sess = await store.getSession(code);
          if (!sess) return res.status(404).json({ error: 'no_such_session' });
          if (sess.state === 'lobby') return res.status(409).json({ error: 'session_not_running' });
          if (sess.state === 'closed') return res.status(409).json({ error: 'session_closed' });
          const pid = String(b.participantId || '');
          const participants = await store.getParticipants(code);
          const me = participants[pid];
          if (!me) return res.status(403).json({ error: 'not_joined' });
          if (sess.mode === 'team' && !me.groupId) return res.status(409).json({ error: 'team_not_assigned' });
          const t = now(), s = E.settingsOf(sess), next = { ...me };
          if (action === 'decide') {
            if (me.choice) return res.status(409).json({ error: 'decision_locked' });
            if (!E.acceptsDecision(sess, t)) return res.status(409).json({ error: 'offer_lapsed' });
            const choice = String(b.choice || '');
            if (!['buy', 'decline'].includes(choice)) return res.status(400).json({ error: 'choice_required' });
            const text = String(b.justification || '').trim().slice(0, 1200);
            if (E.words(text) < s.justificationMinWords) return res.status(400).json({ error: 'justification_too_short', min: s.justificationMinWords });
            Object.assign(next, { choice, lapsed: false, justification: text, decidedAt: t });
          } else if (action === 'lapse') {
            if (me.choice) return res.status(409).json({ error: 'decision_locked' });
            if (E.acceptsDecision(sess, t)) return res.status(409).json({ error: 'decisions_still_open' });
            const text = String(b.justification || '').trim().slice(0, 600);
            if (E.words(text) < s.lapseMinWords) return res.status(400).json({ error: 'lapse_line_too_short', min: s.lapseMinWords });
            Object.assign(next, { choice: 'decline', lapsed: true, justification: text, decidedAt: t });
          } else {
            if (!me.choice) return res.status(409).json({ error: 'decision_required' });
            if (me.recognised) return res.status(409).json({ error: 'recognition_locked' });
            const answer = String(b.answer || '');
            if (!['yes', 'no', 'unsure'].includes(answer)) return res.status(400).json({ error: 'answer_required' });
            next.recognised = answer;
          }
          if (!await store.compareAndSetParticipant(code, pid, me, next, sess)) continue;
          const lastBeat = await store.lastBeat(code);
          const fresh = await store.getParticipants(code);
          return res.status(200).json(studentView(sess, fresh, next, lastBeat, now()));
        }

        default:
          return res.status(400).json({ error: 'unknown_action' });
      }
    }
    return res.status(409).json({ error: 'busy_retry', message: 'The session changed while saving. Please try again.' });
  } catch (e) {
    console.error('session error', action, e.message);
    return res.status(e.code === 'NO_STORE' ? 503 : 500).json({ error: 'session_error' });
  }
};

module.exports.studentView = studentView;
