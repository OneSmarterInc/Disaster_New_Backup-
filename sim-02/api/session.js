// Everything to do with a facilitated session. One endpoint, action-switched,
// so the deployment stays small.
const { body } = require('../lib/guard.js');
const store = require('../lib/store.js');
const { verifyLaunch } = require('../lib/launch.js');
const S = require('../lib/scenario.js');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const newId = () => Math.random().toString(36).slice(2, 10);

// Faculty codes. FACULTY_CODES holds one entry per person as "Name:code",
// comma separated — e.g. "Chuck Rivera:chuck-8811,Dana Okoye:dana-4420".
// FACULTY_CODE (singular) is still honoured as a shared fallback.
function facultyRoster() {
  const raw = process.env.FACULTY_CODES || '';
  const out = [];
  raw.split(',').map(s => s.trim()).filter(Boolean).forEach(entry => {
    const i = entry.lastIndexOf(':');
    if (i > 0) out.push({ name: entry.slice(0, i).trim(), code: entry.slice(i + 1).trim() });
  });
  const single = process.env.FACULTY_CODE;
  if (single) out.push({ name: 'Facilitator', code: single });
  return out;
}

// Returns { name } for a valid code, or null.
function whoIsFaculty(req, b) {
  // Someone sent here by the platform has already proved who they are: the
  // launch token is signed and says they are faculty. Asking them for a
  // facilitator code as well would be asking for something the platform never
  // gave them.
  const lt = req.headers['x-launch-token'] || (b && b.launchToken);
  if (lt) {
    const p = verifyLaunch(String(lt));
    if (p && (p.role === 'faculty' || p.role === 'faculty_preview')) {
      return { name: p.name || 'Facilitator' };
    }
  }
  const roster = facultyRoster();
  if (!roster.length) return { name: 'Facilitator' };   // nothing configured — open
  const given = String((b && b.facultyCode) || req.headers['x-faculty-code'] || '').trim();
  if (!given) return null;
  const hit = roster.find(r => r.code === given);
  return hit ? { name: hit.name } : null;
}

// A session belongs to whoever created it. Others can't drive it.
function ownsSession(who, sess) {
  if (!who) return false;
  if (!sess.owner) return true;              // sessions made before ownership existed
  return sess.owner === who.name;
}

// What the student's browser is allowed to know about the session.
function publicSession(sess) {
  return {
    code: sess.code, name: sess.name, state: sess.state,
    paused: !!sess.paused, revealed: !!sess.revealed, holdReveal: !!sess.holdReveal
  };
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!store.configured()) {
    return res.status(503).json({ error: 'no_store', message: 'Session storage is not set up on this deployment. Add a KV store in the Vercel dashboard and redeploy.' });
  }

  const b = body(req);
  const action = String(b.action || '');
  const code = String(b.code || '').toUpperCase().trim();

  try {
    switch (action) {

      // ---------- faculty ----------
      case 'create': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_code_required' });
        const c = newCode();
        const sess = {
          code: c, owner: who.name,
          name: String(b.name || 'RapidSim 02').slice(0, 80),
          state: 'lobby', paused: false, revealed: false,
          holdReveal: b.holdReveal !== false,
          createdAt: Date.now()
        };
        await store.putSession(c, sess);
        return res.status(200).json({ session: sess, you: who.name });
      }

      case 'faculty_state': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_code_required' });
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (!ownsSession(who, sess)) return res.status(403).json({ error: 'not_your_session', message: `That session belongs to ${sess.owner}.` });
        const [participants, runs] = await Promise.all([store.getParticipants(code), store.getRuns(code)]);
        return res.status(200).json({ session: sess, participants, runs, you: who.name, phases: S.PHASES.map(p => p.label) });
      }

      case 'group': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_code_required' });
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (!ownsSession(who, sess)) return res.status(403).json({ error: 'not_your_session', message: `That session belongs to ${sess.owner}.` });
        const assign = b.assign || {};   // participantId -> groupId
        const participants = await store.getParticipants(code);
        for (const [pid, gid] of Object.entries(assign)) {
          if (!participants[pid]) continue;
          participants[pid].groupId = String(gid);
          await store.setParticipant(code, pid, participants[pid]);
        }
        return res.status(200).json({ ok: true });
      }

      case 'control': {
        const who = whoIsFaculty(req, b);
        if (!who) return res.status(401).json({ error: 'faculty_code_required' });
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (!ownsSession(who, sess)) return res.status(403).json({ error: 'not_your_session', message: `That session belongs to ${sess.owner}.` });
        if (b.set === 'start')   { sess.state = 'running'; sess.startedAt = Date.now(); }
        if (b.set === 'pause')   sess.paused = true;
        if (b.set === 'resume')  sess.paused = false;
        if (b.set === 'reveal')  sess.revealed = true;
        if (b.set === 'close')   { sess.state = 'closed'; sess.revealed = true; }
        await store.putSession(code, sess);
        return res.status(200).json({ session: sess });
      }

      // ---------- students ----------
      case 'join': {
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        if (sess.state === 'closed') return res.status(410).json({ error: 'session_closed' });
        const name = String(b.name || '').slice(0, 60).trim();
        if (!name) return res.status(400).json({ error: 'name_required' });
        const id = String(b.participantId || '') || newId();
        const existing = (await store.getParticipants(code))[id];
        await store.addParticipant(code, id, {
          id, name,
          groupId: existing ? existing.groupId : null,
          joinedAt: existing ? existing.joinedAt : Date.now()
        });
        return res.status(200).json({ participantId: id, session: publicSession(sess) });
      }

      // Polled by the student's browser: session state plus their own group.
      case 'state': {
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        const pid = String(b.participantId || '');
        const participants = await store.getParticipants(code);
        const me = participants[pid] || null;
        let mates = [];
        if (me && me.groupId) {
          mates = Object.values(participants)
            .filter(p => p && p.groupId === me.groupId)
            .map(p => p.name);
        }
        return res.status(200).json({ session: publicSession(sess), me, mates });
      }

      // A group locks a position, or finishes.
      case 'submit': {
        const sess = await store.getSession(code);
        if (!sess) return res.status(404).json({ error: 'no_such_session' });
        const groupId = String(b.groupId || '');
        if (!groupId) return res.status(400).json({ error: 'group_required' });
        // Only somebody who actually joined, and is in that group, may write to
        // it. Without this anyone holding a live session code could overwrite
        // another run by naming its group.
        const pid = String(b.participantId || '');
        const who = (await store.getParticipants(code))[pid];
        if (!who || who.groupId !== groupId) return res.status(403).json({ error: 'not_in_that_group' });
        const runs = await store.getRuns(code);
        const run = runs[groupId] || { groupId, positions: [], phase: 0, done: false };
        if (Array.isArray(b.positions)) run.positions = b.positions.slice(0, 3);
        if (typeof b.phase === 'number') run.phase = b.phase;
        if (b.done) run.done = true;
        // The browser sends ladderEarnedAt. This read coverageEarnedAt, which is
        // Sim 01's name for it, so the value was dropped and the facilitator was
        // told nobody had earned the disclosure.
        if (b.ladderEarnedAt !== undefined) run.ladderEarnedAt = b.ladderEarnedAt;
        if (b.privateCount !== undefined) run.privateCount = b.privateCount;
        run.updatedAt = Date.now();
        await store.setRun(code, groupId, run);
        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(400).json({ error: 'unknown_action' });
    }
  } catch (e) {
    if (e.code === 'NO_STORE') return res.status(503).json({ error: 'no_store', message: e.message });
    console.error('session failure', action, e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
