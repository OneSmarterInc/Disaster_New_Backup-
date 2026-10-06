# Deploying RapidSim 09

See [the shared Sim09/10 integration and deployment guide](../docs/sim09-sim10-integration.md) for the exact variables and activation order.

- Vercel Root Directory: `sim09`; framework: **Other**.
- Build command: `npm run build`; static output: `public` (both committed in `vercel.json`).
- Production branch: `main`.
- Redis is required for private solo play as well as individual/team classes. The key prefix is `m09:`.
- Use the platform's existing `LAUNCH_SECRET`; set `PLATFORM_URL` and canonical `SIM_URL` explicitly.
- Confirmed production origin: `https://sim09.vercel.app`. The platform proxy routes are committed; deploy the platform too.
- `/api/config` awaits the signed catalogue announcement. Registration creates `rapid-09-money-land` unpublished; publication remains an administrator action.
- `/api/health` is read-only. Optional `HEALTH_SECRET` protects diagnostic details, using the `x-health-key` header.
