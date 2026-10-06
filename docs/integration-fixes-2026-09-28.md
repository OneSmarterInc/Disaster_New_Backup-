# RapidSims integration fixes — 28 September 2026

## Included

- Re-enable main-branch Git deployments for Sim01, Sim02 and RapidSim+ 01.
- Protect platform and all ten simulation diagnostics with a dedicated `HEALTH_SECRET`.
  Public health remains a read-only liveness response. Admin checks use this key,
  report unavailable diagnostics as `unverified`, recognize deterministic sims that
  need no model key, and accept documented legacy Wexford launch identities.
- Verify Plus faculty playback capability on the server. A `faculty=1` query flag
  no longer enables accelerated playback. Valid faculty/faculty-preview launches
  enable the controls; a configured faculty credential is also supported by the API.
- Preserve explicit Plus registration URLs, with `PLATFORM_URL + /simplus01` as the
  fallback when `SIM_URL` is absent. Keep both `/simplus01` and `/rapidsims01` aliases.
- Add Sim10-specific catalogue details and protected diagnostics.
- Send the intended catalogue number in each sim's signed registration. New rows
  receive that number if available; existing rows and admin ordering stay unchanged.
  Display labels use simulation identity, so historical ordering cannot swap
  Sim05/06, Sim07/08 or Sim09/10. Plus displays as RapidSim+ 01, not RapidSim 101.
  Legacy Bench rows are identified as Wexford only when their title also matches.
- Repair catalogue/detail DOM fixtures, add the session-page support footer,
  preserve the landing page's business-enquiry contact, and remove hard-coded
  browser navigation origins. Midland's standalone faculty recovery reads the
  configured platform address from public navigation metadata.
- Expand shared health checks to all ten sims and the platform, and run health,
  catalogue, deployment, address and contact checks in CI for all sim folders.

## Required deployment configuration

Set `HEALTH_SECRET` in Production on the platform and all ten simulation projects
to the **same long random value**, different from `LAUNCH_SECRET`. Keep it private.
Preview environments should use their own test credentials. Generate a key locally:

```sh
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

Environment updates take effect on a new deployment. Diagnostics use only the
`x-health-key` header, never URL parameters. Until the key is configured consistently,
public health still works and the admin console correctly reports `unverified`.
No database schema migration is required for these code changes.

Each Vercel project must retain the matching Root Directory: `platform`, `sim`,
`sim-02`, `sim03`, `sim05`, `sim06`, `sim07`, `sim08`, `sim09`, `sim10` or
`sim-plus-01`. The old Vercel project name for Plus is not itself a problem; its
Root Directory must be `sim-plus-01`. This change does not delete or rename projects.

For Plus, keep the existing working `SIM_URL` alias while historical course links
are in use. Before publishing the new `rapidsimplus-01` row, run the read-only
`platform/tools/audit-sim-identity.js` with the production database connection and
follow [the identity migration review](sim-identity-migration.md). Registration
does not move, delete or merge course assignments, entitlements or results.

## Decisions and checks still outside this patch

- Plus retains its current 180-minute listing and persistent generic question
  starters. The review's proposed 70-minute format and first-question-only starters
  conflict with existing authored settings/tests and require a teaching decision.
- RapidSim+ 02 is not in this repository; adding it requires its source package.
- Full signed-in student/faculty browser playthroughs, production AI responses and
  completion delivery still need verification. Configuration health does not prove
  those flows or a live Redis transaction.

## Verification

All ten main simulation suites and 44 platform/shared suites pass (54 suite groups).
The shared checks include:

```sh
node tools/health-security-check.js
node platform/tools/health-contract-check.js
node platform/tools/catalogue-number-check.js
node platform/tools/register-check.js
node platform/tools/deploy-check.js
node platform/tools/catalogue-check.js
node platform/tools/sim-detail-check.js
node platform/tools/address-check.js
node platform/tools/contact-check.js
```

Health checks execute real handlers with disposable credentials. The admin contract
check covers all ten sims, wrong/missing diagnostic keys, missing storage, launch
secret mismatch and the Plus legacy aliases. Plus tests cover student, faculty,
faculty-preview, legacy, wrong-simulation, expired and forged launch tokens.
Tests use disposable in-memory adapters; browser/real-Redis jobs remain separate.
