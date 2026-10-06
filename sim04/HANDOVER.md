# Sim-04 — Whose Number Is Right? — Developer handover

This document is self-contained. Read it with `rapid-04-whose-number-spec.md` (in this package), which holds every locked design decision. If the two ever disagree, the spec wins, and you should flag the conflict in your report.

---

## 1. What this sim is, in one paragraph

Teams get the same quarter of customer data for a fictional software company, Ridgeway Dispatch, and each team reports one number to the board: customer retention. Each team's definition sheet differs from the others in exactly one line, the definition of "retained." Nobody sees another team's sheet until every number is locked. The numbers all disagree, and every one of them is correct. The instructor reveals this in two stages on a projector: numbers first, then the definitions and the department that wrote each one. Play takes about 25 minutes, and the rest of the class period goes to the debrief.

## 2. What's already done (Increment 1)

The data pack, the five definition sheets, the calculation engine and the data half of the build gate are all built. Everything passes.

```
sim-04/
  data/build-pack.js   generates pack.json (run only if the pack must change)
  data/pack.json       43 accounts, 53 tickets, the single source of truth
  data/sheets.js       shared lines, five contested lines, Stage 2 labels
  data/config.js       every tunable value and the expected results
  engine/retention.js  compute, derivation, assignSheets, checkCommit, studentPayload
  test/gate-data.test.js  43 checks
```

Run the gate with `node test/gate-data.test.js`. The expected result is `43 passed, 0 failed`.

The results are 90.0 (A), 85.0 (B), 80.0 (C), 75.0 (D) and 69.6 (E). The student payload leak check has been proven to fire on a planted leak.

## 3. What you're building

Match the conventions of Midland (`sim-03/`, id `rapid-03-midland`) for session creation, API shape, persistence, the projector console and the build gate. Stack: Node.js, no new dependencies unless unavoidable, Next.js front end, Upstash Redis sessions, HMAC launch tokens, house styling (IBM Plex Mono, Newsreader, dark `#0E1524` ground, amber accent).

### Increment 2 — Session and commit

1. **Session creation.** Mode (team or individual) is a required choice with no default. The team or participant count is refused below 3. The clock minutes default from `config.clockMinutes`.
2. **Sheet assignment.** Use `assignSheets(n)` only. Never assign sheets any other way.
3. **Join** through the platform launch token, following Midland's pattern.
4. **Student view:** the briefing (text in spec section 3), the data pack as sortable tables plus a CSV download, and the team's own sheet. Build it only from `studentPayload(sheetId)`.
5. **Clock:** it runs on its own and isn't paced by participants. There's a warning at `config.warningMinutes`.
6. **Commit:** a percentage to one decimal plus a 1–5 confidence. It's final, with no edit. At zero, uncommitted teams lock as "No number reported."

### Increment 3 — Instructor console

1. **Pre-reveal screen** (it's on the projector, so it must be safe to project): team names, committed / not committed, and the clock. No numbers.
2. **Stage 1:** every number and confidence by team name, all at once, and not grouped by sheet.
3. **Stage 2:** the sheet lines with the contested line highlighted, the department and purpose from `sheets.reveal`, same-sheet teams grouped, and the derivation from `derivation(sheetId)`. A side-by-side view for any two teams the instructor picks.
4. **Private error-check page:** a separate route, not linked from the projected console, meant to be opened on the instructor's own laptop or phone. It shows `checkCommit()` for every team. Nothing about mismatches ever appears on the projector.

### Increment 4 — Platform integration

1. Registration and completion callbacks, matching Midland.
2. Catalogue copy: the tagline and detail page from spec section 1 and the catalogue draft in the spec.
3. A Vercel project with `SIM_URL` set explicitly and a platform rewrite for `/sim04`.
4. Extend the build gate (spec section 11): scan the built UI bundle for forbidden terms and placeholders, check that `vercel.json` has no `deploymentEnabled: false`, check that `SIM_URL` is set, and extend the leak check to the real API responses a student receives, not just `studentPayload`.

## 4. Rules that must not break

- **The student side never receives** another sheet's contested line, any department or purpose text, another team's number, or any expected result. The gate checks this, and a new code path that sends data to students must be covered by it.
- **Nothing is scored, ranked or compared in the student view.** Student screens stay on their own locked number through both reveal stages.
- **The student-facing materials never name** a course, institution, semester, year or day of the week.
- **The results come from the engine.** Never type a result into UI code.
- **Don't change `pack.json`, `sheets.js` or `expectedResults`.** Any change to data, wording or results needs Vikram's approval first. If you think one is needed, stop and include it in your report.

## 5. Known gotchas from earlier sims

- A build guard has to test the real code path. Sim-01's guard checked a phrase that differed from the real detection logic, so it never fired. Whenever you add a guard, prove it fails on a planted fault, then remove the plant.
- Don't derive `SIM_URL` from the request host. Doing that sends every launch to the catalogue root.
- `deploymentEnabled: false` in `vercel.json` silently stops git deployments from building.
- The retired id `rapid-03-bench` must never be reused. Before the first deploy, ask Akshay to confirm `rapid-04-whose-number` has no rows in the platform database.
- Catalogue copy that an administrator has edited must not be overwritten by registration.

## 6. Definition of done

- The full gate passes (data checks plus the Increment 4 extensions), and each new guard has been shown to fire on a planted fault.
- One complete test run with three teams: create, join, commit (including one deliberately wrong number and one team that doesn't commit), Stage 1, Stage 2, side-by-side, private check page, and completion reaching the platform.
- One run with seven teams to confirm the sheets cycle (A, E, D, C, B, A, E).
- An attempt to create a session with two teams is refused.

## 7. What to report back

Send one short report on completion with:

1. The gate output (pass/fail counts), plus a note of which guards you proved by planting a fault.
2. Screenshots of the student view (briefing, data pack, sheet, commit, locked), the pre-reveal screen, Stage 1, Stage 2, the side-by-side view and the private check page.
3. The deployed URL and the commit hash.
4. Any deviation from this handover or the spec, and why.
5. Open questions or decisions you need from Vikram.

Interim reports at the end of each increment are welcome, in the same shape.

## 8. Decisions reserved for Vikram

Publication, any change to data, sheet wording, results or student-facing copy, and anything that would weaken one of the rules in section 4.
