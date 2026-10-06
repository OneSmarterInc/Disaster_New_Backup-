# RapidSim 03 — Midland Equipment

Midland Equipment is the architecture-week RapidSim. A student allocates a fixed
technology budget across two years, then sees deterministic consequences in Year 1,
Year 2 and a final Year 3 they can no longer influence.

This folder is intentionally isolated from `sim/` and `sim-02/`. Deploy it as its own
Vercel project with **Root Directory = `sim03`**.

## Runtime contract

The deployment uses the same platform contract as the existing RapidSims:

- `LAUNCH_SECRET` verifies platform launch tokens and signs registration/completion.
- `PLATFORM_URL` is the RapidSims platform base URL.
- `SIM_URL` is the canonical address that should be stored in the catalogue.
- `ACCESS_CODE` is an optional standalone fallback.
- Upstash/Vercel KV stores facilitated sessions, teams and instructor-view data.

The sim self-registers as `rapid-03-midland`. It does not replace or delete any
other simulation identity. Wexford registers separately as `rapidsimplus-01`;
legacy catalogue history is retained for a reviewed migration.

## Play modes

Faculty must choose **Individual** or **Team** when creating a facilitated session.

- Individual: each participant owns one run.
- Team: faculty assign participants to teams. The team lead selects one runner (the lead or a teammate);
  only that runner commits, while teammates see the shared state and result.

Direct platform launches remain supported and run as an individual entitlement unless
a future platform token supplies a session/mode.

## Calibration

Budget, Run minimum, caps and outcome thresholds are defined in
`config/thresholds.json`. The provisional defaults are **9 / 4 / 3**. Faculty may
edit a session's copy in the lobby without a deployment. Validation checks the
complete legal-run space before saving, including all four Year 3 outcomes.
Once the session starts, its settings are locked; concurrent start/edit requests
use an atomic comparison so neither can overwrite the other's state.

Existing sessions without the three budget keys retain the immutable settings in
`config/legacy-thresholds.json`. Pre-pilot standalone pages without a calibration
ID retain their original rules. New standalone pages send a configuration ID;
an unknown ID is rejected rather than silently changing the rules.
See [CALIBRATION.md](CALIBRATION.md) for the pilot results and limitations.

## Authored Year 3 and buyer content

The formerly open Year 3 calibration case is now authored as `data_no_room` when
Connect reaches the strong threshold but Capacity does not. The buyer stage is also
authored: Carrolton Systems, Ridge Hollow Partners and Corven Building Systems each
return a deterministic `high`, `qualified` or `low` interest verdict without a
dollar valuation, total, ranking or winner.

## Classroom readiness

Before a class uses this sim, run one real facilitated **Team** session with two or
three devices. Exercise the platform launch, Upstash-backed session state, captain
commit behavior, pause/resume, completion reporting, student result return and the
instructor console together. The production health endpoint confirms that the
configuration is present; this rehearsal confirms that the whole path actually works.

Post the briefing packet about a week before class. The app gives students a reference
copy, but the teaching design still assumes they arrive having read it.

A rare all-top-outcome portfolio is not a correct answer or a grade. Ask what
students could justify from the briefing and which priorities they protected.
The complete allocation-space distribution is not a forecast of classroom
choices. The pilot needs a facilitated debrief and observation before retuning.

## Endpoints

- `GET /api/health` — public liveness; protected diagnostics with `x-health-key`
- `GET /api/config` — public, non-outcome UI copy and metadata
- `POST /api/outcome` — server-side deterministic outcome evaluation
- `POST /api/session` — facilitated session/team/instructor state
- `POST /api/finish` — completion report to the platform

## Standalone checks

A copy of this folder alone (including an unzip named `sim-03`) is sufficient for
`npm test` or `npm run build`. Node 20 or later is required; no sibling `platform/`
folder or npm packages are needed for these guards. The faculty authorization
check signs a test-only launch-token fixture and exercises the real session
handler, including invalid signatures, expired tokens, other simulations, and
student roles. Full platform-to-sim compatibility is also checked separately in
the monorepo's platform integration job.

`npm test` discovers all dependency-free check tools, including the calibration
guards. `npm run build` also keeps those checks.

`npm run test:browser` is a separate, required integration check. It uses the real
HTML, API handlers and Redis Lua scripts, not a mocked Redis implementation. It
requires Playwright, Redis's Node client, Chromium, an agent-browser CLI, and a
**disposable test Redis service**. Install the same isolated tools used by CI:

```sh
npm install --prefix /tmp/midland-browser --no-audit --no-fund playwright@1 redis@5 agent-browser
/tmp/midland-browser/node_modules/.bin/playwright install --with-deps chromium
export NODE_PATH=/tmp/midland-browser/node_modules
export AGENT_BROWSER_BIN=/tmp/midland-browser/node_modules/.bin/agent-browser
export TEST_REDIS_URL=redis://127.0.0.1:6379
npm run test:browser
```

These shell commands are for Linux/macOS; on Windows use equivalent paths and
PowerShell environment assignments. Never point TEST_REDIS_URL at production.
Without prerequisites, `npm run test:browser` fails with **FAIL / NOT RUN**.
Only directly invoking `node tools/team-runner-browser-check.js` without
`--required` permits an explicitly reported optional skip. Missing prerequisites are never reported
as a passing browser test. Connection attempts to an absent Redis stop rather
than retrying indefinitely.

The browser CI job first tests a standalone archive without dependencies, then
runs the full browser/Redis check from that same isolated folder in required
mode. It also checks the rendered Brief and Position screens and the story-before-
portfolio order on the Year 1 outcome and both Year 2 events.
