# RapidSim 04 — Whose Number Is Right?

The complete specification and the original handover are in this folder. The
account data, five sheets and calculation engine are copied unchanged from the
handover. `node test/gate-data.test.js` checks those source materials.

## Flow

Classroom play. Students join the instructor's room with their email (taken from
their RapidSims account, or typed on the direct route) and wait under Unassigned,
reading the untimed "What happens today" introduction. The instructor sets a group
size, presses Divide randomly, and drags people between groups (a Move menu does
the same on a phone or tablet). Any number of groups may play, even one; the
projector fills unused definitions with labelled worked examples. Only the
instructor's Start begins the clock. Faculty use personal codes (`FACULTY_CODES`,
`Name:code` pairs); a shared `FACULTY_CODE` is refused and fails `/api/health`.
The detailed flow:

1. A facilitator creates a room, explicitly choosing team or individual mode
   and at least three groups. The clock defaults to 25 minutes.
2. Participants use the signed platform invitation. In team mode, joiners are
   placed in the smallest group automatically; the facilitator can move them
   before starting. In individual mode, one person occupies each numbered slot.
   Empty groups or seats are removed at start, with at least three filled slots
   required. The remaining slots receive sheets A, E, D, C, B in repeating order,
   even if lobby moves left gaps in the original group list.
3. Materials stay hidden until the facilitator starts the clock. Students then
   see the briefing, sortable records, CSV downloads, and only their
   own assigned definition. A percentage to one decimal and confidence from 1
   to 5 lock atomically; a second submission cannot change it.
4. Once everyone commits or the clock expires, the facilitator reveals all
   figures at once. The next stage reveals each sheet, department and worked
   calculation. Two groups can be compared side by side.
5. The private calculation check is `/private-check.html?session=ROOMCODE`.
   The console footer links to it; open it privately on the instructor's device.
   Signed faculty access travels in the URL fragment when opening a new tab.
   Completing the room reports launched participants to the platform; the instructor can retry a
   failed callback.

For direct access, students enter `ACCESS_CODE` and then the five-character
room code created by the instructor. A standalone invitation link carries the
room code but still asks for the student access code. Instructors use the link
on the access page and enter `FACULTY_CODE` (or one of `FACULTY_CODES`) once to
create or reopen a room. A student access code does not grant instructor access.
Signed platform launches go directly to the appropriate student or instructor
view without a separate direct-access code.

## Checks

Run `npm test` and `npm run build` from `sim04/`. These use Node 20 or later
and install no dependencies. The test covers the full three-group flow and
the seven-group sheet cycle, automatic assignment, lobby moves, empty-slot
removal, private-check authentication in a new tab, self-paced entry, private
run ownership, staged debrief access and student completion delivery. The build checks student
bundle leaks, spoiler wording, forbidden terms, config and deployment wiring.
Runtime diagnostics are available through
`/api/health` with `x-health-key` when `HEALTH_SECRET` is set.

## Deployment

Create a separate Vercel project with **Root Directory `sim04`** and stable
alias `sim04.vercel.app`. Set the variables in `.env.example`: an explicit
`SIM_URL=https://rapidsims.flexee.org/sim04`, matching `LAUNCH_SECRET`,
`PLATFORM_URL`, Upstash Redis REST credentials and `HEALTH_SECRET` are required
for platform sessions. Use a dedicated `ACCESS_CODE` and `FACULTY_CODE` (or
`FACULTY_CODES`) only if direct access is needed. The platform rewrite is
prepared in `platform/vercel.json`. Registration creates Sim 04 as unpublished;
an administrator publishes it after reviewing the catalogue and verifying
there is no preexisting `rapid-04-whose-number` row.

The source ZIP asked for a Next.js front end, while current RapidSims projects
use dependency-free static pages and Vercel Node functions. This implementation
uses the existing deployment convention, so the shared launch and session
contract remains consistent. It does not change the locked data or copy.
