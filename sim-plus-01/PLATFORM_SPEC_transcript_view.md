# Platform spec — Instructor transcript view

**Scope:** platform feature, not sim feature
**Serves:** RapidSim 01, RapidSim 02, RapidSim+ 01, and everything after
**Status:** proposed, not built

---

## 1. Why this is a platform feature

Every sim built so far produces the same problem at debrief. A
participant reaches an outcome, and neither they nor the faculty member
can reconstruct why. The participant remembers a coherent story about
what they did. The transcript says something else.

RapidSim+ 01 makes this acute, because its central failure is invisible
to the person committing it. A participant who closes the analyst in the
first two minutes experiences a pleasant, cooperative conversation and
frequently reports her as helpful. Without a transcript on screen, the
debrief has nothing to work with but memory, and memory is exactly what
the sim proved unreliable.

Sims 01 and 02 have the same need in different clothing. Sequencing
under irreversibility only teaches if the participant can see the moment
the door shut. Graded disclosure only teaches if they can see what a
different question would have returned.

Three sims, one need. If it gets built inside RapidSim+ 01 it will be
built twice more, differently each time, and the faculty guide for each
sim will describe a different screen.

---

## 2. What it is not

Not analytics. No dashboards, no cohort averages, no scoring. The unit
is one participant's session, read by one instructor, shortly after they
played it.

Not participant-facing. Whether participants ever see their own
transcript is a separate decision with different privacy consequences,
and building it faculty-only first keeps that decision open.

Not a replay. The instructor does not re-run the session; they read what
happened.

---

## 3. Data contract

The platform stores and renders. Each sim declares its own vocabulary
and the platform stays ignorant of what any of it means.

### Event

The atomic unit. One participant action and what followed.

```
{
  ordinal:      1,
  phase:        "window-2",            // sim-declared segment
  actorId:      "ray",                 // who or what was addressed
  actorLabel:   "Ray Duffy",
  input:        "Do we send anything back to them?",
  classification: "SENDER_PERSPECTIVE", // sim's own vocabulary
  cost:         { amount: 90, unit: "seconds", remaining: 630 },
  stateBefore:  null,
  stateAfter:   null,
  outputRef:    "ray:SENDER_PERSPECTIVE:0"
}
```

`cost` is optional — Sim 01 has no clock. `stateBefore` / `stateAfter`
are optional and null where a sim has no posture equivalent.
`classification` is a free string; the platform never interprets it,
only groups and displays it.

`outputRef` identifies which authored response was delivered, not the
response text. The text lives with the sim. This matters: it keeps the
answer key out of the transcript store, so an instructor view leak is
not a sim leak.

### Transition

Derived, not stored separately: any event where `stateBefore !==
stateAfter`. Each sim declares how to render each transition.

```
{
  ordinal: 2,
  from: "GUARDED", to: "CLOSED",
  kind: "irreversible",               // "irreversible" | "gate" | "progress"
  label: "Ruth Kessler stopped volunteering",
  causedBy: "How much of this could the new system handle?"
}
```

`kind: "irreversible"` is the one the platform treats specially: it gets
visual emphasis and it anchors the timeline. Everything else is a sim's
own business.

### Reachability

The part that makes this pedagogically useful rather than merely a log.
Each sim declares a set of findings that were available, and the
platform reports which were reached.

```
{
  id: "resend_spacing",
  label: "Repeat copies arrive six to ten days apart",
  held: false,
  heldAt: null,                        // ordinal, when held
  blockedBy: "irreversible-transition" // optional, sim-supplied
}
```

Without this the view answers "what did they do." With it, the view
answers "what was there and what did they miss," which is the question a
debrief actually turns on. RapidSim+ 01 already computes this in
`evidenceHeld()`; Sim 02's graded disclosure ladder has the same shape.

### Outcome

Whatever the sim ends with, plus a severity the platform can style.

```
{
  summary: "First-pass review marked for automation",
  severity: "harm",                    // "harm" | "miss" | "ok" | "correct"
  detail:   "Denial letters go to patients for treatment they received.",
  artifacts: [ { label: "Report as filed", ref: "report:abc123" } ]
}
```

### Session envelope

```
{
  sessionId, simId, simVersion,
  participant: { id, displayName },
  cohortId, startedAt, completedAt,
  path: ["terry","ray","ruth"],         // sim-declared, optional
  events: [...], reachability: [...], outcome: {...}
}
```

`simVersion` is not optional. Sims get revised between cohorts and a
transcript read against the wrong version misleads the reader.

---

## 4. The view

One page per session, read top to bottom.

**Header** — participant, sim, when, path taken, outcome severity as the
only colour on the page.

**Timeline** — events in order, grouped by phase. Each row shows the
input as typed, its classification, its cost, and the running remainder.
Irreversible transitions break the timeline visually and carry the
sim-supplied label. This is the screen the debrief spends most of its
time on.

**Cost ledger** — where a sim has a clock, a proportional bar per phase
showing what each action consumed. The expensive-opener lesson in
RapidSim+ 01 is one enormous block at the start of a window, and that
reads faster than any number.

**Reachability** — two lists, reached and not reached, in the sim's own
words. Not a score.

**Outcome** — what followed, and any artifacts the participant produced.

**Comparison** — two sessions side by side, timelines aligned by phase.
Faculty asked for this implicitly every time they have described
debriefing a room: the teaching move is showing one transcript against
another. Worth building in the first version rather than the second.

---

## 5. Access

Faculty see sessions from cohorts they own. Nothing else.

This is the same shape as the `sim_access` grant table already specced
for pre-publication review, and it should reuse it rather than inventing
a parallel mechanism. A `transcript_access` scope on the existing grant
row is likely enough.

Two rules that need deciding rather than assuming:

**Cross-cohort visibility.** A faculty member running the same sim next
term has a legitimate interest in last term's transcripts for their own
preparation, and no legitimate interest in another instructor's
students. Default to own-cohort-only and revisit if asked.

**Participant identity.** Transcripts are identifiable by construction —
that is what makes them useful in a debrief. Whether they are retained
after the session, and for how long, is a policy decision, not an
engineering one. Recommend a default retention window with per-cohort
override, and no retention of `input` strings beyond it, since typed
questions are the most identifying content in the record.

---

## 6. Storage

Append-only. Events are written as they occur, not reconstructed at the
end, so a session abandoned midway still produces a readable transcript.
This matters for the split-session format, where a participant may not
return.

The envelope is JSON in Postgres. There is no volume problem here: a
session is a few dozen events and a cohort is a few dozen sessions.
Resist indexing it into a schema until something actually needs querying
across sessions.

Response text is never stored. `outputRef` plus `simVersion` resolves to
authored content at render time.

---

## 7. What each sim owes the platform

A small adapter, and nothing more:

- a phase vocabulary
- a classification vocabulary, for display only
- a `kind` for each state transition
- a reachability declaration
- an outcome mapper

RapidSim+ 01 can supply all five today. `Session.summary()` and
`review()` already return the substance; the adapter is a reshape, not
new logic. Sim 02's disclosure ladder maps onto reachability directly.
Sim 01 has no clock and no posture, so it supplies phases,
classifications, and an outcome, and the view renders without the cost
ledger.

---

## 8. Open questions

**Does the participant ever see this?** Argument for: the lesson lands
harder when read privately than when narrated at them. Argument against:
a participant who knows a transcript is coming plays differently, and
the sims depend on unselfconscious play. Recommend faculty-only until
there is evidence either way.

**Live or after?** An instructor watching sessions in progress could
intervene, and intervening would destroy the instrument. Recommend the
view unlocks at session completion.

**Comparison in v1 or v2?** I have argued v1 above. It is the actual
teaching move and building it later means rebuilding the timeline
renderer.

---

## 9. Sequencing

This blocks nothing in RapidSim+ 01's engine — that runs and is tested
without it. It blocks the sim being taught, because the debrief carries
the lesson and the debrief needs the screen.

So it is not urgent for the build and it is urgent for the first
cohort, which is a distinction worth being explicit about with Akshay.
