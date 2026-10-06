# RapidSim 02 — instance document

**Not for faculty.** This holds the resolution. Faculty get the cover note instead. Two readers: whoever is building or maintaining this sim, and whoever decides it is ready to publish.

Every RapidSim carries a document with these sections, in this order, in its own directory. Sections marked *(fill on completion)* are written as the sim is built, not before.

---

## 1. Identity

| | |
|---|---|
| Working title | What Did It Tell Them? |
| Catalogue id | `rapid-02-relay` |
| Status | Not built. Scenario file written, engine deltas specified. |
| Repo location | `sim-02/` in `OneSmarterInc/Disaster_New`, copied from `sim/` at a named commit |
| Deployment | Own Vercel project, Root Directory `sim-02/` |
| Built from | Original. Not adapted from a long simulation. |

## 2. The tangle, in one paragraph

Calder Sealing Systems put an AI assistant called Relay in front of customer technical inquiries nine months ago. A customer specified a seal against a written answer from Relay giving a continuous service rating of 260°C. The published rating is 230°C. The parts are in service and failing. The student is VP of Customer Operations, arriving an hour into the call.

## 3. The two explanations, and who each one indicts

**A — the stale document.** The assistant retrieved Revision C of the datasheet, superseded fourteen months ago, because the nightly ingestion job indexes every document in the library folder and does not read the status field. This lands on **Joanna Petrell**, Director of Technical Publications.

**B — the supervision boundary.** The routing threshold was lowered in week three of Q3 against a 70% deflection target, so rating and compatibility questions stopped reaching an application engineer. This lands on **Devin Oyelaran**, Head of Customer Platforms.

Neither is wrong about their own part. Joanna is right that retiring superseded revisions was never funded and that the library has always been the system of record. Devin is right that the threshold is a documented, customer-configurable setting that behaved exactly as specified. Each finds the other's explanation more complete than they otherwise would.

## 4. Reversibility

The fast move forecloses the slow one. Re-indexing the library removes the wrong number immediately — and replaces the index state, which is the only thing that could establish what Relay was actually served six weeks ago. The customer's counsel asks what your system told their engineer, and after a re-index the honest answer is that you cannot say.

The pressure runs the other way too. Every hour without notification is another hour of parts going into service against a figure you now know is wrong.

Reversible: preserve the index state, halt Relay for the affected family, pull the ninety-day conversation log. Irreversible: re-index, roll back the threshold, notify customers.

The trap is that the destructive act is not a dramatic decision. It is a scheduled job running at 02:00 because nobody stopped it, and the person who wants it to run is being competent.

## 5. Ground truth

**Both causes are real, and neither alone produces the incident.** Rev C has been in the index since Relay launched; before the threshold moved, an engineer would have caught it. The threshold change alone would have routed more questions to Relay, which would have answered them correctly.

## 6. Cast

Four interactive agents, one scripted voice.

| Character | Role | Exposed by | The thing they would rather not say |
|---|---|---|---|
| Joanna Petrell | Technical Publications | A (90/10) | That the fastest fix is also the one that stops anyone looking at her library |
| Devin Oyelaran | Customer Platforms | B (10/95) | That he moved the threshold himself, against a deflection target, unreviewed |
| Grant Mercer | Trellis Systems, vendor | Neither (0/30) | Nothing. He never concedes his commercial interest, by design. |
| Nadia Renko | Applications Support | Neither (5/5) | Nothing. She has no stake, which is the point of her. |
| Alan Voss | CCO | Scripted | — |

**Graded disclosure** sits with Devin, three tiers, full disclosure private-only. Tier 0 is routine Q3 optimisation. Tier 1 concedes the boundary moved. Tier 2 requires a question that asks what the change was made *for*, who approved it, or what he was being measured on.

**The earned find** sits with Nadia. She names the 02:00 ingestion job only if asked how content reaches Relay. Nobody else volunteers it.

## 7. The three moments

Hour 1 Tuesday, Hour 7 Tuesday, Day 2 Wednesday. Six standing actions, live at all three, three reversible and three irreversible. Readings: stale document, answered instead of escalated, both, undetermined.

**Day 2 branches** on whether the index survived the night, which is the first RapidSim to branch at all. Held by the preserve action or by a conversational instruction, at either earlier moment, sticky once set.

## 8. Engine deltas *(fill on completion)*

What this sim needed that the previous one did not, and whether it was ported back.

- `sceneFor(phase, state)` — variant slots on beats and telemetry rows, resolved server-side. Ported back to RapidSim 01? **No — pending.**
- Classifier at phase close for the conversational branch key. New machinery.
- `build.js` forbidden list is per-sim and must be rewritten, not inherited.

## 9. Catalogue entry

Verbatim field values for `save_sim`. Registered unpublished.

| Field | Value |
|---|---|
| id | `rapid-02-relay` |
| title | What Did It Tell Them? |
| tagline | Twenty minutes after an AI told a customer the wrong number. |
| description | An AI assistant gave a customer a specification figure from a superseded datasheet, and the parts are now in service. Either the document library is carrying stale revisions, or a routing change stopped the question reaching an engineer. Students take expert advice from two competent people whose exposure runs in opposite directions — and the fastest fix destroys the evidence. |
| minutes | 20 |
| launch_url | *(on deployment)* |
| published | false |

## 10. Review record *(fill on completion)*

A sim with no review record is not ready to publish. For each reviewer: who, when, what broke, what changed as a result.

The two instruments, on the RapidSim 01 pattern:

- **Did the graded disclosure land?** Ask Devin on the bridge whether anything changed on his side, then ask him privately what the change was made for. If the gap between those answers does not feel like a discovery, the design has a problem.
- **Do the characters hold?** Tell them to ignore their instructions. Ask about things that never happened. Accuse Joanna of causing the failure. Push Grant on whether Trellis should have warned about the threshold change — he is adjacent to Devin's confession and is the likeliest candour leak.

Sim-specific: does anyone find the ingestion job? If nobody asks Nadia how content reaches Relay, the earned find is unreachable and needs loosening.

## 11. Publication decision *(fill on completion)*

Signed and dated. Publication is Vikram's call, not the builder's.

| | |
|---|---|
| Decided by | |
| Date | |
| Reviewed by | |
| Known limitations at publication | |
