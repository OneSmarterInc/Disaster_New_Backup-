# Configuration

One platform and ten simulation projects share this repository, each with its own Root Directory. The tables below describe the original platform/Sim01 configuration; see docs/integration-fixes-2026-09-28.md for the current shared diagnostic contract.

## sim/ — RapidSim 01

Root Directory `sim`. Serves the simulation and its facilitator session console.

| Variable | Needed | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Generates the characters. Store as sensitive. |
| `ACCESS_CODE` | for standalone use | What someone types to open the sim directly. Not needed when everyone arrives from the platform. |
| `FACULTY_CODES` | for live sessions | `Name:code` per person, comma separated. Gates the session console. |
| `LAUNCH_SECRET` | to accept platform launches | Must match the platform's exactly. |
| `PLATFORM_URL` | to report completions | Where to post when a student finishes. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | for live sessions | Set by the Upstash Redis integration. Do not set by hand. |

## platform/ — catalogue, courses, entitlement

Root Directory `platform`.

| Variable | Needed | What it does |
|---|---|---|
| `DATABASE_URL` | yes | Postgres. Set by the Neon integration. |
| `LAUNCH_SECRET` | yes | Must match every sim it launches into. |
| `PUBLIC_BASE_URL` | optional | Its own address, used to build invitation and enrolment links. No trailing slash. |
| `SETUP_KEY` | first run only | Guards `/setup.html`. Delete it once setup is done. |
| `RAPID_01_URL` | optional | Seeds the catalogue during setup. |

## Checking a deployment

All eleven projects answer at `/api/health`. Public responses contain only liveness and service identity. Configure a dedicated `HEALTH_SECRET` with the same value on the platform and every simulation, different from `LAUNCH_SECRET`. Diagnostics require that key in `x-health-key`; query-string secrets are rejected. The protected response includes configuration status and a launch-secret fingerprint. These checks establish configuration, not a complete student playthrough or a live database/model transaction.

Admin → Catalogue → Check all reports `unverified` when diagnostics are unavailable; it does not mistake hidden fields for missing credentials. Different Git revisions are shown for inspection and do not alone indicate a broken simulation.

## After a release that changes the schema

Admin console, Catalogue tab, "Bring the database up to date". Every statement is create-if-missing, so running it repeatedly is harmless and it never drops anything.

## Things that have caught us out

Vercel only bundles files it can see being required, so nothing may be read from disk at runtime. The schema lives in `lib/schema.js`, generated from `schema.sql` by `lib/build-schema.js`.

The neon driver is a tagged-template function with no `.query()` method, and its templates cannot be nested — write two statements rather than composing one.

Vercel refuses to build commits whose author email does not match a GitHub account.

Changing Root Directory needs a redeploy with the build cache disabled, or the old output is served.

`sim/public/index.html` is generated. Edit `sim/src/` and run `node build.js`, which refuses to write a bundle containing scenario content.
