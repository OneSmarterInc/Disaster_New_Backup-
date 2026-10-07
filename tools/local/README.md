# Run all RapidSims locally on Windows

This launcher adds the Admin, Faculty and Student portals plus all 12 simulation
backends to http://localhost:3000. It does not deploy anything or push to GitHub.
It leaves the existing Sim10-only launcher available as a fallback.

## Requirements

- The complete `Disaster_New_Backup-` repository, branch `feature/local-laptop-setup`.
- Node.js 20+ and npm (your Node 22 installation is suitable).
- Your existing PostgreSQL on 127.0.0.1:5434, database `rapidsims_local`, role
  `rapidsims_app`, and its password.
- Docker Desktop running **Linux containers**. Installation:
  https://docs.docker.com/desktop/setup/install/windows-install/
- For Sim01 and Sim02 AI conversations: an Anthropic API key with available API
  usage and internet access. Other simulations do not require this model key.
  No fake AI responses are substituted when the key is missing. Hosting is local,
  but the two AI conversations use the external Anthropic API and incur its usage.

## First run

Extract the supplied ZIP into `D:\Sim_Simulations\Disaster_New_Local`. It adds only
`tools/local/` and does not overwrite portal files or your existing local secrets.
Stop the old local Node server with Ctrl+C so port 3000 is free. Keep PostgreSQL
running. Open Docker Desktop and wait for its engine to be ready.

From PowerShell in the repository:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\tools\local\Start-All.ps1" -WithAI
```

The execution-policy override applies only to this child PowerShell process.
The script checks the repository/branch, starts a dedicated Redis container,
installs `pg@8` and `redis@4` under the ignored `.local-dev` folder if needed, and
asks privately for the database password and Anthropic key. Do not paste either
into chat. If you omit `-WithAI`, all backends start, but Sim01/Sim02 AI dialogue
cannot work unless the key is already set in the environment.

The script preserves/reuses `.local-dev/local-secrets.json` and does not reset
users or passwords. The launcher applies the repository's additive SQL schema,
registers all 12 simulations with localhost URLs, and **publishes those 12 entries
in your local catalogue**. Existing course assignments and results remain. It does
not delete old catalogue entries. An old/retired entry may still have an obsolete
URL: use the current 12 entries listed by this launcher.

## Addresses

| Simulation | Local path |
| --- | --- |
| Sim01–Sim10 | `/sim01/` through `/sim10/` |
| RapidSim+ 01 | `/simplus01/` |
| RapidSim+ 02 | `/simplus02/` |
| Portals | `/admin.html`, `/faculty.html`, `/student.html` |

Log in through the portal and use its simulation buttons so the appropriate
signed launch token is supplied. A direct simulation address may ask for access;
starting a backend does not bypass enrolment, faculty ownership, or release rules.
Faculty still need to attach simulations to courses and release student access.

## Data and processes

- Portal data: your existing local PostgreSQL database.
- Simulation data: Redis in container `rapidsims-local-redis`, host port 6380,
  bound to 127.0.0.1 only. Each simulation uses its own Redis database (1–12).
- Redis persistence: named Docker volume `rapidsims-local-redis-data`, append-only
  persistence enabled. Normal simulation expiry still applies (typically 48 hours
  or 30 days). This is not a permanent archive or backup.
- Each simulation runs in a separate Node process on an automatically assigned
  loopback port. The main process proxies them through localhost:3000.
- Local callbacks can only reach the local portal. Only Sim01/Sim02 may call
  api.anthropic.com when a key is supplied. No hosted production database is used.
- This is a laptop development launcher, not a public deployment server.

## Verification

In a second PowerShell window:

```powershell
cd "D:\Sim_Simulations\Disaster_New_Local"
node tools/local/check.cjs
```

Expected: 12 PASS lines. Then verify actual student/faculty workflows from the
portal. If a faculty course has only Sim10 attached, add the other simulations to
that course; merely starting them does not alter course assignments.

Package validation in the development workspace included all 12 entry pages and
health endpoints, all 12 signed platform launch URLs, Sim01/02 initial scenes,
Sim03–09 configuration APIs, and Sim04 practice creation using real Redis 7.4.2.
Redis isolation and Lua compare-and-set were exercised. The isolated portal test
used PGlite behind a temporary test-only pg adapter, **not** the Windows PostgreSQL
service. That adapter is not included in this package. Full gameplay completion,
paid Anthropic calls, Docker Desktop and PowerShell execution on Windows remain
local verification steps. No claim is made that every gameplay flow was tested.

## Stop/restart

Ctrl+C in the launcher window stops the Node processes. Redis is deliberately
left running so another launcher restart can use it. To stop Redis:

```powershell
docker stop rapidsims-local-redis
```

Run the same Start-All command to restart everything. Do not remove the Redis
volume if you want to retain unexpired simulation sessions.

If startup reports port 3000 in use, stop the earlier Node launcher. If it reports
PostgreSQL authentication failure, enter the `rapidsims_app` database password
(not the portal sign-in password). If Docker is missing, install/open Docker
Desktop first. A name conflict with an unrelated Redis container is refused;
the script will not delete someone else's container.
