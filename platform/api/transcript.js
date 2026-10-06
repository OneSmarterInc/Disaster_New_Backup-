// Sims post an instructor transcript here when someone finishes.
//
// Same signed-token contract as complete.js — the sim proves who it is with
// the shared secret, and the platform confirms that person really launched
// this sim before storing anything. A sim may post a transcript, a completion,
// or both; neither depends on the other.
//
// What arrives is opaque. The envelope carries the sim's own vocabulary for
// phases, classifications and findings, and the platform renders it without
// knowing what any of it means. That is what keeps a sim an independent
// deployment rather than something the platform has to be taught about.
//
// One thing the envelope deliberately does not contain: the text of anything a
// character said. Events carry an outputRef that resolves against the sim at a
// matching version. A copy of this table is therefore not a copy of any sim's
// answer key.
const { sql, id } = require('../lib/db.js');
const { verify } = require('../lib/launch.js');
const { ensureTranscripts } = require('../lib/transcripts.js');

const MAX_BYTES = 256 * 1024;

function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  return b || {};
}

// A shape check, not a content check. The platform is entitled to know that it
// has been handed something renderable; it is not entitled to an opinion about
// what is in it.
function renderable(env) {
  if (!env || typeof env !== 'object') return 'not_an_object';
  if (!env.simId) return 'no_sim_id';
  if (!env.simVersion) return 'no_sim_version';
  if (!Array.isArray(env.events)) return 'no_events';
  if (!Array.isArray(env.phases)) return 'no_phases';
  for (const e of env.events) {
    if (typeof e.ordinal !== 'number') return 'event_without_ordinal';
    if (!e.phase) return 'event_without_phase';
    // If a sim ever starts shipping answer text, this is where it shows up.
    if ('answer' in e || 'text' in e) return 'event_carries_answer_text';
  }
  return null;
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

  const env = b.envelope;
  const wrong = renderable(env);
  if (wrong) return res.status(400).json({ error: wrong });

  const serialised = JSON.stringify(env);
  if (serialised.length > MAX_BYTES) return res.status(413).json({ error: 'envelope_too_large' });

  // The sim is trusted to sign, not to say who this is about.
  if (env.simId !== payload.sim) return res.status(400).json({ error: 'sim_mismatch' });

  const s = sql();
  try {
    await ensureTranscripts(s);
    const known = await s`
      SELECT 1 FROM launches
      WHERE user_id = ${payload.sub} AND sim_id = ${payload.sim}
      LIMIT 1`;
    if (!known.length) return res.status(404).json({ error: 'no_matching_launch' });

    // A resumed or replayed session posts again. Keeping every attempt is
    // right: a participant who ran out of time on day one and came back has
    // two transcripts, and both are worth reading.
    await s`INSERT INTO transcripts (id, user_id, sim_id, course_id, sim_version, envelope)
            VALUES (${id('trs')}, ${payload.sub}, ${payload.sim}, ${payload.course || null},
                    ${String(env.simVersion).slice(0, 40)}, ${serialised}::jsonb)`;

    return res.status(200).json({ ok: true });
  } catch (e) {
    if (e.code === 'NO_SECRET') return res.status(500).json({ error: 'no_secret' });
    if (e.code === 'NO_DB') return res.status(503).json({ error: 'no_db' });
    console.error('transcript failure', e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
