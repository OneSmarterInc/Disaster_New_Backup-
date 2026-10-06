# RapidSim+ 01 — classifier and session engine

Increments one and two. Server-side only: no part of this ships to the
browser, because the bank encodes which questions are worth asking and
that is the thing participants are supposed to work out.

    npm test             # all four suites
    npm run playtest     # both legal paths, end to end
    npm run harness      # regenerate harness.html, then open it in a browser

    node test/run.js         # 115 classification cases, exits 1 on CRITICAL
    node test/engine.test.js # 19 engine tests incl. leak checks
    node guard.js            # bucket coverage + ordering invariants

## Files

    data/phrasings.js    ordered bucket patterns — ORDER IS SEMANTIC
    data/contracts.js    scripted answers, per character, per posture
    data/calendar.js     availability; legal orderings are COMPUTED
    data/report.js       report schema, outcomes, evidence markers
    data/simmeta.js      what this sim declares to the transcript view
    src/classifier.js    normalise + first-match-wins classify()
    src/engine.js        clock, window state, posture machine, transcript
    src/report.js        validation, consequences, evidence analysis
    src/store.js         session persistence; memory + Upstash adapters
    src/transcript.js    Session -> platform envelope, plus a resolver
    src/render-transcript.js  reference renderer; envelope only
    test/corpus.js       90 natural questions
    test/adversarial.js  29 cases built to break the bank
    test/engine.test.js  clock, posture, escalation, leak, summary
    test/report.test.js  validation, harm, dodges, reasoned vs lucky
    test/transcript.test.js  envelope shape, no-text invariant, reachability
    test/store.test.js   round trip, sealing, cross-device resume
    test/run.js          harness, misroutes graded by severity
    guard.js             build guard
    playtest.js          scripted run of both legal paths
    demo-report.js       one run, end to end, through the instructor view
    demo-transcript.js   two runs side by side -> transcript.html
    build-harness.py     generates harness.html from the sources above
    harness.template.html  UI shell; /*__ENGINE__*/ is the inject point
    harness.html         GENERATED — playable review build, do not edit

## Severity

Misroutes are not equal. CRITICAL means a question landed in
EFFICIENCY_FRAMING that shouldn't have, which closes Ruth permanently
and ends the run. HIGH means a door-opening bucket was missed or a
question fell into GENERIC_DESCRIPTIVE and cost three minutes. LOW is a
90-second cost with no state change. The harness exits non-zero only on
CRITICAL.

## The carve-out

The first entry in the bank returns TOOLS_SYSTEMS and exists solely to
sit above EFFICIENCY_FRAMING. "Is any of this automated already?" asks
what the process does today; "could this be automated?" asks what should
replace it. Only the second is scoping, only the second should close
Ruth, and a bare /automat/ match cannot tell them apart. Removing the
carve-out makes a routine documentation question end a run.

## Posture

Ruth alone has posture. GUARDED opens on EXCEPTION_HANDLING,
COUNTERFACTUAL or SENDER_PERSPECTIVE; any state closes permanently on
EFFICIENCY_FRAMING; AMBIGUOUS_PRESSURE moves her nowhere. The transition
resolves BEFORE the answer lookup, so a guarded Ruth asked a door-opening
question answers in her open voice — the shift is never announced.

## Repeat escalation

Answers are arrays. A repeat question in the same bucket advances the
index and the last entry repeats forever. This carries Terry's audit
guess cracking only on a second ask, Ruth's sender answer escalating
across three, and the closed rotation.

## Leak tests

A closed Ruth is probed with 20 questions and asserted to emit none of a
protected-term list. The list and the detector are the same array in the
same file — a written list that has drifted from the regex enforcing it
is how markers ship undetected.

## The report

Four dispositions plus a required free-text root cause. Dispositions are
what the vendor configures against; the root cause is what reveals
whether anything was understood, and it is never machine-graded.

Harm fires from the review row alone. `cannot_assess` is correct on the
vendor row and a dodge everywhere else, since those are rooms the
participant had full access to.

## Reasoned vs lucky

`evidenceHeld()` reports which specific answers were actually delivered,
so an instructor reading a correct-looking root cause can tell whether it
was reasoned or guessed. Nothing reads the prose. `keep` on the review
row is the safe disposition and can be reached with no understanding at
all; `support.review` says whether the participant ever opened Ruth.

Markers key on `answerKey`, not `bucket`. A closed source answers every
bucket from one rotation, so its variant index counts position in that
rotation and carries no bucket meaning — a marker testing `variant`
without guarding `answerKey` credits a participant with an answer they
never heard. The guard enforces this.

## harness.html — review build only

A playable single-page build for judging the sim before any of it is
wired to a server. It is NOT deployable: it inlines the phrasing bank
and the fact contracts into the page, which is exactly what production
must not do — a participant with the developer console open would be
reading the answer key.

It is generated from the same modules the tests cover, so it cannot
drift from the engine. `build-harness.py` strips the CommonJS wrappers,
concatenates in dependency order, and fails the build if any
`require(` or `module.exports` survives into the browser bundle.

Edit `harness.template.html`, never `harness.html`.

## Transcript envelope

`src/transcript.js` builds the envelope described in
`PLATFORM_SPEC_transcript_view.md`. `data/simmeta.js` holds the five
things the spec asks each sim to declare — phases, classification
labels, transition kinds, reachability, outcome mapping.

**The envelope contains no answer text.** Events carry an `outputRef`
and the text resolves at render time from the sim at the matching
`simVersion`. A leak of the transcript store is therefore not a leak of
the answer key, and a transcript read against a revised sim fails loudly
rather than misleading the reader. A test asserts no scripted line
survives serialisation.

The resolver is a separate function passed to the renderer. Omit it and
the timeline renders without answers — a legitimate deployment, not a
degraded one.

`src/render-transcript.js` is a reference renderer with no access to the
engine, the contracts, or the bank. If it produces a useful debrief
screen from the envelope alone, the contract carries enough for the
platform to build against. `npm run transcript` writes `transcript.html`
(two sessions side by side) and `envelope-sample.json`.

### One rendering requirement

A repeat question in the same bucket returns a different line. The view
must show WHICH reply was delivered, not merely which bucket was asked,
or an instructor will credit a participant with something they never
heard. `outputRef` carries the variant index and the reference renderer
labels it.

## Persistence and the split session

`Session.toJSON()` / `Session.fromJSON()` round-trip everything the sim
depends on: transcript, posture, and `askCounts` — the last of which
matters because losing it would reset repeat escalation and hand a
resumed participant an answer they already had.

**Stored state carries no answer text.** The transcript keeps `answerKey`
and `variant`; the line is resolved from the contracts on rehydration. A
dump of the session store is not a dump of the answer key, and the guard
fails the build if any scripted line reaches stored state.

`seal()` closes a window for good and survives the round trip. That is
what makes the split format honest — without it a participant simply
carries on at home and the availability calendar stops constraining
anything.

**The clock is spent by asking, not by the wall.** Closing a browser
costs nothing and a participant may think as long as they like between
questions. Thinking time is not the resource being taught, and
wall-clock decay would mean a dropped connection costs someone their
window.

The key is `rapidsim:<simId>:<userId>`, derived from the identity the
platform already signs into the launch token — so resuming on another
machine a week later is signing in, with no resume code to lose.
`STATE_VERSION` is checked on load: state from a different engine is
reported stale rather than half-understood.

`RedisStore` speaks Upstash's REST API with a thirty-day TTL. A
Tuesday-to-Thursday gap must not be able to expire a session.

## Not built yet

Intro brief and partial chart. Instructor transcript view — that wants
its own platform spec, since Sims 01 and 02 need it too.

## Faculty playback and deployment diagnostics

Faster observation playback is available only when the server verifies a faculty or faculty-preview launch (including supported legacy launch IDs), or a configured standalone faculty credential is explicitly supplied in `x-faculty-code`. The `faculty=1` URL flag grants no capability. Student playback remains 1×. Current question-starter behavior and the 180-minute catalogue setting are unchanged pending the teaching-format decision.

Set `HEALTH_SECRET` to the platform's dedicated diagnostic key, not its `LAUNCH_SECRET`. Health never registers or changes a run. Keep the current legacy `SIM_URL` alias until its identity migration is reviewed; without an explicit URL, registration uses `PLATFORM_URL + /simplus01`. Follow `../docs/sim-identity-migration.md` before publishing the new canonical catalogue identity.
