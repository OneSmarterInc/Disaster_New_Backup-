# Deployment checklist

1. Create a Vercel project from `OneSmarterInc/Disaster_New` with **Root
   Directory `sim05`**.
2. Set environment variables before first traffic:
   - `LAUNCH_SECRET`: exactly the platform's value.
   - `PLATFORM_URL`: the RapidSims platform base URL.
   - `SIM_URL`: `https://rapidsims.flexee.org/sim05`. Set it explicitly; never
     let it derive from the request host.
   - KV/Upstash REST URL and token (the Upstash integration sets these).
   - `FACULTY_CODES` for anyone opening the instructor page directly.
   - `ACCESS_CODE` for standalone student access (optional).
3. Confirm `vercel.json` has no `deploymentEnabled: false`.
4. Deploy, then open `/api/health` with the health key and confirm
   `launchSecret`, `sessions`, `platformUrl` and `registersAs`, and that the
   fingerprint matches the platform's.
5. An anonymous POST to `/api/session` with `{"action":"create","mode":"individual"}`
   must return 401.
6. Confirm `rapid-05-approve` appears in the catalogue as **unpublished**.

## Platform rewrite

Read the new project's stable alias from Vercel **Settings → Domains** (project
names are not predictable). Then add to `platform/vercel.json`, after the
`/sim03` entries, with that alias:

    { "source": "/sim05",        "destination": "https://<sim05 alias>/launch.html" },
    { "source": "/sim05/",       "destination": "https://<sim05 alias>/launch.html" },
    { "source": "/sim05/:path*", "destination": "https://<sim05 alias>/:path*" }

and a matching `/sim05/(.*)` header block copied from `/sim03/(.*)`.

## Before publication

Run one individual and one team session end to end through
`https://rapidsims.flexee.org/sim05` with at least three devices: platform
launch, join, a round timing out, pause and resume, the projector, and the
completion report. Publication stays with Vikram.
