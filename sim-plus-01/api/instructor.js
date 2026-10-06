'use strict';
const { body } = require('../lib/guard');
const store = require('../lib/store');
const { hydrate } = require('../lib/session');
const { review } = require('../src/report');
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const required = process.env.FACULTY_CODE;
  if (!required || req.headers['x-faculty-code'] !== required) return res.status(401).json({ error: 'faculty_access_required' });
  if (!store.configured()) return res.status(503).json({ error: 'no_store' });
  const b = body(req);
  const raw = await store.getRaw(`run03:${String(b.runId || '')}`);
  if (!raw) return res.status(404).json({ error: 'no_such_run' });
  const s = hydrate(raw);
  return res.status(200).json({ runId: b.runId, summary: s.summary(), transcript: s.transcript, submission: s.submission, review: s.submission ? review(s.submission, s.transcript) : null });
};
