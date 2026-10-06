'use strict';

// What this sim declares to the platform transcript view.
//
// The spec asks each sim for five things: a phase vocabulary, a
// classification vocabulary for display, a kind for each state
// transition, a reachability declaration, and an outcome mapper. All
// five live here so the platform never has to know anything about
// claims administration.

const SIM_ID = require('../lib/meta').META.id;

/** Phase labels. The platform groups the timeline by these. */
function phaseLabel(phaseId, path) {
  const n = Number(String(phaseId).replace('window-', ''));
  const actor = path && path[n - 1];
  return `Window ${n}` + (actor ? ` · ${actor}` : '');
}

/**
 * Classification vocabulary, for display only. The platform never
 * interprets these — it groups and prints them.
 */
const CLASSIFICATION_LABELS = {
  GENERIC_DESCRIPTIVE: 'open-ended',
  PURPOSE_ORIGIN: 'purpose / origin',
  DOWNSTREAM_CONSUMER: 'who receives it',
  EXCEPTION_HANDLING: 'exceptions',
  COUNTERFACTUAL: 'counterfactual',
  SENDER_PERSPECTIVE: 'sender’s view',
  VOLUME_TIMING: 'volume / timing',
  PERSONAL_HISTORY: 'personal',
  TOOLS_SYSTEMS: 'tools',
  EFFICIENCY_FRAMING: 'efficiency framing',
  AMBIGUOUS_PRESSURE: 'pressure (ambiguous)',
  UNMATCHED: 'unclassified'
};

/**
 * Transition kinds. Only 'irreversible' gets special platform
 * treatment — it breaks the timeline and anchors the read.
 */
function transitionKind(from, to) {
  if (to === 'CLOSED') return 'irreversible';
  if (from === 'GUARDED' && to === 'OPEN') return 'gate';
  return 'progress';
}

function transitionLabel(actorLabel, from, to) {
  if (to === 'CLOSED') return `${actorLabel} stopped volunteering anything`;
  if (to === 'OPEN') return `${actorLabel} began describing what the work requires`;
  return `${actorLabel}: ${from} → ${to}`;
}

/** Severity ordering, so the platform can style without knowing meanings. */
const SEVERITY_RANK = { harm: 0, miss: 1, dodge: 2, partial: 3, ok: 4, correct: 5 };

// The batch the participant watches: 20 claims, 600 seconds, 17 at 12s
// and 3 at 105/132/159. An honest estimate lands on 30. Held here so the
// debrief can compare what they wrote against what was actually there
// rather than against a number typed into a faculty guide.
const OBSERVATION = { claims: 20, seconds: 600, trueMean: 30, cleanSeconds: 12, longClaims: 3 };

/**
 * How an observation estimate reads at debrief.
 *
 * There is no wrong answer here and nothing is scored. What matters is
 * WHICH kind of right they were: a participant who wrote 12 excluded the
 * long claims as anomalies, one who wrote 30 averaged them in without
 * noticing, and both are worth a different conversation.
 */
function readEstimate(seconds) {
  if (seconds == null) return null;
  const s = Number(seconds);
  if (s <= OBSERVATION.cleanSeconds + 3)
    return { band: 'excluded-the-long-claims',
      note: 'Timed the clean claims and set the long ones aside as one-offs. They saw the exception and discounted it.' };
  if (s >= OBSERVATION.trueMean - 6 && s <= OBSERVATION.trueMean + 6)
    return { band: 'averaged-it-in',
      note: 'Divided the clock by the count. Accurate, and it describes seven and a half minutes of an eighty-minute batch.' };
  if (s > OBSERVATION.trueMean + 6)
    return { band: 'over-weighted-the-long-claims',
      note: 'The long claims dominated the estimate. Worth asking what they thought was happening in them.' };
  return { band: 'between',
      note: 'Between the clean figure and the true mean. Worth asking how they arrived at it.' };
}

/** Outcome mapper: review() output → the platform's outcome shape. */
function toOutcome(reviewResult, observation) {
  const worst = reviewResult.consequences
    .slice()
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9))[0];

  return {
    summary: reviewResult.harmFired
      ? 'The report caused harm.'
      : reviewResult.dodges.length
      ? 'No harm, but a decision was avoided.'
      : 'No harm fired.',
    severity: worst ? worst.severity : 'ok',
    detail: reviewResult.harmFired
      ? reviewResult.harm.map((h) => h.consequence).join(' ')
      : 'Worth checking whether the safe answer was reasoned or simply safe.',
    artifacts: [
      { label: 'Root cause, as written', value: reviewResult.rootCause },
      ...(observation && observation.estimateSeconds != null
        ? [{
            label: 'Observed pace, as recorded',
            value: observation.estimateSeconds + ' seconds per claim' +
              (observation.reading ? ' — ' + observation.reading.note : '')
          }]
        : []),
      ...reviewResult.consequences.map((c) => ({
        label: c.label,
        value: `${String(c.disposition).replace('_', ' ')} — ${c.configured}`
      }))
    ]
  };
}

module.exports = {
  SIM_ID,
  OBSERVATION,
  readEstimate,
  phaseLabel,
  CLASSIFICATION_LABELS,
  transitionKind,
  transitionLabel,
  toOutcome,
  SEVERITY_RANK
};
