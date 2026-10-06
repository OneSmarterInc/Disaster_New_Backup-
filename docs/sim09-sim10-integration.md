# RapidSim 09 and 10 integration

| Root Directory | Title | Catalogue ID | Canonical `SIM_URL` |
| --- | --- | --- | --- |
| `sim09` | Where Does the Money Land? | `rapid-09-money-land` | `https://rapidsims.flexee.org/sim09` |
| `sim10` | Infrastructure or Bubble? | `rapid-10-bubble` | `https://rapidsims.flexee.org/sim10` |

Both packages are integrated into the platform's shared class-session registry,
course lookup, launch authorization and session-entry titles. They verify signed
platform identities and report completed results under the signed account/course.
Registration creates unpublished catalogue records. There is no separate
`assignable` flag: faculty can add published sims, or drafts explicitly granted to
them, to their own courses. **Add a simulation** and **Refresh list** fetch the
current catalogue rather than using the snapshot from when the course was opened.

## Deployment status and order

The confirmed production origins are `https://sim09.vercel.app` and
`https://sim10.vercel.app`. Their entry, health and application endpoints respond.
The six proxy mappings below are configured in `platform/vercel.json`; the
platform deployment must include this configuration for the canonical URLs to work.

1. Import `OneSmarterInc/Disaster_New` as two Vercel projects, using the respective
   Root Directory above, branch **main**, framework **Other**. Both commit
   `buildCommand: npm run build` and `outputDirectory: public` in `vercel.json`.
   The `api` functions remain server-side. Do not expose the repository root as
   static output: scenario data, identities and unreleased outcomes stay server-side.
2. Set the Production environment variables below on **each sim project** and
   deploy. Environment changes require a new deployment. Preview environments
   should use a test platform/store if they are configured.
3. Check each production origin's `/api/health` response: the
   `sim` field must match the catalogue ID above. These probes are read-only.
4. Deploy the committed proxy mappings and noindex/no-store headers on **disaster-new**
   (Root Directory `platform`). No database schema migration is required. Set the shared diagnostic
   HEALTH_SECRET on the platform and each simulation to enable configuration checks.
5. Verify the canonical health, asset and entry routes. Then visit
   `/sim09/api/config` and `/sim10/api/manifest` to trigger awaited signed
   registration. Sim09 may return 401 for the unsigned config probe after the
   registration attempt. Its `X-Catalogue-Registration` response header reports
   `registered`, `not_configured`, or `failed` without exposing secrets. A
   successful registration still needs admin publication. A failed announcement
   retries on a later application
   request. Health probes never register a sim.
6. In the admin catalogue, review the draft entries and test Play, faculty class
   setup, signed invitations, refresh and completion under the correct course.
   Publish after review. Faculty can then use **Add a simulation → Refresh list**
   to select the newly published titles.

### Production variables

| Variable | Sim09 | Sim10 |
| --- | --- | --- |
| `LAUNCH_SECRET` | Exact existing platform secret | Exact existing platform secret |
| `PLATFORM_URL` | `https://rapidsims.flexee.org` | `https://rapidsims.flexee.org` |
| `SIM_URL` | `https://rapidsims.flexee.org/sim09` | `https://rapidsims.flexee.org/sim10` |
| `KV_REST_API_URL` | Redis REST URL | Redis REST URL |
| `KV_REST_API_TOKEN` | Redis REST token | Redis REST token |
| `BASE_PATH` | Not used | `/sim10/` |
| `ACCESS_CODE` | Optional direct student access | Optional direct student access |
| `FACULTY_CODES` | Optional direct faculty access: `Name:code,Other:code` | Same format |
| `HEALTH_SECRET` | Same dedicated diagnostic key as the platform | Same dedicated diagnostic key as the platform |

The `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` pair is an alternative
to the KV pair. Both sims require Redis for **solo and class play**; prefixes
`m09:` and `s10:` allow them to share a database. No model API key or new Postgres
database is needed. Keep secret values in Vercel environment settings, not Git.
Sim10 permits in-memory sessions and accelerated clocks only in explicit local
development with `DEV_OPEN=1`; that bypass is disabled on Vercel.

### Configured proxy mappings

| Platform source | Destination |
| --- | --- |
| `/sim09` | `https://sim09.vercel.app/launch.html` |
| `/sim09/` | `https://sim09.vercel.app/launch.html` |
| `/sim09/:path*` | `https://sim09.vercel.app/:path*` |
| `/sim10` | `https://sim10.vercel.app/` |
| `/sim10/` | `https://sim10.vercel.app/` |
| `/sim10/:path*` | `https://sim10.vercel.app/:path*` |

Sim10's root is its play/join page; it has no `launch.html`. Its `<base>` handling
keeps assets and APIs under `/sim10/`, including when Vercel serves static HTML
directly. The app handler supports both origin paths and prefixed paths.

## Player behavior

- Platform Play uses the signed account without a standalone access code.
- Sim09 starts a private run for a signed student. Direct guests enter a name
  after the access-code gate. The existing statement/allocation/history flow is
  preserved; class history remains under instructor control.
- Direct Sim10 entry verifies `ACCESS_CODE` before showing play/join options.
  Valid platform launches open directly; account invitations go to platform
  sign-in. Remembered codes are rechecked, and a missing code configuration
  keeps direct entry closed.
- Sim10 Play offers one or two companies and starts a private timed run. After
  the decision clock closes, its owner opens each reveal and starts the next
  company. Private runs have no join link and do not expose host keys.
- Faculty **Run a session** opens each sim's class setup. Sim10 preserves its
  explicit mode/company choices and team selection. Platform invitations go
  through account sign-in and released course access.
- Tokens are scoped to the run/session. A fresh signed class entry joins the
  current account even if that browser remembers a previous participant. Solo
  resume keys include both account and course.
- Completion is accepted only after the final history/outcome. Failed callbacks
  retry; concurrent requests use an atomic claim to avoid simultaneous reports.

The existing untimed faculty demonstration is `/sim07/demo` (also `/sim07/demo/`).
It requires a faculty launch or configured faculty code. Sim09/10 keep their own
timed teaching flows; this integration does not add new untimed demo routes.

## Verification

```sh
(cd sim09 && npm test)
(cd sim10 && npm run build && npm test)
node platform/tools/session-sims-check.js
node platform/tools/new-sims-entry-check.js
node platform/tools/new-sims-registration-check.js
node platform/tools/course-catalogue-check.js
```

The tests use disposable storage and signed local fixtures, including the real
HTTP handler and shipped entry scripts. They cover course isolation, account
switches, invitation entry, timers, private/class controls, staged completion,
registration lifetime and retry. DOM fixtures run in Node VM; they are not a live
browser or production Redis test. Production routing and a full student/faculty
browser smoke test remain necessary after deployment.

Build configuration reference: [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json).
