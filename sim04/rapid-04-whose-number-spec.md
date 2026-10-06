# Sim-04 — Whose Number Is Right? — Build spec

Version 1.1. All design decisions are locked.

---

## 1. Identity

| Field | Value |
|---|---|
| Sim id | `rapid-04-whose-number` |
| Route | `/sim04` |
| Title | Whose Number Is Right? |
| Tagline | Twenty-five minutes to give the board one number. |
| Catalogue minutes | 25 |
| Mode | Team or individual. A required choice at session creation, with no default. |
| Reuse from | Midland (`rapid-03-midland`): session creation, config file, student view isolation, projector console, build gate |

`rapid-03-bench` stays retired. The build gate must refuse it.

## 2. The lesson

Every team gets the same data. Each team's definition sheet differs in exactly one line: the definition of "retained." Nobody sees another team's sheet until every number is locked. All the numbers disagree, and every one of them is correctly derived.

**The rule that does the teaching:** definitions stay private until commitment.

## 3. Briefing (student-facing, final)

> Ridgeway Dispatch sells scheduling and invoicing software to plumbers, HVAC contractors, landscapers and other trade businesses. Customers pay monthly on one of three plans, from a one-van operator on Solo to regional firms running dozens of trucks on Fleet. The quarter has just closed, and the board chair, Elena Varga, wants one figure before the next board meeting: what was our customer retention this quarter? Your team has the quarter's account records, the support tickets, and a definition sheet for retention. Report one number and say how confident you are in it. Once you commit, it can't be changed.

The materials never name a course, institution, semester, year or day of the week. Quarter dates are written as "1 July to 30 September" with no year.

## 4. Data pack (shared by every team)

### 4.1 Plans

| Tier | Price/month | Who |
|---|---|---|
| Solo | $79 | 1 van |
| Crew | $249 | 2–10 vehicles |
| Fleet | $899 | 11+ vehicles |

### 4.2 Accounts in scope (active on 1 July): 40

| Tier | Accounts | Starting MRR |
|---|---|---|
| Solo | 18 | $1,422 |
| Crew | 16 | $3,984 |
| Fleet | 6 | $5,394 |
| Total | 40 | $10,800 |

The pack states the starting MRR of $10,800 as a figure.

### 4.3 Events (each in-scope account has at most one)

| Event | Count | Tiers |
|---|---|---|
| Cancelled, stayed gone | 4 | 2 Fleet, 1 Crew, 1 Solo |
| Cancelled, reactivated at same tier | 2 | 1 Crew, 1 Solo |
| Active, quarter-end invoice unpaid (grace period) | 6 | 4 Solo, 2 Crew |
| Downgraded | 4 | 1 Fleet→Crew, 3 Crew→Solo |
| No event | 24 | — |

### 4.4 Out-of-scope records (approved)

Three accounts sign up mid-quarter (2 Solo, 1 Crew). They appear in the records and are excluded by the fixed scope line on every sheet. This gives the scope line something real to exclude, and it adds one honest trap. It doesn't change any result.

### 4.5 Account record fields

`account_id`, `business_name`, `trade`, `city`, `vehicles`, `tier_start`, `tier_end`, `mrr_start`, `mrr_end`, `signup_date`, `cancel_date`, `reactivate_date`, `q_end_invoice_status` (paid / unpaid), `notes`.

Business names are fictional trade firms. Cities are fictional or generic. There are no real companies and no identifiable people.

### 4.6 Support tickets

Roughly 50 to 60 tickets. Most attach to the 14 event accounts and give the why (billing disputes, a missing feature, a price complaint, a lost owner-operator). About 15 attach to no-event accounts as ordinary noise. Fields: `ticket_id`, `account_id`, `opened`, `closed`, `category`, `summary`. Tickets enter no calculation.

## 5. Definition sheets

### 5.1 Lines fixed on all five sheets

The period is 1 July to 30 September. Only accounts active on 1 July are in scope, and accounts that signed up after 1 July are excluded. The source is the account records in the data pack. Retention is reported as a percentage to one decimal place, rounded half up.

### 5.2 The contested line (one wording per sheet)

| Sheet | Wording | Result |
|---|---|---|
| A · Point-in-time | An account counts as retained if it was active on the last day of the quarter. | 90.0% (36/40) |
| B · Continuous | An account counts as retained if it was active on every day of the quarter. | 85.0% (34/40) |
| C · Same plan | An account counts as retained if it was active on the last day of the quarter on the same tier or higher. | 80.0% (32/40) |
| D · Paid | An account counts as retained if it was active on the last day of the quarter and had paid its quarter-end invoice. | 75.0% (30/40) |
| E · Revenue | Retention is the share of starting monthly revenue still billed on the last day of the quarter, including accounts whose invoice is unpaid. | 69.6% ($7,514 / $10,800) |

### 5.3 Department labels (hidden until Stage 2)

| Sheet | Department | Purpose line shown at Stage 2 |
|---|---|---|
| A | Sales | Wins back a customer and wants credit for it. |
| B | Customer Success | Any lapse means the relationship failed. |
| C | Product | A downgrade means the product disappointed. |
| D | Finance | Unpaid isn't retained until the cash arrives. |
| E | Investor Relations | Investors price dollars, not logos. |

During play every sheet is headed only "Retention definition."

### 5.4 Assignment order

A, E, D, C, B, and then it cycles. Team 1 gets A, team 6 gets A again. With three teams the room sees 90.0, 69.6 and 75.0.

## 6. Session flow

1. **Create.** The instructor chooses the mode (required, no default) and the number of teams or participants (minimum three, refused below that). The clock minutes default from config.
2. **Join.** Participants join through the platform launch token. Teams get sheets in assignment order.
3. **Play.** The student view shows the briefing, the data pack (sortable tables plus a CSV download) and the team's own sheet. The clock runs on its own, with a warning at two minutes.
4. **Commit.** A number to one decimal and a confidence from 1 to 5. The lock is final with no edit. At zero, uncommitted teams lock as "No number reported."
5. **Reveal Stage 1** (projector, instructor-advanced). Every number and confidence, shown by team name, all at once, and not grouped by sheet.
6. **Reveal Stage 2** (projector, instructor-advanced). Sheets attached, the contested line highlighted, department and purpose shown, same-sheet teams grouped, each with a worked derivation generated by the engine. The instructor can select any two teams for a side-by-side view.
7. **Complete.** A completion callback goes to the platform.

## 7. Student view rules

The student payload contains only the team's own sheet. It never contains another sheet's contested line, any department name or purpose line, any other team's number, or any expected result. Student screens stay on their own locked number through both reveal stages. Nothing is scored, ranked or compared in the student view.

## 8. Instructor console

- **Pre-reveal (projector-safe):** team names, a committed / not-committed status, and the clock. No numbers are shown.
- **Stage 1 and Stage 2 screens** as in section 6.
- **Error check (private):** any committed number more than ±0.1 from its sheet's correct value is flagged. DECIDED: the flag lives on a separate private check page the instructor opens on their own laptop or phone. It isn't linked from the projected console.

## 9. Engine

The engine is made of pure functions, one per sheet, each computing the result from the pack records. The pack is the single source of truth, and no result is hard-coded in the UI. The Stage 2 derivations are generated from the same functions, so what's projected is the calculation itself. It uses Node.js with no external dependencies, matching house conventions.

## 10. Config (`data/config.js`)

`clockMinutes` (25), `warningMinutes` (2), `minTeams` (3), `errorTolerance` (0.1), `assignmentOrder` (["A","E","D","C","B"]), `expectedResults` (the gate's reference values).

## 11. Build gate (refuses to ship if any check fails)

1. The engine output for each sheet equals `expectedResults`.
2. All five results are distinct, with a spread of at least 10 points from top to bottom.
3. Every sheet differs from every other sheet in exactly one line, checked by line diff.
4. The student bundle and payloads contain no department name, purpose line or other sheet's contested wording. **The leak check must be validated against the real payload builder, not a hand-typed string.**
5. The materials contain no forbidden names: course numbers, institution names, "semester", years, weekday names. The list lives in config.
6. No placeholder text (TODO, lorem, TBD, [NAME]).
7. The sim id isn't a retired id (`rapid-03-bench`).
8. `vercel.json` doesn't contain `deploymentEnabled: false`.
9. `SIM_URL` is set explicitly and isn't derived from the request host.

## 12. Debrief guide (instructor-facing, short)

The debrief starts with disagreement. Before Stage 2, the instructor asks two teams with far-apart numbers (A and E are the widest) to defend them. Naming comes second. A number is a definition plus a measurement plus a purpose, and Stage 2 shows all three. The turn onto the student comes last: each student writes down a number they're judged by, its definition, and what that definition leaves out. Optional enrichment covers batting average, Oakland, the measure becoming the target, and betting odds. The sim never depends on it.

## 13. Open items

1. Platform backlog: a faculty-only section flag for catalogue detail pages (for all sims).
2. Akshay confirms `rapid-04-whose-number` has no existing database rows before the first deploy.
