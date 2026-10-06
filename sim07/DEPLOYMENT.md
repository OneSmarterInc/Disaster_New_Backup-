# Deployment checklist — RapidSim 07

1. New Vercel project from `OneSmarterInc/Disaster_New`, **Root Directory `sim07`**.
2. Environment variables (Production):
   - `LAUNCH_SECRET` — identical to the platform
   - `PLATFORM_URL` — e.g. `https://rapidsims.flexee.org`
   - `SIM_URL` — `https://rapidsims.flexee.org/sim07`. Keep this canonical
     platform URL; activate its routes before publishing. Never a preview URL.
   - `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or the `UPSTASH_REDIS_REST_*` pair)
   - `ACCESS_CODE` — standalone student access (platform launches bypass it)
   - `FACULTY_CODES` — `Name:code,...`, only needed for direct presenter access
   - optional `HEALTH_SECRET` for `/api/health` diagnostics
3. `npm test` and `npm run build` green.
4. Deploy. Check `/api/health` with `x-health-key`: `launchSecret`, `sessions`, `platformUrl`, `registersAs`.
5. Anonymous `POST /api/session` `{ "action": "create", "mode": "individual" }` must return 401.
6. Confirm `rapid-07-bought` appears **unpublished** in the catalogue.
7. Follow [the integration guide](../docs/sim07-sim08-integration.md) to add
   `/sim07` and `/sim07/` → the confirmed deployment `/launch.html`, plus
   `/sim07/:path*` → its `/:path*`. Redeploy `disaster-new` to activate them.
8. Rehearse one individual and one team session with 2–3 devices: presenter + projector + students,
   through clock, lapse, recognition, side-by-side pin, and all three stages.
9. Chuck playtests. Publication is Vikram's call.

Note: `vercel.json` keeps the repo's `deploymentEnabled` pattern (`main: true`). Do not set it to `false`.
