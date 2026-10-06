# Flexee RapidSims — platform

Catalogue, faculty accounts, courses, student enrolment and entitlement for the
RapidSims. Payment is handled outside this system: a faculty member marks a
student or a whole section as paid, and that flag is what unlocks a launch.

## How it fits together

The platform never hosts a sim. Each sim is its own small deployment. When
someone launches one, the platform signs a short-lived token saying who they are
and in what capacity, and the sim verifies that signature with a shared secret.
That's the entire contract — no shared database, no API between them — which is
what lets each sim stay independent and lets older sims be brought in later by
teaching them the same check.

## Environment

`DATABASE_URL` — Postgres. Add Neon from the Vercel marketplace and it's set for you.

`LAUNCH_SECRET` — a long random string. The same value must be set on every sim
deployment, or launches will be rejected.

`PUBLIC_BASE_URL` — used to build invite and enrolment links.

## Schema

`lib/schema.sql` is the source of truth. Nine tables: users, tokens, sessions,
sims, previews, courses, course_sims, enrolments, launches.

What actually ships is `lib/schema.js`, a generated module holding the same
statements — Vercel only bundles files it can see being required, so a plain
`.sql` file never reaches the function. After editing the SQL, run
`node lib/build-schema.js` to regenerate it.

Entitlement lives on `enrolments.paid`, along with who marked it, when, and a
free-text note for reconciling against a purchase order. There are no payment
tables — when Stripe arrives it becomes another thing that sets the same flag.

## Status

Foundation only: schema, database access, password hashing, login sessions and
the launch token. The API layer and the admin, faculty and student interfaces
are not built yet.


## Adding a new RapidSim deployment

Each simulation remains an independent Vercel project and self-registers with the platform using the shared `LAUNCH_SECRET`. The platform owns the public catalogue, course assignment, launch tokens, and completion records. RapidSim 03 (Midland Equipment) uses the canonical route `/sim03`, proxied to `https://sim-03-midland.vercel.app`. Registration remains unpublished by default; publish from the admin console only after authored content and classroom calibration are approved.
