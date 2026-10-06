const { body, checkAccess } = require('../lib/guard.js');
const { randomBytes } = require('node:crypto');
const { syncCourseRoster, approvedIds } = require('../lib/session-roster.js');
const store = require('../lib/store.js');
const { verifyLaunch } = require('../lib/launch.js');
const S = require('../lib/scenario.js');
const R = require('../lib/room.js');
const { accountJoinUrl, participantLaunch, participantError } = require('../lib/session-entry.js');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const newId = () => randomBytes(16).toString('hex');

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
  // Fail closed: an empty standalone faculty roster is not authorization.
  const roster = facultyRoster();
  if (!roster.length) return null;
  const given = String((b && b.facultyCode) || req.headers['x-faculty-code'] || '').trim();
  if (!given) return null;
  const hit = roster.find(r => r.code === given);
  return hit ? { name: hit.name } : null;
}

function ownsSession(who, sess) {
  if (!who || sess.solo) return false;
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
  return { code: sess.code, name: sess.name, mode: sess.mode, state: sess.state, paused: !!sess.paused, solo: !!sess.solo };
}

async function ownedSession(req, res, b, code) {
  const who = whoIsFaculty(req, b);
  if (!who) { res.status(401).json({ error: 'faculty_authorization_required' }); return null; }
  const sess = await store.getSession(code);
  if (!sess) { res.status(404).json({ error: 'no_such_session' }); return null; }
  if (!ownsSession(who, sess)) { res.status(403).json({ error: 'not_your_session' }); return null; }
  return { who, sess };
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  if (!store.configured()) {
    return res.status(503).json({ error: 'no_store', message: 'Session storage is not configured for this deployment.' });
  }

  const b = body(req);
  const action = String(b.action || '');
  const code = String(b.code || '').toUpperCase().trim();
  const now = Date.now();

  try {
    if (['join', 'state', 'vote', 'ready', 'solo_start', 'skip', 'rename_team'].includes(action)) {
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
          if (!R.MODES.includes(mode)) return res.status(400).json({ error: 'play_mode_required' });
          const intensity = String(b.intensity || 'standard');
          if (!R.INTENSITIES.includes(intensity)) return res.status(400).json({ error: 'invalid_intensity' });
          const c = newCode();
          const sess = {
            code: c, owner: who.name, ownerId: who.userId || null,
            platformAuth: !!who.platformAuth, courseId: who.courseId || null,
            name: String(b.name || S.META.title).slice(0, 80),
            mode, intensity, state: 'lobby', paused: false, createdAt: now
          };
          await store.putSession(c, sess);
          return res.status(200).json({ session: sess, you: who.name, joinUrl: sess.platformAuth ? accountJoinUrl(sess) : null });
        }

        case 'faculty_state': {
          const o = await ownedSession(req, res, b, code); if (!o) return;
          const participants = await store.getParticipants(code);
          const roster = Object.values(participants).filter(Boolean)
            .map(p => ({ id: p.id, name: p.name, groupId: p.groupId || null, teamLabel: p.teamLabel || '', joined: !!p.joinedAt, ready: !!p.ready, late: o.sess.mode === 'individual' && R.isLate(o.sess, p) }));
          return res.status(200).json({
            session: { ...o.sess, joinUrl: o.sess.platformAuth ? accountJoinUrl(o.sess) : null },
            roster,
            projector: R.projectorView(o.sess, participants, now),
            you: o.who.name
          });
        }

        case 'faculty_enrolments': {
          const o = await ownedSession(req, res, b, code); if (!o) return;
          try {
            const roster = await syncCourseRoster(req, b, o.sess);
            return res.status(200).json({ ...roster, participants: await store.getParticipants(code) });
          } catch (error) {
            return res.status(error.status || 503).json({ error: 'course_roster_unavailable', message: error.message || 'Course enrolment could not be refreshed.' });
          }
        }

        case 'group': {
          const o = await ownedSession(req, res, b, code); if (!o) return;
          const sess = o.sess;
          if (sess.mode !== 'team') return res.status(409).json({ error: 'not_team_mode' });
          if (sess.state !== 'lobby') return res.status(409).json({ error: 'teams_locked', message: 'Teams are fixed once the session starts.' });
          const roster = sess.platformAuth && sess.courseId ? await syncCourseRoster(req, b, sess) : null;
          const allowed = approvedIds(roster);
          const participants = await store.getParticipants(code);
          const previous = structuredClone(participants);
          const assign = b.assign && typeof b.assign === 'object' ? b.assign : {};
          for (const [id, label] of Object.entries(assign)) {
            const p = participants[id];
            if (!p) return res.status(404).json({ error: 'no_such_participant' });
            const clean = String(label || '').trim().slice(0, 40);
            if (!clean || clean === '__unassigned__') { p.groupId = null; p.teamLabel = ''; continue; }
            if (allowed && !allowed.has(id)) return res.status(403).json({ error: 'student_not_approved' });
            const norm = clean.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
            if (!norm) return res.status(400).json({ error: 'team_name_required' });
            p.groupId = `team:${norm}`; p.teamLabel = clean;
          }
          if (!await store.compareAndSetRoster(code, previous, participants, sess)) continue;
          return res.status(200).json({ ok: true });
        }

        case 'control': {
          const o = await ownedSession(req, res, b, code); if (!o) return;
          const sess = o.sess;
          const set = String(b.set || '');
          let next;
          if (set === 'start') {
            if (sess.state !== 'lobby') return res.status(409).json({ error: 'session_already_started' });
            next = { ...sess, state: 'running', startedAt: now, paused: false, pausedTotalMs: 0 };
            if (sess.mode === 'team') {
              const participants = await store.getParticipants(code);
              const present = R.joined(participants);
              const unassigned = present.filter(p => !p.groupId);
              if (!present.length) return res.status(409).json({ error: 'participants_required', message: 'Assign at least one student to a team before starting.' });
              if (unassigned.length) {
                return res.status(409).json({ error: 'unassigned_participants', count: unassigned.length,
                  message: `${unassigned.length} student${unassigned.length === 1 ? ' is' : 's are'} still unassigned. Assign every student to a team before starting.` });
              }
              next.teams = R.freezeTeams(participants);
            }
          } else if (set === 'advance') {
            const r = R.skipSegment(sess, now);
            if (r.error) return res.status(r.status).json({ error: r.error });
            next = r.next;
          } else {
            const r = R.applyControl(sess, set, now);
            if (r.error) return res.status(r.status).json({ error: r.error });
            next = r.next;
          }
          if (!await store.compareAndSetSession(code, sess, next)) continue;
          return res.status(200).json({ session: next });
        }

        // A direct launch with no facilitated session: one private room, its own clock.
        case 'solo': {
          if (!checkAccess(req, res)) return;
          const launch = req.launch || null;
          if (launch && !participantLaunch(req, b)) return res.status(401).json({ error: 'launch_token_invalid' });
          if (launch && launch.mode === 'session') return res.status(409).json({ error: 'use_session' });
          const c = newCode();
          const id = launch ? `platform:${launch.sub}` : newId();
          const sess = {
            code: c, solo: true, owner: id, ownerId: launch ? launch.sub : null,
            platformAuth: !!launch, courseId: launch ? launch.course || null : null,
            name: S.META.title, mode: 'individual', intensity: 'standard',
            state: 'lobby', paused: false, pausedTotalMs: 0, skipMs: 0, createdAt: now
          };
          await store.putSession(c, sess);
          const me = { id, name: String(launch ? launch.name || 'Participant' : b.name || 'Participant').slice(0, 60), groupId: `individual:${id}`, joinedAt: now, votes: {} };
          await store.addParticipant(c, id, me);
          return res.status(200).json({ code: c, participantId: id, session: publicSession(sess) });
        }

        case 'join': {
          const sess = await store.getSession(code);
          if (!sess) return res.status(404).json({ error: 'no_such_session' });
          if (sess.state === 'closed') return res.status(410).json({ error: 'session_closed' });
          if (sess.solo) return res.status(403).json({ error: 'private_session' });
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
          const existing = all[id];
          if (!existing && sess.mode === 'team' && sess.state !== 'lobby') {
            return res.status(409).json({ error: 'teams_locked', message: 'This team session has started. Ask your instructor to add you to the next one.' });
          }
          const participant = {
            ...existing, id, name,
            groupId: sess.mode === 'individual' ? `individual:${id}` : existing ? existing.groupId : null,
            teamLabel: sess.mode === 'individual' ? '' : existing ? existing.teamLabel || '' : '',
            joinedAt: existing?.joinedAt || now,
            lateFrom: existing?.joinedAt ? existing.lateFrom || 0 : R.clock(sess, now).closedRounds,
            votes: existing?.votes || {}
          };
          if (!await store.compareAndSetParticipant(code, id, existing, participant, sess)) continue;
          return res.status(200).json({ participantId: id, session: publicSession(sess) });
        }

        case 'state': {
          const sess = await store.getSession(code);
          if (!sess) return res.status(404).json({ error: 'no_such_session' });
          const pid = String(b.participantId || '');
          const participants = await store.getParticipants(code);
          if (!participants[pid]) return res.status(403).json({ error: 'not_joined' });
          return res.status(200).json({ session: publicSession(sess), view: R.studentView(sess, participants, pid, now) });
        }

        case 'vote': {
          const sess = await store.getSession(code);
          if (!sess) return res.status(404).json({ error: 'no_such_session' });
          const pid = String(b.participantId || '');
          const participants = await store.getParticipants(code);
          const me = participants[pid];
          if (!me) return res.status(403).json({ error: 'not_joined' });
          const r = R.applyVote(sess, me, b.round, String(b.decision || ''), now);
          if (r.error) return res.status(r.status).json({ error: r.error });
          if (!await store.compareAndSetParticipant(code, pid, me, r.next, sess)) continue;
          participants[pid] = r.next;
          let current = sess;
          if (R.allDecided(sess, participants, now)) {
            const k = R.skipSegment(sess, now);
            if (k.next && await store.compareAndSetSession(code, sess, k.next)) current = k.next;
          }
          return res.status(200).json({ ok: true, view: R.studentView(current, participants, pid, now) });
        }

        // Students rename their own team, in the lobby only.
        case 'rename_team': {
          const sess = await store.getSession(code);
          if (!sess) return res.status(404).json({ error: 'no_such_session' });
          if (sess.mode !== 'team') return res.status(409).json({ error: 'not_team_mode' });
          if (sess.state !== 'lobby') return res.status(409).json({ error: 'teams_locked' });
          const pid = String(b.participantId || '');
          const participants = await store.getParticipants(code);
          const me = participants[pid];
          if (!me || !me.joinedAt) return res.status(403).json({ error: 'not_joined' });
          if (!me.groupId) return res.status(409).json({ error: 'team_not_assigned' });
          const label = String(b.label || '').replace(/\s+/g, ' ').trim().slice(0, 30);
          if (!label) return res.status(400).json({ error: 'team_name_required' });
          const next = { ...sess, teamLabels: { ...(sess.teamLabels || {}), [me.groupId]: label } };
          if (!await store.compareAndSetSession(code, sess, next)) continue;
          return res.status(200).json({ ok: true, view: R.studentView(next, participants, pid, now) });
        }

        case 'team_label': {
          const o = await ownedSession(req, res, b, code); if (!o) return;
          const gid = String(b.groupId || '');
          if (!gid.startsWith('team:')) return res.status(400).json({ error: 'invalid_team' });
          const labels = { ...(o.sess.teamLabels || {}) };
          const label = String(b.label || '').replace(/\s+/g, ' ').trim().slice(0, 30);
          if (label) labels[gid] = label; else delete labels[gid];
          if (!await store.compareAndSetSession(code, o.sess, { ...o.sess, teamLabels: labels })) continue;
          return res.status(200).json({ ok: true });
        }

        case 'team_view': {
          const o = await ownedSession(req, res, b, code); if (!o) return;
          if (o.sess.mode !== 'team') return res.status(409).json({ error: 'not_team_mode' });
          const participants = await store.getParticipants(code);
          const view = R.teamView(o.sess, participants, String(b.groupId || ''), now);
          if (!view) return res.status(404).json({ error: 'no_such_team' });
          return res.status(200).json({ view });
        }

        case 'preview': {
          const o = await ownedSession(req, res, b, code); if (!o) return;
          return res.status(200).json(R.preview(o.sess, now));
        }

        case 'ready': {
          const sess = await store.getSession(code);
          if (!sess) return res.status(404).json({ error: 'no_such_session' });
          const pid = String(b.participantId || '');
          const participants = await store.getParticipants(code);
          const me = participants[pid];
          if (!me) return res.status(403).json({ error: 'not_joined' });
          if (me.ready) return res.status(200).json({ ok: true, view: R.studentView(sess, participants, pid, now) });
          const next = { ...me, ready: true };
          if (!await store.compareAndSetParticipant(code, pid, me, next, sess)) continue;
          participants[pid] = next;
          return res.status(200).json({ ok: true, view: R.studentView(sess, participants, pid, now) });
        }

        // Solo only: the student starts their own clock, and may skip time they
        // have no use for. Nobody can skip a decision they have not made.
        case 'solo_start':
        case 'skip': {
          const sess = await store.getSession(code);
          if (!sess) return res.status(404).json({ error: 'no_such_session' });
          const pid = String(b.participantId || '');
          if (!sess.solo || sess.owner !== pid) return res.status(403).json({ error: 'solo_only' });
          const participants = await store.getParticipants(code);
          const me = participants[pid];
          if (!me) return res.status(403).json({ error: 'not_joined' });
          let next;
          if (action === 'solo_start') {
            if (sess.state !== 'lobby') return res.status(409).json({ error: 'session_already_started' });
            next = { ...sess, state: 'running', startedAt: now, pausedTotalMs: 0, skipMs: 0 };
          } else {
            const clk = R.clock(sess, now);
            if (clk.phase === 'decide' && !(me.votes || {})[clk.round]) return res.status(409).json({ error: 'decide_first' });
            const k = R.skipSegment(sess, now);
            if (k.error) return res.status(k.status).json({ error: k.error });
            next = k.next;
          }
          if (!await store.compareAndSetSession(code, sess, next)) continue;
          return res.status(200).json({ ok: true, session: publicSession(next), view: R.studentView(next, participants, pid, now) });
        }

        default:
          return res.status(400).json({ error: 'unknown_action' });
      }
    }
    return res.status(409).json({ error: 'busy_retry', message: 'The session changed while saving. Please try again.' });
  } catch (e) {
    console.error('session error', action, e.message);
    return res.status(e.status || 500).json({ error: 'session_error', message: e.status ? e.message : 'Something went wrong. Please try again.' });
  }
};
