// Completion report. Only a platform-launched participant whose run has reached
// the ending is reported, and only once. The report carries decisions and the
// ending group: no score, because the sim has none.
const { body } = require('../lib/guard.js');
const { reportCompletion, verifyLaunch } = require('../lib/launch.js');
const store = require('../lib/store.js');
const S = require('../lib/scenario.js');
const R = require('../lib/room.js');
const { participantError } = require('../lib/session-entry.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  const b = body(req);
  const launch = verifyLaunch(String(req.headers['x-launch-token'] || b.launchToken || ''));
  if (!launch || launch.sim !== S.META.id) return res.status(200).json({ ok: true, reported: false, reason: 'not_platform_launch' });
  if (!store.configured()) return res.status(503).json({ error: 'no_store' });
  const code = String(b.code || '').toUpperCase().trim();
  const pid = String(b.participantId || '');
  const now = Date.now();
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const sess = await store.getSession(code);
      if (!sess) return res.status(404).json({ error: 'no_such_session' });
      if (!sess.platformAuth) return res.status(200).json({ ok: true, reported: false, reason: 'standalone' });
      const denied = participantError(req, b, sess, pid);
      if (denied) return res.status(denied.status).json({ error: denied.error });
      const participants = await store.getParticipants(code);
      const me = participants[pid];
      if (!me) return res.status(403).json({ error: 'not_joined' });
      if (me.reportedAt) return res.status(200).json({ ok: true, reported: true, already: true });
      const done = R.completionSummary(sess, participants, pid, now);
      if (!done) return res.status(409).json({ error: 'not_finished' });
      if (me.reportingAt && now - me.reportingAt < 30000) return res.status(200).json({ ok: true, reported: false, pending: true });
      const next = { ...me, reportingAt: now };
      if (!await store.compareAndSetParticipant(code, pid, me, next, sess)) continue;
      const r = await reportCompletion({ launch, summary: done.summary, metrics: done.metrics });
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
