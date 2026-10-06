# One shared simulation, one selected runner

Instructor-managed team allocation and team-lead selection are unchanged. The
team lead operates the simulation by default. On the **student team screen**, the
lead can select any teammate under **Who will run the simulation for your team?**
and click **Assign runner**. Students agree on the choice; the lead records it.

The selected runner can commit the opening view and annual decisions and advance
screens. Everyone else, including a lead who delegated control, sees the shared
submitted decisions and results without independent simulation navigation.
Each student still submits their own reflections after the runner completes the
shared run.

## Handoffs

The lead can hand control to another current teammate in the lobby or during
play, including while paused. A handoff keeps submitted allocations, opening
view, shared screen, event position and outcomes. It does not transfer unsaved
local drafts. Previous runner requests are rejected; an assignment revision also
rejects stale requests if control later returns to the same student. Assignment
is closed after the shared run reaches completion or the instructor closes the
session. A runner moved out of the team falls back to the team's current lead.

The existing faculty console still manages team membership and **team leads**;
the student screen is the source for selecting/viewing the separate runner.

## Persistence and compatibility

The runner is stored once on the existing group run as `runnerId` with
`runnerRevision`. Existing runs without these fields default to the team lead.
Older open tabs using `claim_lead` must reload rather than changing leadership.
Deploy frontend and backend together; no separate database migration is needed.

Team writes use a Redis Lua compare-and-set over the run, session state and
roster. Handoffs, paused sessions and reassignments cause a conflicting write to
reread and reauthorize. Personal reflections use the same transaction, including
requests through `/api/finish`, to avoid lost updates.

This change retains the application's existing classroom participant-identity
model. It is not a new authentication system or a device/session lock: the same
selected participant can still open multiple tabs. Signed per-participant
credentials would be a separate hardening change for adversarial use.

## Verification

`node build.js` runs the existing engine, authorization, committed-decision,
access and story conformance suites, plus the runner handler and UI checks.
`node tools/team-handler-check.js` covers delegation, unauthorized member
requests, foreign-team targets, in-play handoff, stale revisions, competing
assignments, an in-flight submission losing to a handoff, individual reflections,
concurrent completion, paused/closed sessions and unchanged individual play.
`node tools/team-runner-ui-check.js` exercises the student script in a DOM fixture
for selection, observer gating, focus-time revocation, progress restoration,
out-of-order polling and draft reflection preservation.

For a classroom smoke test, use separate browser profiles for two students.
Assign both to a team, leave the lead as runner, then delegate to the teammate.
Confirm that only the teammate can commit decisions. Commit Year 1 and hand
control back: the new runner should resume with the same submitted allocation
and screen. Finish the shared run and submit different reflections from both
profiles. Check both responses in the instructor console.
