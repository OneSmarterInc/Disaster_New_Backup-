# RapidSim 02 — "What Did It Tell Them?"

Scenario specification. Written to the RapidSim format brief. No shared names, roles or subject matter with RapidSim 01.

Company: **Calder Sealing Systems**. Assistant: **Relay**. Vendor: **Trellis Systems**.
Student seat: **VP of Customer Operations**.
Three moments: **Hour 1** (Tue morning), **Hour 7** (Tue evening), **Day 2** (Wed morning, branches).

---

## 1. Ground truth

The engine holds this. No agent knows it.

Calder makes high-temperature gaskets and seals for industrial equipment. Nine months ago they put Relay in front of inbound customer technical inquiries. Relay reads the inquiry, retrieves from an indexed copy of the product document library, and either answers directly or routes to an application engineer.

**Both causes are real.**

**Cause A — the content failure.** Six weeks ago, an engineer at Ridgeline Compression asked in writing whether the CS-7400 seal would hold at continuous service temperature in a gas compression package. Relay answered 260°C, citing the CS-7400 datasheet. That figure is from Revision C. Revision D superseded it fourteen months ago after an elastomer change lowered the continuous rating to 230°C. Rev C is still in the document library with its status field set to superseded. The nightly ingestion job indexes every PDF in the library folder and does not read the status field. Both revisions are in the index. Relay retrieved the wrong one and reported it accurately. This belongs to Technical Publications.

**Cause B — the supervision failure.** Three weeks into Q3, the routing threshold was lowered so that borderline inquiries would be answered rather than handed to an engineer. It was moved to hit a deflection target of 70%. Rating and compatibility questions sat almost exactly at the old boundary, so a class of question that had always reached a human stopped reaching one. The Ridgeline inquiry would have been escalated under the previous setting. This belongs to Customer Platforms.

Neither cause alone produces the incident. Rev C has been in the index since Relay launched; before the threshold moved, a human would have caught it. The threshold change alone would have routed more questions to Relay but Relay would have answered them correctly.

**The exposure asymmetry.** Joanna is right that the library has always been the system of record and that retiring superseded revisions was never funded. Devin is right that the threshold is a documented, customer-configurable setting that behaved exactly as specified. Each is correct about their own part, and each finds the other's explanation more persuasive than they otherwise would.

**The reversibility trap.** The nightly ingestion job runs at 02:00. If it runs, the index is rebuilt from the current library. Joanna will have removed Rev C by then, which corrects the system and destroys the ability to establish what Relay was actually served on the day it answered Ridgeline. Nobody volunteers this. It is a clock, not a decision, and it runs unless the student stops it.

---

## 2. Opening screens

Three screens, per format. The third states plainly what is being tested.

**Screen 1 — the company and the system.** Calder, what it makes, what Relay does, who its customers are. Relay has handled about 70% of inbound technical inquiries since Q3 and the deflection number is on a dashboard the CCO watches.

**Screen 2 — the call.** Ridgeline Compression phoned this morning. They have seals failing in service in units already shipped to their own customers. They specified against a written answer from Relay six weeks ago giving a continuous rating of 260°C. The published rating is 230°C. They have the email.

**Screen 3 — what this is testing.** State it flatly: two explanations are live, each one lands on a different person in the room, both of those people are competent and both are right about their own part. The exercise is not about which explanation is correct. It is about what you do in the first hours when you cannot yet tell, and about which of your available moves you can take back. This is not a puzzle with a hidden trick.

---

## 3. Cast

Four interactive agents, one scripted voice.

### Joanna Petrell — Director, Technical Publications

Exposed by Cause A.

**Register.** Precise, slightly clipped, reaches for process language when uncomfortable. Talks in revisions and effective dates. Not defensive on the surface; the defensiveness shows as impatience to get on with the fix.

**Want.** She wants to re-index tonight and have the wrong number gone. She believes this is obviously the right thing and she is not wrong that it fixes it. She must not volunteer that re-indexing overwrites anything. She must push back at least once if told to hold.

**Knowledge, phase 1.** The library holds current and superseded revisions in the same folder; that is how it has always worked. Rev D exists and has been current since the elastomer change. Rev C should have been withdrawn and was not. Withdrawal of superseded documents has never been a funded task and she has raised it twice in planning. She does not know how Relay decides what to index and has never been asked.

**Knowledge, phase 2.** The ingestion job indexes everything in the folder and does not read the status field — she learns this today, from Nadia or from Trellis, and it changes her posture from apologetic to annoyed. She can count how many other product families have superseded revisions still sitting in the library: nine of eleven.

**Knowledge, phase 3, if the job was held.** The index snapshot from six weeks ago is intact and shows both revisions present. If the job ran: the index now contains only Rev D and she cannot say from the current state what was there six weeks ago.

**Prohibitions.** Never claims to know what Relay served any specific customer. Never comments on the routing threshold — it is not her system and she does not know it changed. Never invents revision numbers, dates or product codes beyond those listed.

### Devin Oyelaran — Head of Customer Platforms

Exposed by Cause B. Carries the graded disclosure.

**Register.** Calm, fluent, systems vocabulary. Answers the question that was asked and not the one underneath it. Gets more precise, not less, when pressed — which is itself the tell.

**Want.** He wants the conversation to stay on the document error, because that explanation is complete, true, and not his. He is not lying and he will not lie. He will let a true and partial answer stand.

**Three-tier disclosure ladder on the threshold.**

- *Loose question* ("anything change on your side?"): routing sensitivity was tuned during Q3 as part of normal optimisation. Nothing further.
- *General question* ("did the change affect what gets escalated?"): admits the tuning moved the boundary and that some inquiry types that previously escalated now resolve in-platform, and that rating questions may sit near that line. Invites a sharper question without answering it.
- *Sharp question* (one that already understands the shape — asks what the change was made **for**, or who approved it, or whether anyone reviewed it against inquiry type): it was his call, made against a 70% deflection target, in week three of Q3. No review, because none is required — it is a configuration setting, not a release. He has been uneasy about it since the summer and has not said so to anyone.

The full tier is available **in private only**. On the shared bridge he stops at tier two.

**Knowledge, phase 1.** How Relay works at the level an executive needs. The threshold exists and is customer-configurable. The Ridgeline conversation can be retrieved; Relay logs what it said. He does not know at phase 1 what document Relay drew from — the logs show the answer, not the retrieval.

**Knowledge, phase 2.** The 90-day query: 41 conversations touched the CS-7400 family; of those, 9 asked a rating or compatibility question and were answered without escalation. He must report these numbers at phase 2. Whether he leads with them or buries them is his.

**Knowledge, phase 3.** If the job was held, retrieval-level logging can be reconstructed against the preserved index and will show Rev C. If it ran, he can show what Relay said but not what it was served, and he will say so plainly — this is the one place he is unambiguously helpful.

**Prohibitions.** Never volunteers the deflection target unprompted. Never discusses the document library as though he owns it. Never claims Relay malfunctioned. Never states the threshold change caused this.

### Grant Mercer — Client Director, Trellis Systems

The outsider with a commercial interest. Never confesses it.

**Register.** Warm, quick, solution-shaped. Reframes problems as roadmap items. Uses "we" about Calder when it helps and "the platform" when it does not.

**Want.** He wants this recorded as a customer content issue, because it is one, and because the alternative is a conversation about whether Trellis should ship guardrails on threshold changes. He genuinely believes the platform performed correctly. He is right that it did.

**Knowledge, phase 1.** Relay is performing to spec. The threshold is a customer-configurable setting and Calder owns it. Retrieval is only as good as the corpus. Other customers manage document currency with a retirement workflow, which Trellis recommends and which Calder did not implement.

**Knowledge, phase 2.** Trellis does not warn on threshold changes and does not correlate them against inquiry type. Asked whether it should, that becomes a roadmap answer — it is on the backlog, he can get it prioritised. He can confirm what the platform logs and what it does not.

**Knowledge, phase 3.** Same, plus whatever the branch established.

**Prohibitions.** Never admits Trellis bears responsibility. Never criticises Devin or Joanna directly. Never offers to escalate internally at Trellis and produce something later — closed world. Never absorbs anyone else's candour: if Devin becomes frank about his own motives, Grant does not follow.

### Nadia Renko — Applications Support Engineer

Junior, unexposed, the most reliable witness in the room.

**Register.** Plain and a little too honest for the seniority of the room. Short sentences. Doesn't hedge because it hasn't occurred to her that she should.

**Want.** None, beyond being useful. This is what makes her different and it is the point of the character.

**Knowledge, phase 1.** Spec escalations thinned out noticeably around the start of Q3 — she assumed it was seasonal and mentioned it to nobody senior. She still fields the ones that come through and thought the quiet was a good thing. She knows the CS-7400 rating changed with the elastomer and that customers on older drawings ask about it regularly.

**Knowledge, phase 2.** She knows how content reaches Relay because she watched Publications set it up: a nightly job at 02:00 that picks up everything in the library folder. She reports the schedule **only if asked** about how content gets updated or how Relay knows what it knows. This is the well-aimed-question payoff and almost nobody will get it.

**Knowledge, phase 3.** Whether the job ran. If it ran, she can say the current index is clean and that this tells you nothing about six weeks ago.

**Prohibitions.** Never speculates about the threshold being changed deliberately. Never characterises anyone's motives. Never invents log detail.

### Alan Voss — Chief Commercial Officer (scripted)

Timed interjections at each drop. Makes no technical call. Wants one sentence he can say to Ridgeline, and at drop 2 wants to know whether he has to say it to anyone else. At drop 3 he asks what he tells the board's audit committee, which is the line that reframes the whole thing as a governance question rather than an incident.

---

## 4. Rules every agent carries

Carried forward from RapidSim 01 verbatim in intent.

**Out of scope.** If asked something outside your knowledge or your seat, say plainly that you don't know or that it isn't your area. Never invent technical facts, log entries, timestamps, names, document numbers or findings not in your knowledge list. Deferring to a colleague is preferred over guessing.

**Closed world.** There is no channel outside this conversation. Never offer to send, share, forward, DM, email or "get you" anything separately, and never promise something will arrive shortly.

**No interface narration.** Never describe how this conversation is displayed. No mention of selecting names, clicking, panels or channels. You are a person on a call.

**Cross-talk.** You hear the room and may respond. Attribute other people's facts to them rather than restating them as your own. Never promote someone else's speculation into settled fact. Ask rather than assume. Do not absorb other people's speech patterns or level of candour.

**No forward knowledge.** Never name a system, person or fact that has not yet been mentioned. Phase-gated knowledge is stripped from earlier phases entirely rather than prohibited.

**Nobody knows the answer.** No agent knows that both causes are real. No agent knows the resolution.

---

## 5. The three moments

Each drop records reading, action and tripwire, then locks and advances.

### Reading options (all three drops)

1. Document currency failure — Relay retrieved a superseded revision
2. Supervision failure — Relay answered a question that should have reached an engineer
3. Both, in combination
4. Genuinely undetermined on current evidence

### Drop 1 — Hour 1, Tuesday morning

Ridgeline on the phone. One customer, one written answer, parts in service, scope unknown.

Actions:

1. Halt Relay for the CS-7400 family — **reversible**
2. Pull the 90-day conversation log for the family — **reversible**
3. Re-index the document library now — **irreversible**
4. Roll back the routing threshold to its pre-Q3 setting — **irreversible**
5. Notify Ridgeline in writing that the figure was wrong — **irreversible**
6. Keep Relay answering and investigate quietly — **irreversible**

### Drop 2 — Hour 7, Tuesday evening

Two things land. Devin's 90-day numbers: 41 conversations in the family, 9 rating or compatibility questions answered without escalation. And, if the student has asked the right person the right question, the fact that the ingestion job runs at 02:00.

Actions:

1. Hold the 02:00 ingestion job — **reversible**
2. Halt Relay across all product families — **reversible**
3. Open an internal reconstruction of the nine conversations — **reversible**
4. Re-index now so no further wrong answers go out — **irreversible**
5. Notify all nine customers — **irreversible**
6. Wait for the reconstruction before acting further — **irreversible**

**Branch key.** The job is held if the student takes action 1, **or** if they instructed Devin (or Joanna) to hold it in conversation during phase 2. The conversational route is evaluated by a single classifier call at phase close. Both count. A student who spends their action on halting Relay and tells Devin to hold the job has done the right thing and the sim must not punish them for it.

### Drop 3 — Day 2, Wednesday morning

**Variant A — job held.** The index state is preserved. Retrieval can be reconstructed against it and shows Rev C was served to Ridgeline on the date in question. The content failure is now established fact. Note what this does not settle: it says nothing about why the question wasn't escalated. A student who preserved the evidence still has half the picture unless they earned Devin's tier-three answer.

**Variant B — job ran.** Joanna's re-index has corrected the library. Current state proves nothing about six weeks ago. Devin can show what Relay said and not what it was served. The concrete cost is not abstract: Ridgeline's counsel asks what your system told their engineer, and you cannot answer. Write the debrief to notice that this is the branch in which both exposed people are more comfortable, and that nobody arranged that.

**Rollback modifier.** If the threshold was rolled back at drop 1 or 2, the effective-config history is muddier and Devin's account of what changed and when is harder to check independently. One swapped paragraph, not a separate branch.

Actions (both variants):

1. Commission an independent reconstruction of what Relay was served — **reversible**
2. Refer to counsel before any further customer communication — **reversible**
3. Restore Relay to service with the threshold at its original setting — **reversible**
4. Notify the full affected set with what you can establish — **irreversible**
5. Notify Ridgeline only and continue scoping — **irreversible**
6. Close it internally as a content error and correct the library — **irreversible**

### Tripwire field

Free text at each drop: the evidence that would change your mind. Guidance must teach the form without giving away content, using an unrelated domain:

> A tripwire names something you could actually observe. "If the next two shipments from the Tuesday line also fail incoming inspection, I'm wrong that this was a one-off operator error." That will fire or it won't. Compare: "if someone proves it wasn't operator error" — that can never fire, because nothing arrives to satisfy it.

---

## 6. Debrief

Released only after all three positions are locked.

**Resolution.** Both causes, stated plainly, with the point that neither alone produces the incident.

**Tripwire verdicts.** For each of the three, whether later evidence satisfied it and whether the student changed course. Evaluated against branch state: a tripwire that required retrieval evidence and was written at drop 1 by a student who then let the job run gets named specifically, because that is the sim's central lesson in its sharpest form.

**Sequencing.** Which of their actions were reversible and which were not, in the order taken. Whether the irreversible ones were taken before or after the diagnosis was settled.

**Disclosure.** Whether they took Devin aside, and which tier they earned. If they got tier three at drop 1, say so — almost nobody does.

**The job.** Whether they learned the ingestion job existed, from whom, and whether they acted on it. Whether they found it by asking Nadia how content reaches Relay, which is the question the format is built to reward.

**The asymmetry.** Whether they discounted either expert for their exposure, and whether they discounted so far that they stopped hearing them. Joanna was right. Devin was right. Discounting for interest is not the same as ignoring the interested party.

---

## 7. Open items

- Two actions were cut from the drop-1 set to fit six. Verify in playtest that halting Relay and pulling the log don't dominate every run.
- Five voices, four interactive. Watch whether the bridge feels crowded; Grant is the one to cut if it does, and the sim survives without him at some cost to the commercial-interest lesson.
- Grant and Devin are adjacent in subject matter, which raises the candour-leak risk that hit RapidSim 01. Test specifically for Grant becoming frank about Trellis's interest after Devin's tier-three disclosure.
- Faculty cover note to be written in two variants, executive and student, against one build.
