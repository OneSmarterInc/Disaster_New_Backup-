'use strict';
const { randomBytes, randomInt } = require('node:crypto');
const { body, access, faculty, owns, participant } = require('../lib/guard');
const { announce, reportCompletion } = require('../lib/launch');
const { accountJoinUrl } = require('../lib/session-entry');
const { courseEnrolments } = require('../lib/course-enrolments');
const store = require('../lib/store');
const room = require('../lib/room');
const config = require('../data/config');

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codeOf = () => Array.from({ length: 5 }, () => CHARS[randomInt(CHARS.length)]).join('');
const newId = () => randomBytes(16).toString('hex');
const error = (res, status, code, message) => res.status(status).json({ error: code, ...(message ? { message } : {}) });
const validCode = code => /^[A-Z2-9]{5}$/.test(code);
const safe = s => ({ code: s.code, name: s.name, mode: s.mode, groupSize: s.groupSize,
  clockMinutes: s.clockMinutes, state: s.state, stage: s.stage });
const studentResult = (session, id) => ({ session: safe(session), view: room.studentView(session, id, Date.now()) });
const joinUrl = s => s.platformAuth ? accountJoinUrl(s)
  : process.env.SIM_URL ? process.env.SIM_URL.replace(/\/+$/, '') + '/launch.html?session=' + s.code + '&guest=1' : null;

async function reportAll(code) {
  let sent = 0, failed = 0;
  for (let i = 0; i < 100; i++) {
    const current = await store.getSession(code);
    if (!current || current.stage !== 3 || !current.platformAuth || current.practice) break;
    const person = Object.values(current.participants).find(p => p.id.startsWith('platform:') && !p.reportedAt &&
      (!p.reportingAt || Date.now() - p.reportingAt > 30000));
    if (!person) break;
    const claimed = structuredClone(current);
    claimed.participants[person.id].reportingAt = Date.now();
    if (!await store.compareAndSetSession(code, current, claimed)) { i--; continue; }
    const slot = room.slotFor(claimed, person.id);
    const summary = slot?.commit
      ? `${slot.label} reported ${slot.commit.number.toFixed(1)}% with confidence ${slot.commit.confidence}/5.`
      : `${slot?.label || 'Participant'}: No number reported.`;
    const ok = await reportCompletion({ participantId: person.id, courseId: claimed.courseId,
      summary, metrics: { reported: !!slot?.commit, confidence: slot?.commit?.confidence || null } });
    for (let retry = 0; retry < 5; retry++) {
      const latest = await store.getSession(code);
      if (!latest || latest.participants[person.id]?.reportingAt !== claimed.participants[person.id].reportingAt) break;
      const updated = structuredClone(latest);
      updated.participants[person.id].reportingAt = null;
      if (ok) updated.participants[person.id].reportedAt = Date.now();
      if (await store.compareAndSetSession(code, latest, updated)) break;
    }
    if (ok) sent++; else failed++;
    // A failed platform call is retried by an explicit instructor action, not
    // immediately in the same request.
    if (!ok) break;
  }
  return { sent, failed };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  if (req.method !== 'POST') return error(res, 405, 'post_only');
  if (!store.configured()) return error(res, 503, 'no_store', 'Session storage is not configured.');
  const b = body(req), action = String(b.action || ''), code = String(b.code || '').trim().toUpperCase();
  try {
    if (action === 'faculty_access') {
      return faculty(req, b) ? res.status(200).json({ ok: true })
        : error(res, 401, 'faculty_authorization_required');
    }
    if (action === 'course_sessions') {
      const who = access(req, b);
      if (!who?.platform || who.role !== 'student' || !who.courseId) {
        return error(res, 403, 'student_course_required', 'Open Sim04 from a course where you have access.');
      }
      return res.status(200).json({ sessions: await store.courseSessions(who.courseId) });
    }
    // A faculty member previewing as a student gets a private practice room of
    // their own: they own it, they are its only participant, it is never listed
    // for a course and it never reports completion.
    if (action === 'practice') {
      const who = faculty(req, b);
      if (!who) return error(res, 401, 'faculty_authorization_required');
      const pid = who.platform ? who.id : 'practice:' + newId();
      for (let attempt = 0; attempt < 10; attempt++) {
        const c = codeOf();
        let session = room.createSession({ code: c, owner: who.name || 'Instructor', ownerKey: who.key || null,
          mode: 'team', groupSize: 1, name: 'Practice room', now: Date.now() });
        Object.assign(session, { platformAuth: !!who.platform, ownerId: who.platform ? who.id : null,
          courseId: who.courseId || null, practice: true });
        session = room.join(session, pid, who.email || 'instructor@practice.room', Date.now());
        session = room.move(session, pid, 'new');
        if (!await store.createSession(c, session)) continue;
        return res.status(200).json({ participantId: pid, ...studentResult(session, pid) });
      }
      return error(res, 503, 'code_unavailable');
    }
    if (action === 'create') {
      const who = faculty(req, b);
      if (!who) return error(res, 401, 'faculty_authorization_required');
      const mode = String(b.mode || '');
      const minutes = b.clockMinutes === undefined ? undefined : Number(b.clockMinutes);
      for (let attempt = 0; attempt < 10; attempt++) {
        const c = codeOf();
        let session;
        try { session = room.createSession({ code: c, owner: who.name || 'Facilitator', ownerKey: who.key || null, mode,
          groupSize: b.groupSize === undefined ? undefined : Number(b.groupSize),
          clockMinutes: minutes, name: b.name, now: Date.now() }); }
        catch (e) { return error(res, 400, 'invalid_session', e.message); }
        session.platformAuth = !!who.platform;
        session.ownerId = who.platform ? who.id : null;
        session.courseId = who.courseId || null;
        if (!await store.createSession(c, session)) continue;
        await announce();
        return res.status(200).json({ session: safe(session), joinUrl: joinUrl(session) });
      }
      return error(res, 503, 'code_unavailable');
    }
    if (!validCode(code)) return error(res, 400, 'invalid_session_code');
    for (let attempt = 0; attempt < 8; attempt++) {
      const session = await store.getSession(code);
      if (!session) return error(res, 404, 'no_such_session');
      const isFaculty = ['faculty_state', 'faculty_enrolments', 'divide', 'move', 'rename', 'start', 'advance', 'private_check', 'report'].includes(action);
      let who;
      if (isFaculty) {
        who = faculty(req, b);
        if (!who) return error(res, 401, 'faculty_authorization_required');
        if (!owns(who, session)) return error(res, 403, 'not_your_session');
      }
      if (action === 'faculty_state') {
        return res.status(200).json({ session: safe(session), joinUrl: joinUrl(session),
          warningMinutes: require('../data/config').warningMinutes,
          projector: room.projector(session, Date.now()) });
      }
      if (action === 'faculty_enrolments') {
        const result = await courseEnrolments(req, b, session);
        return res.status(200).json(result);
      }
      if (action === 'private_check') return res.status(200).json({ checks: room.privateCheck(session) });
      if (action === 'report') {
        if (session.stage !== 3) return error(res, 409, 'not_complete');
        return res.status(200).json({ ok: true, completion: await reportAll(code) });
      }
      let next;
      if (['divide', 'move', 'rename'].includes(action)) {
        try {
          next = action === 'divide' ? room.divide(session, b.groupSize === undefined ? undefined : Number(b.groupSize))
            : action === 'move' ? room.move(session, String(b.participantId || ''), String(b.target || ''))
            : room.rename(session, String(b.slotId || ''), b.label);
        } catch (e) { return error(res, 409, 'groups_rejected', e.message); }
      } else if (action === 'start') {
        try { next = room.start(session, Date.now()); }
        catch (e) { return error(res, 409, 'start_rejected', e.message); }
      } else if (action === 'advance') {
        try { next = room.advance(session, Date.now()); }
        catch (e) { return error(res, 409, 'reveal_not_ready', e.message); }
      } else if (['join', 'state', 'commit'].includes(action)) {
        const me = participant(req, b, session);
        if (!me) return error(res, 401, 'participant_authorization_required');
        if (action === 'join') {
          const id = me.platform ? me.id : (me.id || newId());
          try { next = room.join(session, id, me.platform ? (me.email || b.email) : b.email, Date.now()); }
          catch (e) { return error(res, 409, 'join_rejected', e.message); }
          if (!await store.compareAndSetSession(code, session, next)) continue;
          return res.status(200).json({ participantId: id, ...studentResult(next, id) });
        }
        if (!me.id || !session.participants[me.id]) return error(res, 403, 'not_joined');
        if (action === 'state') return res.status(200).json(studentResult(session, me.id));
        try { next = room.commit(session, me.id, b.number, b.confidence, Date.now()); }
        catch (e) { return error(res, 409, 'commit_rejected', e.message); }
        if (!await store.compareAndSetSession(code, session, next)) continue;
        return res.status(200).json({ ok: true, ...studentResult(next, me.id) });
      } else return error(res, 400, 'unknown_action');
      if (!await store.compareAndSetSession(code, session, next)) continue;
      if (action === 'advance' && next.stage === 3) {
        const completion = await reportAll(code);
        return res.status(200).json({ session: safe(next), completion });
      }
      return res.status(200).json({ session: safe(next) });
    }
    return error(res, 409, 'busy_retry', 'The session changed while saving. Try again.');
  } catch (e) {
    console.error('Sim 04 session error:', action, e.message);
    return error(res, e.status || 503, 'session_unavailable', 'Please try again.');
  }
};
