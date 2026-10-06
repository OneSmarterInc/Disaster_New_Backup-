# Midland calibration — floor-4 pilot

New defaults: annual budget 9, Run minimum 4, other-line annual cap 3.
All are in `config/thresholds.json`, alongside the ten event thresholds.
The outcome narratives, buyer-interest rules and team roles are unchanged.

The actual engine enumerates 106 legal annual portfolios, or 11,236 ordered
two-year runs. Six attain the top band in all four events. Discretionary resources
are 10 across both years and the cumulative top-event requirements also need 10.
There is no spare discretionary budget in an all-top-event portfolio.

Every authored event band is reachable. Year 3 has **four**, not three, bands:

| Year 3 band | Legal two-year runs |
|---|---:|
| strong | 176 |
| data_no_room | 324 |
| pilot | 3,200 |
| weak | 7,536 |

These are enumeration counts, not predictions about student choices. A rare
all-top-event allocation is not a score, a correct answer, or proof that the
teaching design works. Retain the pilot as provisional and observe a facilitated
class before retuning. Do not promise that someone in each section will find it.

## Guards and session behavior

`tools/calibration-check.js` checks properties rather than pinning the six winners:
positive but at most 20 all-top-event runs, no positive resource slack, and every
authored band reachable through legal allocations. It also tests the floor-3,
floor-5 and cap-2 failure cases. Faculty edits use these same checks on the server;
malformed inputs and unreachable/gapped bands are rejected before saving.

A session stores its own full calibration. Faculty can edit it only in the lobby,
without redeploying. Start/control and calibration writes are atomic, preserving
both the calibration lock and the existing session expiry policy. Participant
responses contain only public allocation constraints, not future thresholds.

Pre-pilot sessions without budget fields use `config/legacy-thresholds.json`.
Do not edit that compatibility snapshot. They keep their original outcomes and
allocations. Already-open pre-pilot standalone pages can still complete without
a configuration ID. New standalone pages send a fingerprint; unknown fingerprints
are rejected with `calibration_changed`, never silently evaluated under new rules.
A future default-config deployment should preserve prior standalone fingerprints
or be scheduled outside active standalone runs. Session-based sections are pinned.

## Test entry points

`npm test` discovers the dependency-free check tools, including calibration and
handler compatibility tests. `npm run build` retains those checks too.
`npm run test:browser` requires Playwright, Chromium, agent-browser and disposable
Redis; missing prerequisites fail. The existing GitHub browser job already used
`--required` and still does. Never run browser tests against production Redis.
