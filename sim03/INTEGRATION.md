# Platform integration

RapidSim 03 follows the existing signed launch-token contract.

The root request is routed through `public/launch.html`. It decodes only the non-secret token payload in the browser to choose the correct surface:

- faculty/faculty_preview + `mode=session` -> `instructor.html`
- every other launch -> `index.html`

The token itself is still verified server-side with `LAUNCH_SECRET` before protected API work. The client-side payload read is routing only and is never treated as authorization.

The simulation self-registers through `/api/register` as `rapid-03-midland`.
It does not claim `rapid-03-bench` as a replaceable alias. Platform registration
retains all legacy identities, including on announcements from older deployments.
See `../docs/sim-identity-migration.md` for the staged Wexford identity change.

Until a same-domain `/sim03` platform rewrite is deliberately added, set `SIM_URL` to the standalone production Vercel URL. The catalogue can launch that URL directly without changing the existing platform routes.
