'use strict';

const { DISPOSITIONS, ROWS, OUTCOMES, EVIDENCE, LOOP_PAIRS } = require('../data/report');

const MIN_JUSTIFICATION = 15;

/**
 * Validate a submitted report. Every row needs a disposition and a
 * justification with something in it, and the root cause cannot be
 * blank. A participant who omits a row has dodged the decision rather
 * than made it, which is why the form does not permit it.
 */
function validate(submission) {
  const errors = [];
  const s = submission || {};

  const root = String(s.rootCause || '').trim();
  if (!root) {
    errors.push({ field: 'rootCause', message: 'Root cause is required.' });
  } else if (root.length < MIN_JUSTIFICATION) {
    errors.push({ field: 'rootCause', message: `Root cause must be at least ${MIN_JUSTIFICATION} characters.` });
  }

  for (const row of ROWS) {
    const entry = (s.rows || {})[row.id];
    if (!entry) {
      errors.push({ field: row.id, message: `${row.label}: no disposition selected.` });
      continue;
    }
    if (!DISPOSITIONS.includes(entry.disposition)) {
      errors.push({
        field: row.id,
        message: `${row.label}: "${entry.disposition}" is not a disposition.`
      });
    }
    const justification = String(entry.justification || '').trim();
    if (!justification) {
      errors.push({ field: row.id, message: `${row.label}: justification is required.` });
    } else if (justification.length < MIN_JUSTIFICATION) {
      errors.push({ field: row.id, message: `${row.label}: justification must be at least ${MIN_JUSTIFICATION} characters.` });
    }
  }

  return { ok: errors.length === 0, errors };
}

/** What the platform vendor configures, and what follows from it. */
function consequences(submission) {
  return ROWS.map((row) => {
    const disposition = ((submission.rows || {})[row.id] || {}).disposition;
    const outcome = (OUTCOMES[row.id] || {})[disposition];
    return {
      rowId: row.id,
      label: row.label,
      disposition,
      severity: outcome ? outcome.severity : 'unknown',
      configured: outcome ? outcome.configured : null,
      consequence: outcome ? outcome.consequence : null
    };
  });
}

/**
 * What the participant could have known, drawn from what was actually
 * said to them. This does NOT grade the root cause — nothing here reads
 * the prose. It exists so that an instructor reading a correct-looking
 * root cause can tell whether it was reasoned from evidence or arrived
 * at by instinct, which are different conversations in the debrief.
 */
function evidenceHeld(transcript) {
  const held = EVIDENCE.filter((e) => transcript.some((t) => e.match(t)));
  const heldIds = new Set(held.map((e) => e.id));
  const loopAvailable = LOOP_PAIRS.some((pair) => pair.every((id) => heldIds.has(id)));
  return {
    held: held.map((e) => ({ id: e.id, label: e.label })),
    missed: EVIDENCE.filter((e) => !heldIds.has(e.id)).map((e) => ({ id: e.id, label: e.label })),
    loopAvailable,
    loopPairsHeld: LOOP_PAIRS.filter((p) => p.every((id) => heldIds.has(id)))
  };
}

/** Instructor view. Combines the report, its consequences, and the access behind it. */
function review(submission, transcript) {
  const v = validate(submission);
  if (!v.ok) return { ok: false, errors: v.errors };

  const cons = consequences(submission);
  const ev = evidenceHeld(transcript);
  const harm = cons.filter((c) => c.severity === 'harm');
  const dodges = cons.filter((c) => c.severity === 'dodge');

  // A disposition is "supported" when the evidence bearing on that step
  // was actually delivered. Unsupported does not mean wrong — it means
  // the participant did not learn the thing their recommendation turns
  // on, which is the distinction worth surfacing.
  const heldIds = new Set(ev.held.map((e) => e.id));
  const support = {
    log: heldIds.has('log_unseen') || heldIds.has('log_origin'),
    review: heldIds.has('matching_judgment'),
    intake: heldIds.has('batching_delay'),
    vendor: heldIds.has('vendor_opacity')
  };

  return {
    ok: true,
    rootCause: String(submission.rootCause).trim(),
    consequences: cons,
    harmFired: harm.length > 0,
    harm,
    dodges,
    evidence: ev,
    support,
    unsupportedDispositions: cons
      .filter((c) => support[c.rowId] === false && c.severity !== 'dodge')
      .map((c) => ({ rowId: c.rowId, disposition: c.disposition, label: c.label }))
  };
}

module.exports = { validate, consequences, evidenceHeld, review, MIN_JUSTIFICATION };
