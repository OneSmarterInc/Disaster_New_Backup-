# RapidSim 08 — Eighteen Months Later

The student, or a team, is the selection committee at Brookfield Veterinary, a
four-clinic practice replacing its scheduling system. Three vendors, each
defensible, each with one hidden adoption risk. The committee sees the prepared
demonstrations, spends six questions from a menu of sixteen, commits to a
vendor, then to one go-live plan. The sim jumps eighteen months and reports
what happened.

Deploy as its own Vercel project with **Root Directory = `sim08`**. It
self-registers as `rapid-08-later`, unpublished.

## What lives where

`config/content.js` holds every word the student or instructor sees: the
briefing, the shortlist, the sixteen questions with all forty-eight answers and
their routes, the four go-live plans, the twelve reports, the notes that wrap
them, and the debrief. Change copy there, never in code.

`lib/engine.js` is pure. A vendor's risk counts as found with one direct answer
or two partial ones among the questions spent. The report is the authored cell
for vendor × (found, right plan). Ties and missing votes resolve by rule: the
board picks the cheaper vendor; a plan tie funds nothing.

`lib/room.js` is the room: one shared clock with pause, per-run question
budgets, private votes, the student view and the staged projector. Nothing is
written when a phase closes; the vendor and plan are computed from the votes on
record whenever they are read.

## Rules the code enforces

Mode is chosen at session creation with no default. Team is recommended. In
team mode the six questions are a shared budget any member can spend; the vendor
and plan are private votes and the majority decides. Teams are fixed at start.

Every question goes to all three vendors. Answers reach a browser only once
spent, and only the run that spent them. Plans appear only after the vendor
locks, so the list cannot hint at which questions to ask. The report appears
only when the clock reaches it. No score, tier label or ranking reaches a
student.

The projector shows counts during play. After the report opens it reveals in
four instructor-controlled steps (vendors, outcomes grouped by vendor with the
disagreement pair, questions and plans, where the warnings were), then naming
and the turn. Individual mode uses anonymous labels; late joiners play but stay
out of the comparison.

## Checks

`npm test` runs the build gate and every check in `tools/`, with Node 20 and no
dependencies:

- `build.js` refuses to pass if any answer, plan, report, risk or debrief text
  appears in a page, if a student page carries a tier label or scoring word, if
  an `/api` call lacks the path prefix, or if a page script does not parse.
- `content-check.js` refuses placeholders, banned words, asterisks, days of the
  week, course or institution names, names used by other sims, a reused sim id,
  quotes that don't add up, a risk with fewer than two direct and two partial
  routes, a diligence question with a direct route, and a plan list without its
  decoy.
- `engine-check.js` walks all 8,008 six-question spends against every vendor and
  plan, and asserts that diligence alone never finds a risk.
- `session-check.js` drives the real handlers against an in-memory store with
  compare-and-set semantics and a controllable clock.

## Platform integration

See [`docs/sim07-sim08-integration.md`](../docs/sim07-sim08-integration.md) for
project setup, variables and the required platform route activation. Guest
class links need no extra access code; platform class links preserve account
and course access. Completion callbacks retry after a temporary failure.
The three supplied authored reference documents are retained in `docs/`.
