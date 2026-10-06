'use strict';
const { body, announceOnce, checkAccess } = require('../lib/guard.js');
const { randomBytes } = require('node:crypto');
const store = require('../lib/store.js');
const { verifyLaunch, reportCompletion } = require('../lib/launch.js');
const { META } = require('../lib/meta.js');
const cfg = require('../data/config.js');
const E = require('../lib/engine.js');
const { accountJoinUrl, participantLaunch, participantError } = require('../lib/session-entry.js');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const newId = () => randomBytes(16).toString('hex');
const now = () => (typeof module.exports._now === 'function' ? module.exports._now() : Date.now());

function facultyRoster() {
  const out = [];
  String(process.env.FACULTY_CODES || '').split(',').map(s => s.trim()).filter(Boolean).forEach(entry => {
    const i = entry.lastIndexOf(':');
    if (i > 0) out.push({ name: entry.slice(0, i).trim(), code: entry.slice(i + 1).trim() });
  });
  if (process.env.FACULTY_CODE) out.push({ name: 'Facilitator', code: process.env.FACULTY_CODE });
  return out;
}

// Signed faculty launch first; otherwise an explicitly configured facilitator code. Fails closed.
function whoIsFaculty(req, b) {
  const lt = req.headers['x-launch-token'] || b.launchToken;
  if (lt) {
    const p = verifyLaunch(String(lt));
    if (p && p.sim === META.id && (p.role === 'faculty' || p.role === 'faculty_preview')) {
      return { name: p.name || 'Facilitator', userId: p.sub || null, platformAuth: true, courseId: p.course || null };
    }
  }
  const roster = facultyRoster();
  const given = String(b.facultyCode || req.headers['x-faculty-code'] || '').trim();
  if (!roster.length || !given) return null;
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

const teamKey = label => 'team:' + String(label || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Engine state for a run. Everyone in a session shares the instructor's start time,
// so the whole room sees the same report at the same moment.
function engineState(sess, run) {
  return {
    participantId: run.runId,
    begunAt: sess.startedAt || null,
    docsOpened: run.docsOpened,
    decision: run.decision || null,
  };
}

function newRun(runId, label) {
  const p = E.createParticipant({ participantId: runId });
  return { runId, label, docsOpened: p.docsOpened, decision: null };
}

function phaseOf(sess, t) {
  if (!sess.startedAt) return 'lobby';
  return t - sess.startedAt >= E.PLAY_MS ? 'ended' : 'playing';
}

function publicSession(sess, t) {
  return { code: sess.code, mode: sess.mode, state: sess.state, phase: phaseOf(sess, t),
    solo: !!sess.solo, startedAt: sess.startedAt || null, serverNow: t, playMs: E.PLAY_MS };
}

async function ensureRun(code, runId, label) {
  const existing = await store.getRun(code, runId);
  if (existing) return existing;
  const run = newRun(runId, label);
  if (await store.compareAndSetRun(code, runId, null, run)) return run;
  return store.getRun(code, runId);
}

// Per-poll reads touch only this participant and their run, so cost does not grow with the room.
async function loadMe(code, pid) {
  if (!pid) return null;
  const me = await store.getParticipant(code, pid);
  if (!me) return null;
  return { me, run: await store.getRun(code, me.runId) };
}

function summaryOf(run) {
  const d = run.decision;
  if (!d) return 'No decision before the clock ran out';
  return d.choice === 'switch' ? `Switched to ClearPath at report ${d.atReport}` : `Committed to Northline at report ${d.atReport}`;
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  if (!store.configured()) return res.status(503).json({ error: 'no_store', message: 'Session storage is not configured for this deployment.' });
  announceOnce(req);

  const b = body(req);
  const action = String(b.action || '');
  const code = String(b.code || '').toUpperCase().trim();

  try {
    if (['join', 'state', 'open_doc', 'decide', 'reveal', 'start_solo'].includes(action)) {
      const sess = await store.getSession(code);
      if (sess) {
        const err = participantError(req, b, sess, action === 'join' ? null : String(b.participantId || ''));
        if (err) return res.status(err.status).json({ error: err.error });
      }
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const t = now();
      switch (action) {
        // Lets the join screen ask for a team name up front. Reveals nothing beyond the mode.
        case 'peek': {
          if (!/^[A-Z2-9]{5}$/.test(code)) return res.status(400).json({ error: 'invalid_session_code' });
          const sess = await store.getSession(code);
          if (!sess) return res.status(404).json({ error: 'no_such_session' });
          if (sess.solo) return res.status(403).json({ error: 'private_session' });
          return res.status(200).json({ mode: sess.mode, phase: phaseOf(sess, t), closed: sess.state === 'closed' });
        }

        case 'solo': {
          if (!checkAccess(req, res)) return;
          const launched = req.launch || null;
          if (launched && (!participantLaunch(req, b) || launched.mode === 'session')) {
            return res.status(403).json({ error: 'use_session' });
          }
          const name = String(launched ? launched.name || 'Participant' : b.name || '').trim().slice(0, 60);
          if (!name) return res.status(400).json({ error: 'name_required' });
          const c = newCode(), id = launched ? `platform:${launched.sub}` : newId();
          const runId = `individual:${id}`;
          const sess = { code: c, solo: true, owner: id, ownerId: launched?.sub || null,
            platformAuth: !!launched, courseId: launched?.course || null,
            mode: 'individual', state: 'open', startedAt: null, createdAt: t };
          await store.putSession(c, sess);
          const me = { id, name, runId, teamLabel: name, joinedAt: t };
          if (!await store.compareAndSetParticipant(c, id, null, me)) throw new Error('solo participant write failed');
          await ensureRun(c, runId, name);
          return res.status(200).json({ participantId: id, session: publicSession(sess, t) });
        }

        case 'start_solo': {
          const sess = await store.getSession(code);
          if (!sess) return res.status(404).json({ error: 'no_such_session' });
          if (!sess.solo || sess.owner !== String(b.participantId || '')) {
            return res.status(403).json({ error: 'not_your_session' });
          }
          if (sess.state === 'closed') return res.status(410).json({ error: 'session_closed' });
          if (sess.startedAt) return res.status(200).json({ session: publicSession(sess, t) });
          const next = { ...sess, startedAt: t };
          if (!await store.compareAndSetSession(code, sess, next)) continue;
          return res.status(200).json({ session: publicSession(next, t) });
        }

        case 'create': {
          const who = whoIsFaculty(req, b);
          if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
          const mode = String(b.mode || '');
          if (!cfg.modes.includes(mode)) return res.status(400).json({ error: 'play_mode_required' });
          const c = newCode();
          const sess = { code: c, owner: who.name, ownerId: who.userId || null, platformAuth: !!who.platformAuth,
            courseId: who.courseId || null, mode, state: 'open', startedAt: null, createdAt: t };
          await store.putSession(c, sess);
          return res.status(200).json({ session: sess });
        }

        case 'faculty_state': {
          const who = whoIsFaculty(req, b);
          if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
          const sess = await store.getSession(code);
          if (!sess) return res.status(404).json({ error: 'no_such_session' });
          if (!ownsSession(who, sess)) return res.status(403).json({ error: 'not_your_session' });
          const [participants, runs] = await Promise.all([store.getParticipants(code), store.getRuns(code)]);
          const states = Object.values(runs).filter(Boolean).map(r => engineState(sess, r));
          return res.status(200).json({
            session: { ...publicSession(sess, t), joinUrl: sess.platformAuth ? accountJoinUrl(sess) : null },
            joined: Object.keys(participants).length,
            teams: sess.mode === 'team' ? Object.keys(runs).length : null,
            projector: sess.startedAt ? E.projector(states, t) : null,
            debrief: phaseOf(sess, t) === 'ended' ? cfg.debrief : null,
          });
        }

        case 'control': {
          const who = whoIsFaculty(req, b);
          if (!who) return res.status(401).json({ error: 'faculty_authorization_required' });
          const sess = await store.getSession(code);
          if (!sess) return res.status(404).json({ error: 'no_such_session' });
          if (!ownsSession(who, sess)) return res.status(403).json({ error: 'not_your_session' });
          const next = { ...sess };
          if (b.set === 'start') {
            if (sess.startedAt) return res.status(409).json({ error: 'session_already_started' });
            if (sess.state === 'closed') return res.status(409).json({ error: 'session_closed' });
            next.startedAt = t;
          } else if (b.set === 'close') {
            next.state = 'closed';
          } else return res.status(400).json({ error: 'unknown_control' });
          if (!await store.compareAndSetSession(code, sess, next)) continue;
          return res.status(200).json({ session: publicSession(next, t) });
        }

        case 'join': {
          const sess = await store.getSession(code);
          if (!sess) return res.status(404).json({ error: 'no_such_session' });
          if (sess.solo) return res.status(403).json({ error: 'private_session' });
          const launched = participantLaunch(req, b);
          if ((req.headers['x-launch-token'] || b.launchToken) && !launched) return res.status(401).json({ error: 'launch_token_invalid' });
          const name = String(launched ? launched.name || '' : b.name || '').slice(0, 60).trim();
          if (!name) return res.status(400).json({ error: 'name_required' });
          const all = await store.getParticipants(code);
          const id = launched ? `platform:${launched.sub}` : (all[String(b.participantId || '')] ? String(b.participantId) : newId());
          const existing = all[id] || null;
          // Returning students (a page reload) always get back in. New joiners are refused once the
          // session is closed or the clock has ended, so a late arrival cannot land in the projector
          // as a "no decision" they never had the chance to make.
          if (!existing && sess.state === 'closed') return res.status(410).json({ error: 'session_closed' });
          if (!existing && phaseOf(sess, t) === 'ended') return res.status(410).json({ error: 'session_ended' });
          let runId, label;
          if (existing) { runId = existing.runId; label = existing.teamLabel; }
          else if (sess.mode === 'individual') { runId = `individual:${id}`; label = name; }
          else {
            label = String(b.teamName || '').trim().slice(0, 40);
            if (!label) return res.status(400).json({ error: 'team_name_required' });
            runId = teamKey(label);
          }
          const me = { ...existing, id, name, runId, teamLabel: label, joinedAt: existing?.joinedAt || t };
          if (!await store.compareAndSetParticipant(code, id, existing, me)) continue;
          await ensureRun(code, runId, label);
          return res.status(200).json({ participantId: id, session: publicSession(sess, t), me });
        }

        case 'state': {
          const sess = await store.getSession(code);
          if (!sess) return res.status(404).json({ error: 'no_such_session' });
          const loaded = await loadMe(code, String(b.participantId || ''));
          if (!loaded || !loaded.run) return res.status(403).json({ error: 'not_joined' });
          const { me, run } = loaded;
          const view = E.studentView(engineState(sess, run), t);
          if (run.decision && sess.mode === 'team') view.decision.by = run.decision.by || null;
          const mates = sess.mode === 'team'
            ? Object.values(await store.getParticipants(code)).filter(p => p && p.runId === me.runId).length : 1;
          return res.status(200).json({ session: publicSession(sess, t), me: { id: me.id, name: me.name, team: sess.mode === 'team' ? me.teamLabel : null, mates }, view });
        }

        case 'open_doc': {
          const sess = await store.getSession(code);
          if (!sess) return res.status(404).json({ error: 'no_such_session' });
          const loaded = await loadMe(code, String(b.participantId || ''));
          if (!loaded || !loaded.run) return res.status(403).json({ error: 'not_joined' });
          const { run } = loaded;
          let st;
          try { st = E.openDoc(engineState(sess, run), String(b.docId || ''), t); }
          catch (e) { return res.status(400).json({ error: 'unknown_document' }); }
          if (st.docsOpened === run.docsOpened) return res.status(200).json({ ok: true });
          if (!await store.compareAndSetRun(code, run.runId, run, { ...run, docsOpened: st.docsOpened })) continue;
          return res.status(200).json({ ok: true });
        }

        case 'decide': {
          const sess = await store.getSession(code);
          if (!sess) return res.status(404).json({ error: 'no_such_session' });
          const loaded = await loadMe(code, String(b.participantId || ''));
          if (!loaded || !loaded.run) return res.status(403).json({ error: 'not_joined' });
          const { me, run } = loaded;
          if (run.decision) return res.status(409).json({ error: 'decision_already_made', decision: { choice: run.decision.choice, atReport: run.decision.atReport, by: run.decision.by || null } });
          let st;
          try { st = E.decide(engineState(sess, run), { choice: b.choice, reason: b.reason, now: t }); }
          catch (e) { return res.status(400).json({ error: 'invalid_decision', message: e.message }); }
          const decision = { ...st.decision, by: sess.mode === 'team' ? me.name : null };
          // First press wins: the write only lands if the run is exactly as read, with no decision.
          if (!await store.compareAndSetRun(code, run.runId, run, { ...run, decision })) continue;
          return res.status(200).json({ decision: { choice: decision.choice, atReport: decision.atReport, by: decision.by } });
        }

        case 'reveal': {
          const sess = await store.getSession(code);
          if (!sess) return res.status(404).json({ error: 'no_such_session' });
          const loaded = await loadMe(code, String(b.participantId || ''));
          if (!loaded || !loaded.run) return res.status(403).json({ error: 'not_joined' });
          const { me, run } = loaded;
          if (phaseOf(sess, t) !== 'ended') return res.status(409).json({ error: 'not_ended' });
          const out = E.reveal(engineState(sess, run), t);
          if (sess.mode === 'team' && run.decision?.by) out.decisionLine += ` (${run.decision.by} pressed for the team.)`;
          const launched = sess.platformAuth ? participantLaunch(req, b) : null;
          let reported = !!me.reportedAt;
          if (!launched) {
            if (!me.completedAt) await store.compareAndSetParticipant(code, me.id, me, { ...me, completedAt: t });
          } else if (!reported && (!me.reportingAt || t - me.reportingAt > 30000)) {
            const next = { ...me, completedAt: me.completedAt || t, reportingAt: t };
            if (!await store.compareAndSetParticipant(code, me.id, me, next)) continue;
            const openedBoth = cfg.documents.every(d => out.reading[d.id]);
            const result = await reportCompletion({ launch: launched, summary: summaryOf(run),
              metrics: { choice: run.decision?.choice || 'none', atReport: run.decision?.atReport || null, openedBoth } });
            const saved = { ...next, reportingAt: null, ...(result.ok ? { reportedAt: t } : {}) };
            reported = result.ok && await store.compareAndSetParticipant(code, me.id, next, saved);
            if (!result.ok) await store.compareAndSetParticipant(code, me.id, next, saved);
          }
          return res.status(200).json({ reveal: out, completionReported: reported, completionRequired: !!launched });
        }

        default:
          return res.status(400).json({ error: 'unknown_action' });
      }
    }
    return res.status(409).json({ error: 'busy_retry' });
  } catch (e) {
    console.error('session error', action, e.message);
    return res.status(500).json({ error: 'server_error' });
  }
}

module.exports = handler;
module.exports._now = null; // tests may replace with a controllable clock
