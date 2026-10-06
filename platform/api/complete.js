// Sims report completions here. The message is signed with the same shared
// secret used for launches, so this is the same contract running the other way.
//
// The platform learns that a person finished, roughly how long it took, and
// whatever summary the sim chose to send. It learns nothing about the scenario,
// and the sim keeps no record of the person.
const crypto = require('crypto');
const { sql, id } = require('../lib/db.js');
const { verify } = require('../lib/launch.js');

function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  return b || {};
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    return res.status(204).end();
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const b = body(req);
  const payload = verify(String(b.token || ''));
  if (!payload) return res.status(401).json({ error: 'bad_signature' });
  if (!payload.sub || !payload.sim) return res.status(400).json({ error: 'incomplete_token' });

  const s = sql();
  try {
    // Only accept a completion for someone who really launched this sim.
    // Bind the completion to a launch the platform actually issued. Do not
    // trust a stale/null course carried by a resumed simulation run: that
    // stores a valid completion globally but makes it invisible to faculty.
    const known = payload.course
      ? await s`
          SELECT course_id, as_role FROM launches
          WHERE user_id = ${payload.sub} AND sim_id = ${payload.sim}
            AND course_id = ${payload.course}
          ORDER BY created_at DESC LIMIT 1`
      : await s`
          SELECT course_id, as_role FROM launches
          WHERE user_id = ${payload.sub} AND sim_id = ${payload.sim}
          ORDER BY created_at DESC LIMIT 1`;
    if (!known.length) return res.status(404).json({ error: 'no_matching_launch' });
    const courseId = known[0].course_id || null;

    const dur = payload.duration && Number.isFinite(+payload.duration)
      ? Math.max(0, Math.min(86400, Math.round(+payload.duration))) : null;

    let metrics = null;
    if (payload.metrics && typeof payload.metrics === 'object') {
      // Keep it small — this is a summary, not a transcript.
      const trimmed = {};
      Object.entries(payload.metrics).slice(0, 12).forEach(([k, v]) => {
        trimmed[String(k).slice(0, 60)] = typeof v === 'string' ? v.slice(0, 200) : v;
      });
      metrics = trimmed;
    }

    // Some simulations return a structured summary. String(object) used to turn
    // that into "[object Object]", which meant faculty could see a completion but
    // not the student's actual reflection. Store structured summaries as JSON
    // text while keeping plain-string summaries backward compatible.
    let summary = null;
    if (payload.summary !== undefined && payload.summary !== null) {
      try {
        summary = typeof payload.summary === 'object'
          ? JSON.stringify(payload.summary)
          : String(payload.summary);
      } catch {
        summary = String(payload.summary);
      }
      summary = summary.slice(0, 6000);
    }

    await s`INSERT INTO completions (id, user_id, sim_id, course_id, duration_seconds, summary, metrics)
            VALUES (${id('cmp')}, ${payload.sub}, ${payload.sim}, ${courseId},
                    ${dur}, ${summary}, ${metrics ? JSON.stringify(metrics) : null})`;

    return res.status(200).json({ ok: true });
  } catch (e) {
    if (e.code === 'NO_SECRET') return res.status(500).json({ error: 'no_secret' });
    if (e.code === 'NO_DB') return res.status(503).json({ error: 'no_db' });
    console.error('completion failure', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
