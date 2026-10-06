'use strict';

// The report is the deliverable and the instrument of harm. It goes to
// the platform vendor, who configures against it.
//
// Four dispositions, one free-text root cause. The dispositions are what
// the vendor acts on. The root cause is what reveals whether the
// participant understood anything, and it is never machine-graded — see
// EVIDENCE below.

const DISPOSITIONS = ['automate', 'keep', 'eliminate', 'cannot_assess'];

const ROWS = [
  {
    id: 'intake',
    label: 'Claim intake — channels and release schedule',
    chartNote: 'Four channels. Batches release 9:00 and 2:00.'
  },
  {
    id: 'log',
    label: 'Receipt log',
    chartNote: 'All non-electronic claims posted to a spreadsheet before review.'
  },
  {
    id: 'vendor',
    label: 'Fax conversion vendor',
    chartNote: 'Faxes routed out for conversion. Two business day round trip.'
  },
  {
    id: 'review',
    label: 'First-pass review and matching',
    chartNote: 'Participant-observed pace is carried from the completed process chart.'
  }
];

// What the platform vendor does with each disposition, and what follows.
// severity: 'harm' fires the named consequence in the debrief.
const OUTCOMES = {
  review: {
    automate: {
      severity: 'harm',
      configured: 'Exact-match deduplication against the claims database. First-pass review retired.',
      consequence:
        'Repeat copies arriving through different conversion paths no longer match, and are paid twice. ' +
        'Legitimate same-day second procedures match on patient and date and are auto-denied. ' +
        'Denial letters go to patients for treatment they received. Ruth Kessler\'s role is eliminated ' +
        'and the matching knowledge goes with it.'
    },
    keep: {
      severity: 'ok',
      configured: 'First-pass review retained as a manual step.',
      consequence:
        'The judgment survives. It remains undocumented and resident in one person who does not take leave, ' +
        'which the report does not address unless the justification says so.'
    },
    eliminate: {
      severity: 'harm',
      configured: 'First-pass review removed. Claims pass straight to adjudication.',
      consequence:
        'Every repeat copy is adjudicated as a fresh claim. Duplicate payments at volume, immediately.'
    },
    cannot_assess: {
      severity: 'dodge',
      configured: 'Flagged for a second study. No change at go-live.',
      consequence:
        'No harm fires, but the participant had full access to this desk. Escaping the decision is not making it.'
    }
  },
  log: {
    eliminate: {
      severity: 'ok',
      configured: 'Receipt log discontinued.',
      consequence: 'A day of latency and roughly six hours of daily effort come out of the front end.'
    },
    automate: {
      severity: 'partial',
      configured: 'Receipt log generated automatically at intake.',
      consequence:
        'The effort goes away and the latency mostly does. A control with no reader is now maintained at no cost, ' +
        'which is cheaper than the alternative and still not a reason to have it.'
    },
    keep: {
      severity: 'miss',
      configured: 'Receipt log retained as-is.',
      consequence: 'Ten years of daily work answering a question nobody has asked since the address was corrected.'
    },
    cannot_assess: {
      severity: 'dodge',
      configured: 'Flagged for a second study.',
      consequence: 'Terry answers every question about this log truthfully. The access was there.'
    }
  },
  vendor: {
    cannot_assess: {
      severity: 'correct',
      configured: 'Flagged. Vendor terms and error rates requested before configuration.',
      consequence:
        'Correct. Nobody inside Wexford can describe what happens between sending a fax and receiving a file. ' +
        'Recording that as a gap is the only defensible position available.'
    },
    keep: {
      severity: 'miss',
      configured: 'Vendor arrangement carried forward unchanged.',
      consequence:
        'A two-day round trip and an unexplained routing rule are migrated into the new platform on the assumption ' +
        'that nobody flagging it means nobody has a problem with it.'
    },
    automate: {
      severity: 'miss',
      configured: 'Conversion brought in-house under the new platform.',
      consequence:
        'Possibly correct, but recommended without any knowledge of the vendor\'s volume, terms, or error rate.'
    },
    eliminate: {
      severity: 'miss',
      configured: 'Vendor contract terminated.',
      consequence: 'Four hundred faxes a day now have nowhere to go. Recommended without visibility into the step.'
    }
  },
  intake: {
    automate: {
      severity: 'ok',
      configured: 'Continuous intake. Batching removed.',
      consequence:
        'The largest single delay in the front end comes out. Whether this addresses the re-send volume depends ' +
        'on whether the report also asked for acknowledgment.'
    },
    eliminate: {
      severity: 'partial',
      configured: 'Release schedule removed; channels consolidated.',
      consequence: 'Directionally right on the delay, vague about what replaces it.'
    },
    keep: {
      severity: 'miss',
      configured: 'Twice-daily release carried forward.',
      consequence:
        'An overnight wait on anything arriving after 2:00 is migrated into the new platform as a designed feature.'
    },
    cannot_assess: {
      severity: 'dodge',
      configured: 'Flagged for a second study.',
      consequence: 'Ray answers every question about this step plainly. The access was there.'
    }
  }
};

// Evidence markers. Each identifies a specific delivered answer, not a
// bucket — a participant who asked the right bucket and got the first
// variant did not necessarily hear the thing that matters.
//
// These are NOT used to grade the root cause. They tell the instructor
// what the participant could have known, so the human reading the root
// cause knows whether a right answer was reasoned or guessed.
const EVIDENCE = [
  {
    id: 'no_reply',
    actorId: 'ray',
    label: 'Nothing goes back to non-electronic senders',
    match: (t) => t.sourceId === 'ray' && t.answerKey === 'SENDER_PERSPECTIVE'
  },
  {
    id: 'invented_status',
    actorId: 'terry',
    label: 'Terry tells callers the claim has been processed',
    match: (t) => t.sourceId === 'terry' && t.answerKey === 'SENDER_PERSPECTIVE' && t.variant === 0
  },
  {
    id: 'log_unseen',
    actorId: 'terry',
    label: 'Terry has never seen anyone use the log',
    match: (t) => t.sourceId === 'terry' && t.answerKey === 'DOWNSTREAM_CONSUMER' && t.variant >= 1
  },
  {
    id: 'log_origin',
    actorId: 'terry',
    label: 'The log answers a problem last seen ten years ago',
    match: (t) => t.sourceId === 'terry' && t.bucket === 'PURPOSE_ORIGIN'
  },
  {
    id: 'resend_spacing',
    actorId: 'ruth',
    label: 'Repeat copies arrive six to ten days apart',
    match: (t) => t.sourceId === 'ruth' && t.answerKey === 'SENDER_PERSPECTIVE' && t.variant >= 1
  },
  {
    id: 'electronic_anomaly',
    actorId: 'ruth',
    label: 'Electronic claims almost never arrive twice',
    match: (t) => t.sourceId === 'ruth' && t.answerKey === 'EXCEPTION_HANDLING' && t.variant >= 1
  },
  {
    id: 'matching_judgment',
    actorId: 'ruth',
    label: 'Matching is judgment, and it is written down nowhere',
    match: (t) =>
      t.sourceId === 'ruth' &&
      ['EXCEPTION_HANDLING', 'COUNTERFACTUAL'].includes(t.bucket) &&
      t.postureAfter === 'OPEN'
  },
  {
    id: 'vendor_opacity',
    actorId: 'ray',
    label: 'Nobody inside can describe the vendor step',
    match: (t) => t.sourceId === 'ray' && t.bucket === 'TOOLS_SYSTEMS'
  },
  {
    id: 'batching_delay',
    actorId: 'ray',
    label: 'Anything after the 2:00 release waits until morning',
    match: (t) => t.sourceId === 'ray' && t.bucket === 'VOLUME_TIMING'
  }
];

// Holding both halves is what makes the loop available. Neither alone
// does anything.
const LOOP_PAIRS = [
  ['no_reply', 'resend_spacing'],
  ['no_reply', 'electronic_anomaly'],
  ['invented_status', 'resend_spacing']
];

module.exports = { DISPOSITIONS, ROWS, OUTCOMES, EVIDENCE, LOOP_PAIRS };
