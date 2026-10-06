# Deployment checklist

1. Create a Vercel project from `OneSmarterInc/Disaster_New` with **Root
   Directory `sim08`**.
2. Set environment variables before first traffic:
   - `LAUNCH_SECRET`: exactly the platform's value.
   - `PLATFORM_URL`: the RapidSims platform base URL.
   - `SIM_URL`: `https://rapidsims.flexee.org/sim08`. Set it explicitly; never
     let it derive from the request host.
   - KV/Upstash REST URL and token (the Upstash integration sets these).
   - `FACULTY_CODES` for anyone opening the instructor page directly.
   - `ACCESS_CODE` for standalone student access (optional).
   - `HEALTH_SECRET` to read the diagnostic health output.
3. Confirm `vercel.json` has no `deploymentEnabled: false`.
4. Deploy, then open `/api/health` with the health key and confirm
   `launchSecret`, `sessions`, `platformUrl` and `registersAs`, and that the
   fingerprint matches the platform's.
5. An anonymous POST to `/api/session` with `{"action":"create","mode":"team"}`
   must return 401.
6. Confirm `rapid-08-later` appears in the catalogue as **unpublished**.

## Platform rewrite

Read the new project's stable alias from Vercel **Settings → Domains** (project
names are not predictable). Then add to `platform/vercel.json`, beside the other
sim entries, with that alias:

    { "source": "/sim08",        "destination": "https://<sim08 alias>/launch.html" },
    { "source": "/sim08/",       "destination": "https://<sim08 alias>/launch.html" },
    { "source": "/sim08/:path*", "destination": "https://<sim08 alias>/:path*" }

and a matching `/sim08/(.*)` header block copied from an existing sim's.
Redeploy **disaster-new** (Root Directory `platform`) to activate these routes.
See [the integration guide](../docs/sim07-sim08-integration.md) for the full order.

## Before publication

Run one team session and one individual session end to end through
`https://rapidsims.flexee.org/sim08` with at least three devices: platform
launch, join, two teammates spending questions at once, a pause, a vendor tie,
the four projector steps, and the completion report. Publication stays with
Vikram.
