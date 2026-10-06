// Report completed platform runs without scoring them. Class decisions come
// from the stored participant record; failed callbacks remain retryable.
const { checkAccess, checkDemoAccess, body } = require('../lib/guard.js');
const { reportCompletion } = require('../lib/launch.js');
const store = require('../lib/store.js');
const E = require('../lib/engine.js');
const { participantLaunch, participantError } = require('../lib/session-entry.js');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  if (req.headers['x-demo-mode'] === '1') {
    if (!checkDemoAccess(req, res)) return;
    return res.status(200).json({ ok: true, reported: false, reason: 'faculty_demo' });
  }
  const b = body(req);
  const launch = participantLaunch(req, b);
  if (!launch) return res.status(200).json({ ok: true, reported: false, reason: 'not_platform_launch' });
  const code = String(b.sessionCode || '').trim().toUpperCase();
  const pid = String(b.participantId || '');
  const now = Date.now();
  const report = (choice, lapsed) => reportCompletion({ launch,
    summary: lapsed ? 'Offer lapsed (declined)' : choice === 'buy' ? 'Bought' : 'Declined',
    metrics: { choice, lapsed }
  });
  try {
    if (!code) {
      if (!checkAccess(req, res)) return;
      const choice = String(b.choice || '');
      if (!['buy', 'decline'].includes(choice)) return res.status(400).json({ error: 'choice_required' });
      const r = await report(choice, !!b.lapsed);
      return res.status(200).json({ ok: true, reported: !!r.ok });
    }
    if (!store.configured()) return res.status(503).json({ error: 'no_store' });
    for (let attempt = 0; attempt < 5; attempt++) {
      const sess = await store.getSession(code);
      if (!sess) return res.status(404).json({ error: 'no_such_session' });
      if (!sess.platformAuth) return res.status(200).json({ ok: true, reported: false, reason: 'standalone' });
      const denied = participantError(req, b, sess, pid);
      if (denied) return res.status(denied.status).json({ error: denied.error });
      const me = (await store.getParticipants(code))[pid];
      if (!me) return res.status(403).json({ error: 'not_joined' });
      if (me.reportedAt) return res.status(200).json({ ok: true, reported: true, already: true });
      if (!me.choice || !me.recognised || E.effectiveStage(sess, await store.lastBeat(code), now) < 3) {
        return res.status(409).json({ error: 'not_finished' });
      }
      if (me.reportingAt && now - me.reportingAt < 30000) return res.status(200).json({ ok: true, reported: false, pending: true });
      const next = { ...me, reportingAt: now };
      if (!await store.compareAndSetParticipant(code, pid, me, next, sess)) continue;
      const r = await report(me.choice, !!me.lapsed);
      const saved = { ...next, reportingAt: null, ...(r.ok ? { reportedAt: now } : {}) };
      const persisted = await store.compareAndSetParticipant(code, pid, next, saved, sess);
      return res.status(200).json({ ok: true, reported: !!r.ok && persisted });
    }
    return res.status(409).json({ error: 'busy_retry' });
  } catch (e) {
    console.error('finish failed', e.message);
    return res.status(503).json({ error: 'finish_unavailable' });
  }
};
