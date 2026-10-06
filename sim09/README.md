# RapidSim 09 — Where Does the Money Land?

It is late June 2000. A forecast says business purchasing is moving online and
says who will be paid for carrying it. Students (or teams) write two statements
before any money moves: what the forecast says about direction, and who it says
will capture the value. Then they place a $1,000,000 fund across five real
companies chasing the forecast, named only by descriptors. History arrives in
three stages, 2002, 2004 and 2010, released by the instructor, with each
student's own statements shown beside it. The names come with the last stage.

Deploy as its own Vercel project with **Root Directory = `sim09`**. It
self-registers as `rapid-09-money-land`, unpublished.

## What lives where

| Path | What it is |
|---|---|
| `config/content.js` | Every word a student or instructor sees, every figure and its source. Edit here, then `npm test`. |
| `lib/engine.js` | Pure: phases, the wall, the cash rule, fund values, display rounding, room aggregates. |
| `lib/room.js` | The room: shared clock, units (a student or a team), student and projector views, controls. |
| `lib/scenario.js` | `publicConfig()`: only what is safe before play. No stages, no names, no prices. |
| `api/session.js` | create, faculty_state, faculty_enrolments, group, control, solo, join, state, statements, allocate, advance. |
| `public/` | `launch.html` router, `index.html` student view, `instructor.html` console and projector. |

## Rules the code enforces

Mode is chosen at session creation with no default. Team is recommended: each
team shares one screen, writes one pair of statements and places one fund, and
the first press wins. Teams are fixed at start.

The wall is binding. Statements can only be written in the statement window and
lock when allocation opens. Direction and the destination reason need real
sentences, and the destination needs a structured pick.

Cash is allowed only when the destination pick names someone other than the five
(buyers, sellers, incumbents, or nobody in particular). A unit with no locked
statements cannot hold cash. Every dollar must be placed, in $50,000 steps.

Allocation is final. History is held after allocation closes until the
instructor releases it, one stage at a time, to the whole room. No stage text,
value or name reaches a browser before its release.

The student sees only their own unit. The projector shows nothing about
positions until allocation has closed; then it shows the room's money, the
destination picks, the most concentrated bet beside the most spread one, any unit
whose money contradicts its own destination, and the statements one at a time.

Displayed values: $0 is a wipeout, anything above zero and under $10,000 shows
as "under $10K", everything else rounds to the nearest $10,000.

A direct launch with no session gets a private solo run; the player moves it
along and reveals each stage themselves.

## Figures

Every entry price and stage value carries a source note and a basis (`filing`,
`record` or `estimate`) in `config/content.js`. Entry prices for four of the five
are quarter midpoints from the companies' own 10-K filings; the fifth is a
reported close. Four stage values are estimates; each displays as "under $10K"
across its plausible range.

## Checks

`npm test` runs, with Node 20 and no dependencies:

- `build.js` refuses to pass if any stage text, stage note, real company name,
  the epilogue or the Wharton card appears in a page, if an `/api` call lacks
  the path prefix, if a script does not parse, if a confirm step or the access
  gate is lost, if the instructor page pre-selects a mode, or if `vercel.json`
  sets `deploymentEnabled: false`.
- `content-check.js` refuses placeholders, banned words, asterisks, course or
  day names, a real name anywhere before the reveal, a stage value that is not a
  loss or has no source, a cash rule that lets a pick naming the five hold cash,
  and a briefing that stops stating the rules.
- `engine-check.js` covers phases, the wall, the cash rule for every pick, fund
  arithmetic, the agreed displayed values and the aggregates.
- `session-check.js` drives the real handlers through an individual room, a
  team room and a solo run against an in-memory compare-and-set store, and
  checks that no unreleased history leaks.
