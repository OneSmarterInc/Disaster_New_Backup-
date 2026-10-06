# RapidSim 07 — Would You Have Bought It?

Autumn 2000. Students run the largest video rental chain and decide whether to buy a small,
loss-making DVD-by-mail company for $50M, on the evidence of the time only. The next ten
years then arrive in three stages (2002, 2005, 2010), with each student's own written
reasoning pinned above them. The companies are named only in the final stage.

Deploy as its own Vercel project with **Root Directory = `sim07`**. Self-registers as
`rapid-07-bought` (unpublished until an administrator publishes it).

## Surfaces
- `launch.html` — router and standalone access-code gate
- `/demo` — faculty-only walkthrough: no decision timer; immediate Next part controls
- `index.html` — student: briefing, four advisers, binding decision, recognition question, reveal
- `instructor.html` — presenter (private laptop): create session, clock, release stages, pick two responses
- `projector.html` — room display: aggregates only; never names or participant ids

## Endpoints
- `GET /api/config` — pre-reveal copy only (access-guarded)
- `POST /api/session` — faculty, projector and student actions
- `POST /api/reveal` — standalone (no session) reveal, served only after a full decision
- `POST /api/finish` — completion report to the platform (not scored)
- `GET /api/health`, `GET /api/join`

## Behaviour worth knowing
- Mode (individual/team) is required at session creation, no default.
- Decision clock 10 min (faculty can set 3–30). Timeout = decline, student writes one line.
- Reveal is instructor-released. If no console (presenter or projector) has polled for 90 s,
  stages auto-advance one per 90 s from that point; the stage never goes backwards.
- Standalone students see a 90-second countdown between reveal parts. A failed
  request shows an error and a Try again now button; temporary failures retry
  after 5 seconds. A request times out after 15 seconds instead of waiting forever.
- Team mode: private votes, majority decides, tie declines; each member writes their own reason.

## Checks
`npm test` (30 dependency-free checks, in-memory store) and `npm run build` (build gate +
checks). Node 20+. No npm packages required.

Content lives in `data/config.js`. The build gate refuses to ship if anything before the
reveal names the companies or points forward.

## Platform integration

See [`docs/sim07-sim08-integration.md`](../docs/sim07-sim08-integration.md) for
project setup, variables and the required platform route activation. Guest
class links need no extra access code; platform class links preserve account
and course access. Completion callbacks retry after a temporary failure.

## Faculty demo

Open `https://rapidsims.flexee.org/sim07/demo`, or select **Demo without timers**
from the platform faculty preview. The direct Vercel URL is
`https://sim07.vercel.app/demo`.

The demo accepts the faculty launch already verified by the API, or one of the
existing `FACULTY_CODES` (also `FACULTY_CODE`) configured on Sim07. A student
launch or `ACCESS_CODE` cannot open it. No new environment variables are needed.

Read the briefing, make a decision and answer the recognition question. Use
**Next part** to reveal each remaining stage immediately. The decision never
expires, the demo does not auto-advance, and it does not record a student
completion. Normal student and class-session pacing is unchanged.

Run `node platform/tools/new-sims-entry-check.js` from the repository root to
check reveal countdowns, recovery and demo entry with the real page scripts and
API handlers (Node VM, not a visual browser check).
