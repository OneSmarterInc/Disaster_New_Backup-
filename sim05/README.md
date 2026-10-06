# RapidSim 05 — Would You Approve This?

The student is the product manager at Loopwell, a fitness app. Five data
features arrive one at a time, each with a sound business reason, and each is
approved or declined for good. After every round the student sees what Loopwell
can now work out about one customer, Dana Okafor. Nobody crosses a line, because
no single step is a line.

Deploy as its own Vercel project with **Root Directory = `sim05`**. It
self-registers as `rapid-05-approve`, unpublished.

## What lives where

`config/content.js` holds every word the student or instructor sees: the five
rounds, the inference table, the cost lines, the briefing, the endings, the
clock and the catalogue copy. Change copy there, never in code.

`lib/engine.js` is pure. What Loopwell can work out is computed from the set of
approved data using the inference table, so all 243 approve/decline/timeout paths
are covered without being authored one by one.

`lib/room.js` is the room: one shared clock with pause, final decisions for
students and teams, and the two views. Nothing is written when a round closes; a
missing vote is read as a timeout, and a timeout ships.

## Rules the code enforces

Mode is chosen at session creation with no default. Individual is recommended.
In team mode members vote privately, the majority decides, a tie ships, and a
member who hasn't voted counts as approving. Teams are fixed at start.

Every decision is final. A round's timeout counts as approval, and the briefing
says so. Reveals open for everyone when the round closes, never earlier.

The student sees only their own decisions and, in team mode, their own vote
beside the team's result. Rounds reach the browser one at a time. The projector
shows how many have decided while a round is open, never the split.

Students who join after round 1 closes play, but stay out of the room totals.
A direct launch with no session gets a private solo run with its own clock.

Direct visitors use `ACCESS_CODE` and enter a name; those private runs do not send
faculty completion records. Faculty invitation links bypass that access-code gate.
Platform class links still require the student's signed account and matching
course, and completion callbacks retry if the platform temporarily cannot accept
the result. Refreshing the student page retains the scoped launch token and run.

The lighter setting, chosen at creation, never names pregnancy anywhere.

## Before and during play

Students work through an untimed four-screen walkthrough while the room fills,
then press "I'm ready"; the lobby shows how many have finished. Nothing is timed
until the instructor starts. A one-minute recap precedes round 1, so play runs
about twenty-four minutes. Late arrivals see the walkthrough with a way straight
into the open round.

Each request shows the screen Dana would get in her app if it ships; a reveal
shows it live, or what is missing if declined. What changed in Dana's file appears
in the main column. During a decision the file is compact; tap a line to read it.

A round closes early once everyone has decided. The instructor can close the open
round or open the next one at any time. In a solo run the student starts their own
clock and can skip time they have no use for, but never an undecided round.
In team mode only students who actually joined are frozen into teams, so an absent
imported student can never outvote a team by silence.

Pregnancy is named only at high confidence, in either setting.

## Checks

`npm test` runs the build gate and every check in `tools/`, with Node 20 and no
dependencies:

- `build.js` refuses to pass if any round, reveal or cost text appears in a page,
  if a page uses the word "privacy" (instructor page excepted) or names the
  round-five inference, if an `/api` call lacks the path prefix, or if a page
  script does not parse.
- `content-check.js` refuses placeholders, banned words, asterisks, course or
  institution names, "privacy" in student copy, a reused sim id, and an
  inference table that stops being coherent.
- `engine-check.js` walks all 243 paths in both settings and asserts the agreed
  behaviours.
- `session-check.js` drives the real handlers against an in-memory store with
  compare-and-set semantics and a controllable clock.
