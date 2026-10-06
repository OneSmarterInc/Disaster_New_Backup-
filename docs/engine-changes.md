# RapidSim 02 — what has to change outside scenario.js

The scenario file is a drop-in replacement for `sim/lib/scenario.js`. Four things around it need work. Nothing here is committed.

## 1. `api/scene.js` — pass run state through

`sceneFor` now takes a second argument. The endpoint needs to accept run state on the phase request and hand it over:

```js
const state = b.state && typeof b.state === 'object' ? b.state : {};
return res.status(200).json({ scene: S.sceneFor(phase, state) });
```

Recompute rather than trust. `preserved` should be true if the recorded positions for phases 0 or 1 used the `preserve` action, OR if the classifier flagged a conversational instruction. The client can send its own view of the flag, but the endpoint should OR it with what the positions already prove, so a reload can't land someone in the wrong Day 2.

`preservedAt` is the earlier of the two, and it drives which of Joanna's three lines runs. `rolledBack` is true if `rollback` was taken at either earlier phase.

## 2. `src/engine.js` — send state, hold the flag

Three small additions alongside the existing `coverageEarnedAt` pattern:

- `S.preserved`, `S.preservedAt`, `S.rolledBack` in the run state object at the top.
- Set them when a position is recorded (`preserve` and `rollback` action ids).
- Send `state` on the phase-3 scene request.

The flag is sticky: once `preserved` is true it never goes false.

## 3. The classifier — one call per phase close

Only adjudicates the conversational route; the action route sets the flag directly. Runs at the close of phases 0 and 1, over that phase's bridge and private transcripts.

Ask one narrow question: did the VP instruct anyone to hold, delay, pause or otherwise stop the scheduled re-index, or to preserve the current index state before it runs. Return `{"held": true|false, "quote": "the sentence it matched on"}`.

The prompt must draw two lines explicitly, because both are common at Hour 7:

- A question is not an instruction. "What happens if we re-index?" is false.
- Holding something else is not holding this. "Let's hold off on notifying the nine" is false.

On failure, default to `held`. A student who did instruct a hold and lands in the `ran` branch experiences the sim as broken; a student who didn't and lands in `held` gets a slightly gentler Day 2 and a debrief that accuses them of nothing. Worth revisiting if playtest shows the default firing often.

Store the quote. The debrief uses it, and it's how you diagnose a wrong branch when someone reports one.

## 4. `build.js` — replace the forbidden list

The current list checks for RapidSim 01 strings that don't exist in this sim, so it would pass clean on an empty audit. Replace with:

```js
const forbidden = ['deflection', 'Revision C', 'week three', 'GROUND_TRUTH', 'KNOWLEDGE', '02:00'];
```

## 5. Debrief — four outcomes, not two

`api/debrief.js` needs its `EVIDENCE` array rewritten for this incident, and the coverage branch becomes a preservation branch on the same pattern as Sophia's ladder:

- Preserved at Hour 1, before anyone mentioned a schedule — almost nobody does this.
- Preserved at Hour 7, after the scope landed or after Nadia gave up the job.
- Not preserved, index rebuilt — name what it cost in counsel's actual question.
- Preserved but never used — they held it and then never asked Devin to reconstruct.

Devin's ladder detection follows Sophia's regex pattern, tightened to tier-three markers only, since his tier two touches the same subject:

```js
/deflection|seventy per ?cent|70 ?%|week three|nobody reviewed|no.?one reviewed|my call|uneasy since/i
```

## Before any deploy

Two checks from the RapidSim 01 list, both of which caught real bugs: the static check for called-but-undefined functions, and booting the client against a stubbed DOM. Syntax checks won't catch either failure.
