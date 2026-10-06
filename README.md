# Flexee RapidSims

Two deployments in one repository.

## sim/

RapidSim 01 — Disaster or Breach? A twenty-minute simulation where students run
an IT incident and take advice from four AI characters whose professional
exposure runs in opposite directions.

The scenario lives server-side in `lib/scenario.js` and never reaches the
browser: the ground truth, every character's knowledge and prohibitions, and the
debrief. A student who reads the page source learns nothing about how it ends.

Runs standalone, or as a facilitated session with join codes, grouping, a shared
clock the instructor can freeze, and a side-by-side comparison of every group's
positions.

Needs `ANTHROPIC_API_KEY`, `ACCESS_CODE`, `FACULTY_CODES`, and an Upstash Redis
store for session state.

## sim-02/

RapidSim 02 — What Did It Tell Them? A customer-facing AI assistant gave a
customer a specification figure from a superseded datasheet, and the parts are
in service. Either the document library is carrying stale revisions, or a
routing change stopped the question reaching an engineer. Both are true.

The first sim to branch: the third moment differs depending on whether the
student stopped an overnight re-index before it overwrote the evidence. The
hold can be recorded as an action or simply instructed in conversation, which a
classifier adjudicates at the close of each earlier moment.

Same environment variables as `sim/`, its own Vercel project with Root
Directory `sim-02`.

## platform/

Catalogue, faculty accounts, courses, student enrolment and entitlement.

The platform never hosts a sim. It signs a short-lived launch token saying who
someone is and in what capacity; the sim verifies it with a shared secret. That's
the whole contract between them, which is what lets each sim stay a small
independent deployment.

Payment is handled outside the system. A faculty member marks a student or a
whole section as paid, and that flag is what unlocks a launch.

Needs Postgres, `LAUNCH_SECRET`, and `PUBLIC_BASE_URL`.

## docs/

Design and specification documents: the RapidSim 02 scenario, the engine
changes it needed, the platform pre-publication access spec, and the handoff
notes.

## Deploying

One Vercel project per folder, each with its Root Directory set — `sim`,
`sim-02`, `platform`. Each redeploys only when its own folder changes.

Every sim shares `LAUNCH_SECRET` with the platform. Operator diagnostics use a
separate `HEALTH_SECRET`, shared by the platform and all ten sims. Public
`/api/health` responses report liveness only. Send the diagnostic key in the
`x-health-key` header; never put it in a URL. See
[the integration fixes and rollout notes](docs/integration-fixes-2026-09-28.md).
