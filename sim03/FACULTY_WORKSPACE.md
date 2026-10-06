# SIM03 faculty workspace

## Faculty flow

Open or resume the saved session. A session not yet started opens **Manage session**;
a running or closed session opens **Team results**. The two tabs always refer to the
same session and its saved records.

For platform-linked team sessions, **approved course students** are imported into the
unassigned setup list on the next roster refresh. Students do not have to launch the
simulation first. Faculty can auto-split or create teams, move students, and choose
one lead per team. The lead is the default runner; the existing student runner
handoff is unchanged. Opening the simulation restores the saved team assignment.

The fixed bottom **Start session** action explains missing assignments or runners.
It does not require attendance. After a successful start, the workspace switches to
all team results. Pause, resume and close remain in Manage session.

## Reviewing results

**All team results** shows every team once, including not-started and in-progress
teams. Select a team to read its saved opening view, runner reflections, annual
allocations, event narratives and buyer outcomes. No sample data or new scoring is
used. Missing historical answers stay explicitly unavailable; members are not asked
to submit extra forms. Comparison uses two completed teams. Export has one row per
shared run, with all members identified; print includes all sections. Authored
class-debrief charts and calibration are retained in separate collapsed sections.

Search, selected team, answer tabs, focused drafts, advanced settings and comparison
are preserved during polling. Names and teams sort deterministically, not by update
time. Individual-mode runs retain their own completion and reflection semantics.

## Data and safety

Course approval, session assignment and attendance are separate. Imported students
have `joinedAt: null`; the signed-account join records actual attendance later.
Approved import uses Redis HSETNX and preserves saved assignments and outcomes.
Join and roster edits compare their snapshots atomically; a concurrent import or
join does not silently overwrite a lead or assignment. IDs, never display names,
identify people. Existing course/owner authorization is retained; grouping and
starting re-check approval server-side. Closed sessions are not imported or edited.

Late approvals enter the unassigned pool without reshuffling existing teams. An
unavailable course list is a retryable error, not an empty/approved list; results
can still be read. No data migration or production-data reset is required. Existing
48-hour session storage policy is unchanged.

## Verification

`npm test` in sim03 runs the original scenario, auth, runner and completion checks,
plus `tools/course-roster-check.js` and `tools/faculty-workspace-check.js`.
Platform account/lifecycle checks remain under `platform/tools`.
The browser CI runs the actual HTML and handlers over HTTP/HTTPS, real Secure
cookies, three student contexts, new pre-launch grouping and response-review tests,
mobile layout checks, and the production roster/run Lua against disposable Redis.
All fixtures use test-only accounts and storage, never production records.
