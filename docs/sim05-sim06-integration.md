# RapidSim 05 and 06 integration

The two simulations live in independent Vercel projects with Root Directory
`sim05` and `sim06`. Their catalogue IDs are `rapid-05-approve` and
`rapid-06-switch`. The platform launch and session-entry code recognizes both,
and registration creates new catalogue records as unpublished.

Before traffic or publication, create the Vercel projects and configure each
project's `LAUNCH_SECRET` (the same value as the platform), `PLATFORM_URL`,
`SIM_URL` (`https://rapidsims.flexee.org/sim05` or `/sim06`), and Upstash REST
credentials. The platform rewrites use the confirmed production domains:

- `/sim05`, `/sim05/` -> `https://sim05.vercel.app/launch.html`
- `/sim05/:path*` -> `https://sim05.vercel.app/:path*`
- `/sim06`, `/sim06/` -> `https://sim06.vercel.app/launch.html`
- `/sim06/:path*` -> `https://sim06.vercel.app/:path*`

Both prefixes have noindex/no-store response headers. Deploy the platform
project (`disaster-new`, Root Directory `platform`) after changing these
rewrites; deploying only the sim projects does not update platform routes.
Keep each `SIM_URL` on the canonical `rapidsims.flexee.org` URL above.

Check each `/api/health` with the health key, confirm the shared launch-secret
fingerprint and canonical `registersAs` URL, and confirm each record appears
unpublished. Run an individual and a team session through the platform join
links, including timeout, pause/resume, completion reporting and instructor
views. Publication remains an administrator action after review.
