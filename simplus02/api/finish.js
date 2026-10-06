'use strict';
// Reports completion to the platform once, after the deadline. Decisions only; the sim has no score.
const { store, keys } = require('../lib/store');
const { body, launchFor, participant } = require('../lib/guard');
const { reportCompletion } = require('../lib/launch');
const { settleDeadline } = require('./session');
const crypto = require('crypto');
const R = require('../lib/room');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = body(req);
  const launch = launchFor(req, b);
  if (!launch) return res.status(req.headers['x-launch-token'] || b.launchToken ? 401 : 200)
    .json({ ok: true, reported: false, reason: 'not_platform_launch' });
  if (!store.configured()) return res.status(503).json({ error: 'no_store' });
  const code = String(b.code || '').toUpperCase().trim(), pid = String(b.participantId || '');
  try {
    const sess = await store.get(keys.session(code));
    const roster = await store.get(keys.roster(code));
    const me = roster && roster[pid];
    if (!sess || !me || !me.launch || !participant(req, b, sess, me)) return res.status(403).json({ error: 'not_joined' });
    await settleDeadline(code, Date.now());
    const table = me.table ? await store.get(keys.table(code, me.table)) : null;
    const done = R.completionSummary(roster, pid, table);
    if (!done) return res.status(409).json({ error: 'not_finished' });
    const key = keys.report(code, pid), previous = await store.get(key);
    if (previous && previous.reportedAt) return res.status(200).json({ ok: true, reported: true, already: true });
    if (previous && previous.lockAt && Date.now() - previous.lockAt < 30000) return res.status(200).json({ ok: true, reported: false, pending: true });
    const lock = { id: crypto.randomUUID(), lockAt: Date.now() };
    if (!await store.cas(key, previous, lock)) return res.status(200).json({ ok: true, reported: false, pending: true });
    const r = await reportCompletion({ launch, ...done });
    const saved = await store.cas(key, lock, r.ok ? { reportedAt: Date.now() } : { failedAt: Date.now() });
    return res.status(200).json({ ok: true, reported: !!r.ok && saved });
  } catch (e) {
    console.error('finish failed', e.message);
    return res.status(503).json({ error: 'finish_unavailable' });
  }
};
