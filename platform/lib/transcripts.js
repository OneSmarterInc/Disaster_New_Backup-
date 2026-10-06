'use strict';

// Existing deployments predate instructor transcripts. Keep the migration
// idempotent and run it at the two read/write boundaries that require the table.
let ready = false;
async function ensureTranscripts(s) {
  if (ready) return;
  const run = (text) => {
    if (typeof s.query === 'function') return s.query(text);
    const parts = [text]; parts.raw = [text]; return s(parts);
  };
  await run(`CREATE TABLE IF NOT EXISTS transcripts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sim_id TEXT NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
    course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
    sim_version TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    envelope JSONB NOT NULL
  )`);
  await run('CREATE INDEX IF NOT EXISTS transcripts_course_idx ON transcripts(course_id)');
  await run('CREATE INDEX IF NOT EXISTS transcripts_user_sim_idx ON transcripts(user_id, sim_id)');
  ready = true;
}

module.exports = { ensureTranscripts };
