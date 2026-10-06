# RapidSim 07 and 08 integration

| Root Directory | Title | Catalogue ID | Canonical SIM_URL |
| --- | --- | --- | --- |
| `sim07` | Would You Have Bought It? | `rapid-07-bought` | `https://rapidsims.flexee.org/sim07` |
| `sim08` | Eighteen Months Later | `rapid-08-later` | `https://rapidsims.flexee.org/sim08` |

Both are independent Vercel projects from `OneSmarterInc/Disaster_New`, branch
`main`. The platform supports their student launches, faculty sessions,
account-entry pages, course lookup and authenticated course roster. Registration
creates unpublished catalogue records; it does not publish a simulation.

## Deployment order

1. Create the two Vercel projects after this integration is pushed. Choose the
   corresponding Root Directory above and framework **Other**. Use
   `npm run build` and the static output directory `public`; Vercel also bundles
   each project's `api` functions.
2. Set the variables below for Production, then deploy both projects.
3. The confirmed production domains are `https://sim07.vercel.app` and
   `https://sim08.vercel.app`.
4. The six rewrites and noindex/no-store headers are configured in
   `platform/vercel.json` for those domains.
5. Push and redeploy **disaster-new** (Root Directory `platform`). Deploying only
   the sim projects does not update the platform routes. Keep the simulations
   unpublished until the canonical routes have been verified.
6. Visit each canonical `/sim07/api/config` or `/sim08/api/config` endpoint to
   trigger its signed catalogue announcement. An unsigned request can return
   401 after attempting to announce the sim. The config handler waits for the
   registration attempt before responding; a failed attempt is retried on the
   next request. `/api/health` is read-only and does not
   register anything.
7. Test the student Play button and a faculty invitation through the platform,
   including account sign-in, access release, an individual session, a team
   session, refresh, and completed results under the correct course. Publish
   only after the administrator's review.

### Variables on each sim project

| Variable | Value |
| --- | --- |
| `LAUNCH_SECRET` | Exactly the platform's existing secret |
| `PLATFORM_URL` | `https://rapidsims.flexee.org` |
| `SIM_URL` | The canonical URL in the first table |
| `KV_REST_API_URL` and `KV_REST_API_TOKEN` | Upstash Redis REST credentials |
| `HEALTH_SECRET` | Private diagnostic key sent as `x-health-key` |
| `ACCESS_CODE` | Optional standalone student access code |
| `FACULTY_CODES` | Optional direct instructor access: `Name:code,Other:code` |

`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are supported alternatives
to the KV pair. No model API key or separate Postgres database is needed.
Sim08 needs Redis for private solo play as well as class sessions. Sim07's
standalone decision runs locally; its facilitated sessions use Redis. The two
sims use different Redis key prefixes and can share one Redis database.

### Configured routes

- `/sim07` and `/sim07/` → `https://sim07.vercel.app/launch.html`
- `/sim07/:path*` → `https://sim07.vercel.app/:path*`
- `/sim08` and `/sim08/` → `https://sim08.vercel.app/launch.html`
- `/sim08/:path*` → `https://sim08.vercel.app/:path*`

The canonical roots open each sim's launch page. Wildcard routes proxy its
assets and API functions. The platform must deploy this configuration for the
canonical URLs to become available.

## Entry and results

- A platform Play launch uses the signed account; no standalone access code.
- A direct standalone visit uses `ACCESS_CODE` and enters private play without
  a class session code. It does not send a faculty completion callback.
- Guest faculty invitations ask for the student's name without a separate
  access code. Their decisions stay in the instructor's session.
- Platform faculty invitations require a signed account and released course
  access. Completion uses the signed course and participant identity.
- Launch tokens are scoped to each class or solo entry and survive refresh.
  A fresh tokenless visit clears the previous token for that entry.
- Failed completion callbacks remain retryable. Reports are acknowledged only
  after a successful callback.

## Checks

```sh
(cd sim07 && npm run build)
(cd sim08 && npm test)
node platform/tools/session-sims-check.js
node platform/tools/new-sims-entry-check.js
node platform/tools/new-sims-registration-check.js
```

The client check executes the real inline page scripts with real handlers and
disposable storage in Node VM. It is not a visual browser or production login
check. The supplied Sim08 scenario, answer and report reference documents are
preserved in `sim08/docs/`, outside the public static directory.
