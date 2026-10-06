# RapidSim 06 — Do We Switch?

Card payments are failing across Harlow Home & Hardware's twelve stores. Twelve reports arrive
over ten minutes, the same report at the same moment for the whole room, and each student
(or team) may switch to the backup provider or commit to staying, each with a one-line reason.
The reveal shows that both providers ran over one upstream carrier.

Sim id `rapid-06-switch`. For class sessions the instructor chooses individual or team
(no default), students read the briefing and two documents in the lobby, and the
instructor starts one ten-minute clock for everyone. A direct visitor can also use
`ACCESS_CODE`, enter a name, read the briefing and start a private individual run.
That standalone run has no faculty owner and sends no platform completion.

Faculty invitation links bypass the standalone access-code gate. A platform class
invitation still uses the student's platform account and course entitlement, then
joins the instructor's room. Decisions remain in that room and platform-launched
students report completion to the course. Failed completion callbacks can retry.

## Layout

| Path | What it is |
|---|---|
| `data/config.js` | All content and thresholds. Edit here, then `npm test`. |
| `lib/engine.js` | Pure session engine: clock, reports, decisions, ticker, reveal, projector. |
| `lib/store.js` | Upstash KV with Lua compare-and-set. First press wins in team mode. |
| `api/session.js` | create, faculty_state, control, solo, start_solo, join, state, open_doc, decide, reveal. |
| `api/config.js` | Briefing and documents only. Reports and reveal flags are never served here. |
| `public/` | `launch.html` router, `index.html` student view, `instructor.html` console and projector. |
| `tools/build-gate.js` | Refuses placeholder text, banned words, course or weekday references, a reused retired id, the carrier named in the briefing, and `deploymentEnabled: false`. |

## Checks

`npm test` runs the gate, engine tests and API tests. `npm run test:lua` proves the Lua
scripts against a Lua-capable Redis; `python3 tools/kv-shim.py` provides one locally
(needs `pip install fakeredis lupa`).

## Rules the design depends on

Nothing in the student view is scored, ranked or compared. The reveal shows the student's own
decision, reason, reading and loss, with no verdict and no counterfactual. The projector shows
counts, timing by report, and the share who opened both documents; reason text never reaches it,
and any group under three people shows a dash.
