# Handoff — RapidSim+ 01

Akshay — two things here, and the order matters.

## Build this first: the instructor transcript view

`PLATFORM_SPEC_transcript_view.md` in this folder. It is **platform
work, not sim work**, and it is what unblocks teaching. Sims 01 and 02
need the same screen, so building it once here saves building it three
times differently.

This is the priority. The sim below can sit.

## Then this: the RapidSim+ 01 engine

Complete and tested. A new sim, not a change to 01 or 02, standalone
with no dependencies. Nothing is waiting on it, so read it when you get
to it — but run the tests now so you know the package is sound:

    npm test          # 4 suites: classification, engine, report, guard
    npm run playtest  # both legal paths through the interviews
    node demo-report.js   # one full run into the instructor view

All four should be green before you change anything. If they aren't,
that's a Node version issue — built and tested on v22.

### Why the transcript view comes first

This sim's central failure is invisible to the person committing it. A
participant who asks the analyst one particular question closes her
permanently, then has a pleasant and cooperative conversation for the
remaining nine minutes and frequently reports her as helpful. There is
no way to teach that from memory. The debrief needs the transcript on
screen, so the sim cannot be run with a cohort until the view exists.

The engine already produces everything such a view would render —
`Session.summary()` and `review()` — so the adapter is a reshape, not
new logic. Building the view against a sim that is finished and stable
is easier than building both at once.

---

## What this sim is

A participant interviews three people at a claims administrator, fifteen
minutes each, hard stopped, then files a report that gets configured
against. The lesson is question formulation: a bad question costs a
fifth of a window and returns nothing useful, and one particular
question permanently closes the most important source. Everything in
here exists to make that cost real and then visible in the debrief.

Full design rationale is in `RapidSimPlus01_TPA_PaperPlaytest.md` and
the faculty guide. Read them when you need the why. You don't need them
to integrate.

---

## The one rule that matters

**None of this ships to the browser.** The phrasing bank encodes which
questions are worth asking, and the contracts contain every answer.
A participant with the developer console open would be reading the
answer key.

Classification, posture, clock, and report evaluation all run
server-side. The client sends a question string and renders an answer
string. That's the whole contract.

`harness.html` violates this deliberately — it's a review build so
Vikram can play it, and it says so at the top of the page. Do not treat
it as a reference implementation for the client. Edit
`harness.template.html` if you touch it at all; `harness.html` is
generated and will be overwritten.

---

## Integration surface

Three calls. That's it.

```js
const { Session } = require('./src/engine');
const { validate, review } = require('./src/report');

const s = new Session().chooseOrder(['terry','ray','ruth']); // throws if illegal
const turn = s.ask('Why does the log exist?');   // -> { answer, remaining, ... }
s.advanceWindow();                                // -> { done } | { window, sourceId }

validate(submission);              // -> { ok, errors[] }
review(submission, s.transcript);  // -> instructor view
```

`Session` is plain serialisable state — `order`, `windowIndex`,
`remaining`, `posture`, `askCounts` (a Map), `transcript`. Persist it to
Redis between turns the way 02 does. The `askCounts` Map needs
`[...map]` on the way out and `new Map(arr)` on the way back; everything
else is JSON-clean.

Rehydration matters more here than in 01 or 02, because faculty may run
this across two sessions on different days and possibly different
machines. A participant who loses their transcript has lost half the
exercise with no recovery path. Worth building properly rather than
tolerating.

---

## Things that will bite you

**The phrasing bank is ordered and the order is semantic.** It looks
like a list that wants alphabetising. Sorting it makes routine
documentation questions close the analyst and end runs. `guard.js`
enforces every ordering constraint with the reason attached — run it
after any edit to `data/phrasings.js`.

**The carve-out at the top of the bank is load-bearing.** "Is any of
this automated already?" asks what the process does today. "Could this
be automated?" asks what should replace it. Only the second should close
Ruth, and a bare match on `automat` cannot tell them apart. The first
entry in the bank exists solely to claim the present-tense phrasings
before the efficiency bucket sees them.

**A closed source answers every bucket from one rotation.** So its
variant index counts position in that rotation, not in the bucket's own
answers. Anything keyed on `variant` must also check `answerKey`, or you
credit a participant with an answer they never heard. The guard fails
any evidence marker that tests `variant` without it. This one already
shipped a false positive in development and the tests caught it.

**The calendar computes its legal orderings.** It does not list them. If
you change `AVAILABILITY`, the set of legal paths changes with it and
the tests will tell you the new count. Don't hardcode the two paths
anywhere.

**Costs are the lesson.** A generic opener is 180 seconds against a
900-second window. If that gets tuned down, the sim stops teaching. The
guard asserts it stays the most expensive bucket.

---

## The API layer

Written against Sim 02's conventions — same `lib/launch.js` shape, same
KV command form, same action-switched endpoints, no dependencies.

    lib/launch.js   verifyLaunch, signBack, reportCompletion, reportTranscript, announce
    lib/guard.js    checkAccess, whoIsPlaying, announceOnce
    lib/meta.js     what the platform is told when this registers itself
    lib/run.js      the only place that touches the store, and the client view
    api/session.js  state / choose / next / leave / break / reset
    api/ask.js      one question
    api/report.js   the report, then transcript + completion
    api/health.js

`test/api.test.js` drives the real handlers through a full run including a
between-meetings break — 18 tests, no network, memory store.

Three things in there that matter:

**`lib/run.js` `view()` is the only thing the browser ever sees.** No
bucket, no posture, no marker. A test asserts the ask response contains
none of them. A participant who learns the taxonomy exists starts hunting
categories, and one who can see a door shut has been handed the debrief.

**`break` seals the current appointment.** Without it a participant
finishes at home and the availability calendar constrains nothing.

**Both callbacks are awaited.** A serverless function can be frozen the
moment it responds, and Sim 02's comments record that the completion
report already had exactly this fault. A transcript that never leaves the
machine takes the debrief with it.

Two differences from Sim 02, both deliberate. Its KV TTL is 48 hours and
it has no resume at all; this one is 30 days, because a Tuesday-to-Thursday
split would expire at precisely the wrong moment. And `SIM_URL` must be
set to the platform-proxied address or launches land on the catalogue.

## Not built

- **Instructor transcript view — platform side.** Storage, access
  scoping, cohort listing. The sim-side half is now done: `src/transcript.js`
  builds the envelope the spec describes, `data/simmeta.js` holds the five
  declarations it asks each sim for, and `src/render-transcript.js` is a
  reference renderer that consumes the envelope and nothing else. Run
  `npm run transcript` to see two sessions rendered side by side, and read
  `envelope-sample.json` for the exact shape to store.

  Two properties to preserve when you build the real surface. The envelope
  holds no answer text — events carry an `outputRef` that resolves against
  the sim at a matching `simVersion`, so a transcript-store leak is not an
  answer-key leak. And a repeat question in the same bucket returns a
  different line, so the view must show which reply was delivered, not just
  which bucket was asked, or you will credit participants with answers they
  never heard.
- Session persistence across days for the split-session format. Matters
  because faculty may run this over two class meetings, possibly on
  different machines, and a participant who loses their transcript has
  lost half the exercise with no recovery path.

The intro brief and partial chart are written — `INTRO_BRIEF.md`. The
chart is deliberately incomplete in three specific places and the
blanks are load-bearing, so render them as blanks rather than tidying
them away.

---

## Also

GitHub App still isn't installed, so nothing here auto-deploys and every
deployment needs a manual trigger. Still the most useful infrastructure
fix available, and it'll bite immediately once this is in the repo.
