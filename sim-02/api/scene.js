// Releases one phase of scene content at a time. Nothing about a later phase
// reaches the browser until the student has actually got there.
const { checkAccess, body } = require('../lib/guard.js');
const S = require('../lib/scenario.js');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!checkAccess(req, res)) return;

  const b = body(req);
  const phase = parseInt(b.phase, 10);

  if (b.init) {
    // Everything the opening screens need, and nothing else.
    return res.status(200).json({
      cast: S.CAST_PUBLIC,
      castOrder: S.CAST_ORDER,
      intro: S.CAST_INTRO,
      actions: S.ACTIONS,
      readings: S.READINGS,
      labels: S.PHASES.map(p => ({ label: p.label, clock: p.clock, day: p.day }))
    });
  }

  if (!(phase >= 0 && phase < S.PHASES.length)) {
    return res.status(400).json({ error: 'bad phase' });
  }
  // Run state decides which Day 2 the student gets. Recomputed here from the
  // recorded positions where possible, so a reload can't land in the wrong one.
  const client = (b.state && typeof b.state === 'object') ? b.state : {};
  const positions = Array.isArray(b.positions) ? b.positions : [];
  const took = (id) => positions.filter(p => p.action === id).map(p => p.phase);
  const preserveAt = took('preserve');
  const fromClient = client.preservedAt === 0 || client.preservedAt === 1 ? client.preservedAt : null;
  const candidates = preserveAt.concat(fromClient === null ? [] : [fromClient]);
  const state = {
    preserved: !!client.preserved || candidates.length > 0,
    preservedAt: candidates.length ? Math.min.apply(null, candidates) : null,
    rolledBack: !!client.rolledBack || took('rollback').length > 0
  };
  return res.status(200).json({ scene: S.sceneFor(phase, state) });
};
