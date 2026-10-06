'use strict';
// Read-only inventory. Counts identify dependencies, NOT which scenario a reused
// ID represents. This module intentionally contains no migration/delete path.
const DEFAULT_IDS = Object.freeze(['rapid-03-bench', 'rapid-sim-03', 'rapidsimplus-01']);
async function auditSimIdentities(sql, ids = DEFAULT_IDS) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 20 || ids.some(id => typeof id !== 'string' || !/^[a-z0-9_-]{1,200}$/i.test(id))) {
    throw new Error('Supply between 1 and 20 valid simulation identifiers.');
  }
  const relation = (await sql`SELECT to_regclass('public.transcripts') AS relation`)[0]?.relation;
  const records = [];
  for (const id of [...new Set(ids)]) {
    const rows = await sql`SELECT id, title, published, launch_url, detail FROM sims WHERE id = ${id}`;
    const counts = (await sql`SELECT
      (SELECT count(*) FROM course_sims WHERE sim_id = ${id}) AS course_sims,
      (SELECT count(*) FROM launches WHERE sim_id = ${id}) AS launches,
      (SELECT count(*) FROM completions WHERE sim_id = ${id}) AS completions,
      (SELECT count(*) FROM previews WHERE sim_id = ${id}) AS previews,
      (SELECT count(*) FROM sim_access WHERE sim_id = ${id}) AS sim_access`)[0];
    if (!counts) throw new Error(`No dependency-count result for ${id}.`);
    const transcripts = relation ? (await sql`SELECT count(*) AS n FROM transcripts WHERE sim_id = ${id}`)[0]?.n : null;
    const normalized = {};
    for (const [key, value] of Object.entries({ ...counts, transcripts })) {
      if (key === 'transcripts' && !relation) { normalized[key] = null; continue; }
      const n = Number(value);
      if (value == null || !Number.isSafeInteger(n) || n < 0) throw new Error(`Invalid ${key} count for ${id}.`);
      normalized[key] = n;
    }
    records.push({ id, exists: rows.length > 0, catalogue: rows[0] || null, dependencies: normalized });
  }
  return { readOnly: true, observedAt: new Date().toISOString(),
    warning: 'A reused identifier may contain both Bench and Wexford history. These counts do not authorize deletion, publication or reassignment.',
    transcriptsTablePresent: !!relation, records };
}
module.exports = { DEFAULT_IDS, auditSimIdentities };
