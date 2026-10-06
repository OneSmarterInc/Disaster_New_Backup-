const { checkAccess, body } = require('../lib/guard.js');
const S = require('../lib/scenario.js');
const store = require('../lib/store.js');
const { runnerOf } = require('../lib/team-runner.js');
const { participantError } = require('../lib/session-entry.js');

function evaluate(stage, y1, y2, thresholds) {
  if (stage === 'year1') return { outcome: S.evaluateYear1(y1, thresholds) };
  if (stage === 'year2') return { outcome: S.evaluateYear2(y1, y2, thresholds) };
  if (stage === 'year3' || stage === 'all') return { outcome: S.evaluateAll(y1, y2, thresholds) };
  return null;
}

async function fromSession(req, b, res) {
  const code = String(b.sessionCode || '').toUpperCase().trim();
  const pid = String(b.participantId || '');
  // A remembered participant ID without a session code is a standalone run.
  // Standalone access is still checked by checkAccess below.
  if (!code) return false;
  const reject = (status, error) => { res.status(status).json({ error }); return true; };
  if (!code || !pid) return reject(400, 'session_identity_required');
  if (!store.configured()) return reject(503, 'no_store');
  const sess = await store.getSession(code);
  if (!sess) return reject(404, 'no_such_session');
  const denied = participantError(req, b, sess, pid);
  if (denied) return reject(denied.status, denied.error);
  const participants = await store.getParticipants(code);
  const me = participants[pid];
  if (!me) return reject(403, 'not_joined');
  const rid = sess.mode === 'individual' ? `individual:${me.id}` : me.groupId;
  if (!rid) return reject(409, 'team_not_assigned');
  const run = (await store.getRuns(code))[rid];
  if (sess.mode === 'team' && runnerOf(participants, rid, run)?.id !== me.id) {
    return reject(403, 'runner_only');
  }
  if (!run) return reject(409, 'nothing_committed_yet');
  const stage = String(b.stage || '');
  if (!run.year1) return reject(409, 'year1_not_committed');
  if (stage !== 'year1' && !run.year2) return reject(409, 'year2_not_committed');
  const result = evaluate(stage, run.year1, run.year2, S.sessionThresholds(sess));
  if (!result) return reject(400, 'unknown_stage');
  res.status(200).json(result);
  return true;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = body(req);
  try {
    if (await fromSession(req, b, res)) return;
  } catch (e) {
    console.error('session outcome lookup failed', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
  if (!checkAccess(req, res)) return;
  const stage = String(b.stage || '');
  let thresholds;
  try { thresholds = S.standaloneThresholds(b.calibrationId); }
  catch (e) { return res.status(e.status).json({ error: e.code, message: e.message }); }
  const v1 = S.validateAllocation(b.year1, thresholds);
  if (!v1.ok) return res.status(400).json(v1);
  if (stage === 'year1') return res.status(200).json(evaluate(stage, v1.allocation, null, thresholds));
  const v2 = S.validateAllocation(b.year2, thresholds);
  if (!v2.ok) return res.status(400).json(v2);
  const result = evaluate(stage, v1.allocation, v2.allocation, thresholds);
  if (!result) return res.status(400).json({ error: 'unknown_stage' });
  return res.status(200).json(result);
};
