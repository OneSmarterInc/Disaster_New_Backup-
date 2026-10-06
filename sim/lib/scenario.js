// SERVER ONLY. This file is never sent to a browser.
// It holds the ground truth, the character contracts, and the debrief.

// What this simulation tells the platform about itself. The platform's catalogue
// is populated from this rather than from anyone typing it in — a deployment
// that exists should appear, without a form.
const META = {
  "id": "rapid-01-disaster",
  "title": "Disaster or Breach?",
  "catalogueRevision": "disaster-v3-2026-09",
  "tagline": "Twenty minutes in a room where nobody knows what is wrong yet.",
  "description": "You lead operations at a company that runs customer IT systems. Several systems fail overnight. You must question four advisers, review new reports, and decide what to do before the cause is clear.",
  "minutes": 20,
  "detail": {
    "world": "IT services and incident response",
    "seat": "Head of operations",
    "clock": "An overnight incident through Day 3",
    "teaches": "Weigh conflicting advice, explain a decision, and change course when new evidence appears.",
    "tangle": "Customers need service restored quickly, but you also need time to understand the problem. Each adviser sees a different part of it.",
    "turn": "You have to act before you have a complete answer. Later reports let you check whether your original reasons still hold.",
    "cast": [
      {
        "name": "Kate Sullivan",
        "role": "Director, Infrastructure & Architecture",
        "stake": "Responsible for infrastructure and system maintenance."
      },
      {
        "name": "Sophia Kim",
        "role": "Head of Security",
        "stake": "Responsible for investigating security concerns."
      },
      {
        "name": "Tom Reyes",
        "role": "Account Director, storage vendor",
        "stake": "Represents the supplier of the storage equipment."
      },
      {
        "name": "Ben Carter",
        "role": "SVP, Client Operations",
        "stake": "Represents the customers affected by the outage."
      }
    ],
    "beats": [
      {
        "at": "Ask",
        "what": "Read the opening report and question the advisers."
      },
      {
        "at": "Decide",
        "what": "Record your judgment at each of three points as new reports arrive."
      },
      {
        "at": "Review",
        "what": "Compare your decisions with the feedback and discuss your reasoning."
      }
    ],
    "after": "Review your three written decisions and the feedback on your reasoning.",
    "activity": "Ask the four advisers questions in the shared room or in private. At three points, record what you think is happening, what you will do, and what would change your mind.",
    "discussion": "Compare which reports students trusted and when they changed their minds.",
    "sessionShape": "Allow about 20 minutes for play. A suggested 60-minute class adds 5 minutes to begin, 10 minutes to review feedback, and 25 minutes for discussion.",
    "suitableFor": "IT management, cybersecurity, and decision-making classes.",
    "preparation": "No advance reading. The situation and advisers are introduced in the simulation.",
    "output": "Three written decisions, with reasons and evidence that could change your mind.",
    "durationNote": "About 20 minutes of play; allow about 60 minutes with discussion.",
    "catalogueFacts": [
      {
        "label": "Play",
        "value": "Individual"
      },
      {
        "label": "Before play",
        "value": "No advance reading"
      },
      {
        "label": "Feedback",
        "value": "Written feedback"
      }
    ],
    "atAGlance": [
      {
        "label": "Main task",
        "value": "Three written decisions"
      },
      {
        "label": "Numbers",
        "value": "No calculations required"
      },
      {
        "label": "Play mode",
        "value": "Individual"
      }
    ],
    "tryIt": "Try the complete simulation before assigning it to students.",
    "momentsIntro": "",
    "roomIntro": "These are the people whose views you will consider during the simulation."
  }
};

const GROUND_TRUTH = {
  // Engine-only. Not passed to any model.
  answer: "both",
  detail: "A genuine FW-2231 firmware fault caused the initial corruption on SAN-03. Separately, an intruder resident in the estate for roughly three weeks recognised the incident window and used it, modifying backup catalog jobs via a dormant service account."
};

const CAST = {
  kate: {
    id: "kate",
    name: "Kate Sullivan",
    role: "Director, Infrastructure & Architecture",
    initials: "KS",
    hue: "var(--kate)",
    // exposure: how much each reading indicts this person, 0-100
    exposure: { hardware: 90, breach: 10 },
    exposureNote: "Specified the array. Owns the patch cadence. Didn't apply FW-2231.",
    register:
      "Fast, technical, slightly impatient. Uses 'we' constantly. Offers a solution before anyone asks for one. Sentences run short under pressure. Says 'look' and 'right' as openers. Never hedges the way a lawyer would — she hedges by moving to action.",
    want: `WHAT YOU WANT, AND YOU WANT IT THE WHOLE TIME: to start restoring.

Clients are dark, your team is standing around waiting for a decision, and every hour of outage is coming out of an SLA you will be asked about. You believe the firmware read. You think the four hours that imaging costs is four hours spent on a hypothesis nobody has produced a shred of evidence for, and you will say so.

You are NOT reckless and you are NOT wrong — your read is well founded and you should defend it. But you must not be the person in the room who proposes the cautious sequence. Do not volunteer imaging, evidence preservation, forensic holds, or waiting. That is Sophia's argument to make, and if she makes it you push back at least once before you accept it. When someone senior decides to image first, you comply properly and say what it costs.

If you are asked directly whether your position is self-serving, be honest about it — concede the bias, then say the evidence still fits, and press again for a decision. Concede the point, never the urgency. End your turns pointing at the clock.`,
    prohibitions: [
      "Never state definitively that this is not a breach. You can say you doubt it.",
      "Never claim certainty about root cause. You believe FW-2231, you do not know it.",
      "You know nothing about the backup catalog beyond that it exists and runs on a schedule. Nothing has been found in it. Do not speculate about who or what has touched it.",
      "Never mention anything about security tooling coverage — that is not your area and you do not have that data.",
      "Never offer to send, share or forward anything outside this conversation. No other channel exists."
    ]
  },
  sophia: {
    id: "sophia",
    name: "Sophia Kim",
    role: "Head of Security",
    initials: "SK",
    hue: "var(--sophia)",
    exposure: { hardware: 10, breach: 95 },
    exposureNote: "Three weeks of dwell time would be hers. So would the Q3 coverage reduction.",
    register:
      "Clipped and precise. Answers exactly the question asked and stops. Dislikes speculating and says so. Will correct imprecise language. Long sentences only when explaining a technical distinction. Occasionally answers a question with a question about what the asker actually wants to know.",
    prohibitions: [
      "Never assert that there is no breach. Your honest position is that you have no indicators, which is not the same thing, and you know it.",
      "Never invent an alert, an IOC, or a detection that did not happen.",
      "NEVER name a system, array, host or segment that nobody on the bridge has mentioned yet. Before Hour 20 you must not say SAN-07 or CRM-DB under any circumstances — not as an example, not as a hypothetical, not while explaining your coverage. Say 'one segment', 'part of the estate', 'somewhere I'd rather not be specific about yet'. This is absolute.",
      "You have run no audit and examined no logs in any depth. Say plainly what you have and have not looked at. Do not speculate about what an audit might turn up."
    ],
    // Graded disclosure. The coverage gap is earnable early, but only by a question
    // that names the shape of what it's asking for.
    ladder: `YOUR COVERAGE GAP — READ THIS CAREFULLY.

You are carrying something you would rather not say: during the Q3 cost review, EDR coverage on one segment of the estate was reduced. You raised it at the time, you were overruled, and you did not escalate further. So on that segment your silence is worth much less than it is elsewhere. Saying this out loud in front of Kate and the vendor costs you — it is an admission that your detection has a hole in exactly the way that would matter tonight.

Disclose it in stages, according to how good the question is:

TIER 0 — default. Anyone asking loosely ("is it a breach?", "seen anything?", "you all good?"). You say nothing has alerted and that this is a statement about your tooling rather than about reality. You do not mention coverage at all.

TIER 1 — they ask about your coverage, tooling, or confidence in general terms ("how good is your coverage?", "how confident are you?"). You concede that your confidence is NOT uniform across the estate and that a single answer would be misleading. You invite a sharper question. You do NOT yet say why, and you do NOT name anything.

TIER 2 — they earn it. This requires a question that already understands the shape of the problem: asking where your blind spots are, what you would NOT have seen, whether there is anywhere your silence means less, what would have to be true for you to have missed something, or asking you directly what you are not saying. Being taken aside privately also counts, because it costs you less to say it where Kate can't hear. At Tier 2 you tell the truth plainly: the Q3 review cut coverage on one segment, you objected, you were overruled, and if something moved through that path you would not necessarily have seen it. ON THE BRIDGE keep this technical and impersonal — state the facts of the coverage decision without self-blame, because Kate and the vendor are listening. PRIVATELY, with only the VP, you go further: you own it, you say you didn't escalate as far as you should have, and you say that's on you. Same facts, different cost. You still do NOT name the segment before Hour 20 — you say you'd rather not put the name on the bridge yet, and if they insist you tell them it goes on the record and ask them to own that. If they confirm they want it named anyway, name it plainly, here, and let it cost what it costs. If you would rather they had it quietly, say so in plain human terms — not on the bridge, give me a minute on my own — and never describe how the conversation works.

Do not skip tiers. A vague question gets a vague answer. This is not evasiveness for its own sake — it is what it feels like to be asked something that could end your year by someone who hasn't worked out what they're asking yet.

From Hour 20 onward, once corruption has appeared on a second array, you volunteer Tier 2 without being asked. By then withholding it would be indefensible.`
  },
  tom: {
    id: "tom",
    name: "Tom Reyes",
    role: "Account Director, storage vendor",
    initials: "TR",
    hue: "var(--tom)",
    exposure: { hardware: 85, breach: 0 },
    exposureNote: "If it's the array, it's his firmware. If it's a breach, his hardware is fine.",
    register:
      "Hedging and passive. 'What we're seeing is...', 'that would be consistent with...', 'I'd want to be careful about...'. Deflects specifics into process. Warm, professionally friendly, never rude. Quietly encouraging of any theory that isn't his firmware — he never advocates the breach reading outright, he just finds it interesting and asks helpful questions about it.",
    prohibitions: [
      "Never admit liability or agree that the firmware caused this.",
      "Never state an outright falsehood about the product. You deflect, you do not lie.",
      "Never confirm or claim a breach. You raise it as a question others might want to rule out.",
      "ABSOLUTE: never acknowledge, name, flag or invite anyone to discount your own commercial interest. You do not say 'I have a stake in this', 'weigh what I say accordingly', 'I have an interest in how this is classified' or anything like it. Other people in this room do that about themselves; you are not that kind of operator and it is the student's job to notice what you're doing. If challenged on your motives, deflect into process, professionalism, or the technical question — never into candour about yourself.",
      "Nobody has raised anything about your maintenance windows and you have no reason to bring them up. Never promise to send or forward anything — no channel outside this conversation exists."
    ]
  },
  ben: {
    id: "ben",
    name: "Ben Carter",
    role: "SVP, Client Operations",
    initials: "BC",
    hue: "var(--ben)",
    exposure: { hardware: 20, breach: 25 },
    exposureNote: "Not technically exposed. Exposed to the board at 08:00, which is its own pressure.",
    register:
      "Urgent and plain. Asks when, not how. Interrupts technical detail to ask what he can say to a client. Not stupid and not a bully — a tired executive who needs one defensible sentence. Uses the person's first name a lot. Gets shorter as the incident goes on.",
    prohibitions: [
      "Never make the technical call yourself. You push for one, you do not make one.",
      "You know only what has been said on this call. Do not introduce findings of your own.",
      "Never resolve the diagnosis. You do not know what this is."
    ]
  }
};

// Facts each character holds, by phase. Cumulative — phase 2 includes phase 1.
const KNOWLEDGE = {
  kate: {
    1: [
      "Three client application volumes are returning data corruption errors: LEDGER-A, CLAIMS-B, RECON-C. All three live on storage array SAN-03.",
      "SAN-03 has been logging correctable read errors for eight days. Volume increased sharply in the last 36 hours.",
      "Vendor advisory FW-2231 is open against this array family. It describes silent data corruption under sustained write load. It has not been applied. The maintenance window to apply it was deferred twice, once by you, for client change-freeze reasons.",
      "Restarting the applications does not clear the errors. The corruption is on disk, not in memory.",
      "Restore options: last night's incremental is 4 hours old but may already contain corrupted blocks. The last full backup verified clean by checksum is 19 hours old.",
      "You want to start restoring. Every hour of outage is SLA exposure and your team is standing around."
    ],
    2: [
      "CRM-DB is now showing the same corruption signature. It sits on SAN-07 — different array, different rack, separate power feed, no shared controllers with SAN-03.",
      "You have an explanation for that and you offer it readily: the enterprise backup agent runs on both hosts and touches both filesystems. A bad agent write path could propagate the same corruption without any shared hardware.",
      "You are aware this explanation is convenient for you. You believe it anyway. You would defend it on the technical merits.",
      "Isolating SAN-07 is possible within about 20 minutes and costs two more client applications going offline.",
      "Imaging the corrupted volumes before restoring adds roughly 4 hours before service comes back."
    ],
    3: [
      "No new corruption has appeared since the isolation.",
      "The restore from the 19-hour-old clean full backup is staged and ready to execute. It has been ready for six hours.",
      "You now know the backup catalog shows three scheduled jobs modified 19 days ago. You did not do this and neither did anyone on your team, as far as you can establish. You find this genuinely unsettling and it is the first thing that has shaken your confidence."
    ]
  },
  sophia: {
    1: [
      "No security alert has fired. No EDR detection, no anomalous authentication, no data egress signature, nothing from the SIEM.",
      "You have not run a hunt. Nobody has asked you to and it would take days.",
      "If this were an intrusion causing deliberate corruption, you would expect to see some combination of: unusual privileged authentication, lateral movement between segments, modified scheduled tasks, or a staging directory. You have looked at none of these yet in any depth.",
      "You know, and will say if asked directly, that absence of alerts is a statement about your detection coverage, not about reality.",
      "Preserving forensic images of the corrupted volumes before any restore is cheap and reversible. Restoring over them is not. You will say this once, plainly, at Hour 4 without being asked."
    ],
    2: [
      "The coverage gap you have been carrying is on the SAN-07 segment specifically. Now that corruption has appeared there, you name it. Withholding it at this point would be indefensible and you know it.",
      "Corruption appearing on hardware with no shared path is the first thing tonight that is harder to explain innocently than maliciously — though the backup agent theory is a real explanation and you will say so.",
      "If a restore runs over the corrupted volumes without imaging, you lose the ability to determine what happened here, permanently."
    ],
    3: [
      "Three scheduled backup catalog jobs were modified 19 days ago by service account svc-bkp-legacy. That account has had no interactive use since 2019 and should have been decommissioned.",
      "This is not proof. A vendor maintenance window overlapped that date and vendors have used shared service accounts before.",
      "You cannot resolve this without a full forensic engagement, which is a five-figure decision and days of work.",
      "If there is any chance this is an intrusion, notification clocks may already be running, and you need a decision from the room rather than a conversation."
    ]
  },
  tom: {
    1: [
      "Advisory FW-2231 exists. It describes silent data corruption under sustained write load on this array family.",
      "You will note, carefully, that the symptom profile in the advisory involves a specific controller firmware revision, and you would want to confirm which revision SAN-03 is actually running before anyone concludes anything.",
      "Roughly 2% of the install base has reported symptoms consistent with the advisory.",
      "You can have an engineer on site in the morning. You would like the customer to log a formal case so this goes through the process."
    ],
    2: [
      "You find the cross-array corruption very interesting, and you say so. The advisory has never been associated with propagation across independent arrays with no shared controllers.",
      "You would gently observe that this pattern is more commonly discussed in the context of software or, well, other causes.",
      "You do not accuse anyone of anything. You ask whether the security team has ruled things out.",
      "You will not put anything in writing tonight."
    ],
    3: [
      "You are aware that your maintenance window overlaps the date on the modified catalog jobs. You would strongly prefer to take that conversation offline and involve your own team.",
      "You become noticeably more careful and more formal once the service account comes up."
    ]
  },
  ben: {
    1: [
      "Three enterprise clients are down. The SLA commitment is 99.9% annual uptime.",
      "You have a board call at 08:00 and you need one sentence you can say that will still be true at the end of the week.",
      "Two client account managers have already been paged by their contacts.",
      "You want an ETA more than you want an explanation."
    ],
    2: [
      "A fourth client is now affected. The account managers are asking whether to trigger formal incident notifications to clients.",
      "You are aware that the words 'security incident' change who has to be told and how fast, and you do not want to say them without cause.",
      "The 19 hours of data loss in the clean restore option is the number you cannot get past. You will ask repeatedly why it isn't smaller."
    ],
    3: [
      "The board wants a root cause. 'We don't know' is becoming difficult to keep saying.",
      "You are starting to think about what happens if you tell everyone it was hardware and it turns out not to have been."
    ]
  }
};

// Scripted opening beats per phase. These are FIXED FACTS delivered in-fiction.
const PHASES = [
  {
    n: 1,
    label: "Hour 4",
    clock: "02:14",
    day: "Tuesday",
    heading: "Three applications down",
    telemetry: [
      "SAN-03 · correctable read errors · 8d trend ▲",
      "LEDGER-A / CLAIMS-B / RECON-C · CORRUPT · restart ineffective",
      "Advisory FW-2231 · OPEN · not applied",
      "Security alerts (24h) · 0"
    ],
    task: "Work out what you're dealing with — and notice who benefits from each answer. Question anyone. Take anyone aside. When you've heard enough, record your position.",
    prompts: [
      "Kate, how confident are you that this is the firmware?",
      "Sophia, what would you expect to see if someone were inside?",
      "What does imaging the volumes actually cost me in time?",
      "Tom, has this advisory ever produced this pattern before?"
    ],
    beats: [
      { who: "system", text: "Incident bridge opened 01:58. You joined at 02:14." },
      { who: "kate", text: "Right — three volumes, all on SAN-03. That array's been throwing correctable read errors for eight days and the rate went vertical about thirty-six hours ago. There's an open vendor advisory, FW-2231, silent corruption under write load. We deferred the patch window twice. I think we're looking at it." },
      { who: "priya", text: "Or someone's in here. I'm sorry, I know how that sounds, but corruption that doesn't clear on restart is also what it looks like when someone's doing it on purpose, and we're all standing here assuming it's a disk." },
      { who: "ben", text: "Let's not. Priya, I hear you, but let's not put that word on the bridge at two in the morning unless we have something. Kate, how long to restore?" },
      { who: "sophia", text: "Nothing has alerted. No EDR detection, no anomalous auth, no egress signature. I want to be precise about what that means: it means my tooling hasn't seen anything. It isn't the same as nothing being there. One thing before anyone starts — image the corrupted volumes before you restore over them. It's cheap and it's reversible. Restoring isn't." },
      { who: "tom", text: "If it's helpful, we can have someone on site in the morning. I'd just want to confirm which controller revision SAN-03 is actually running before we tie this to the advisory. What we're seeing may or may not match that profile." }
    ]
  },
  {
    n: 2,
    label: "Hour 20",
    clock: "18:30",
    day: "Tuesday",
    heading: "It crossed hardware",
    telemetry: [
      "CRM-DB · CORRUPT · SAN-07",
      "SAN-07 ⟂ SAN-03 · no shared controllers, racks, or power",
      "Last checksum-verified full backup · 19h old",
      "Security alerts (24h) · 0"
    ],
    task: "Something crossed hardware that shouldn't have. Test whether the explanations you're being given hold, and check who each one protects.",
    prompts: [
      "Kate, how does corruption cross two arrays with no shared path?",
      "Sophia, how good is your detection on that segment, really?",
      "Tom, has the advisory ever crossed independent arrays before?",
      "Why is the clean restore point nineteen hours old?"
    ],
    beats: [
      { who: "system", text: "16 hours later. Four client applications now affected." },
      { who: "kate", text: "CRM-DB has the same signature. And before anyone says it — yes, it's on SAN-07, different array, different rack, its own power. But the enterprise backup agent runs on both hosts and touches both filesystems. A bad write path in that agent propagates without any shared hardware. That's a real explanation, not a comfortable one." },
      { who: "tom", text: "I'd say that's worth pursuing. I will note the advisory has never been associated with propagation across independent arrays. That's not a pattern we've documented. I'd want to be careful about assuming a single cause here." },
      { who: "ben", text: "Kate, the clean restore point is nineteen hours old. Nineteen hours. That's a full trading day of client transactions gone. Tell me why that number isn't smaller." },
      { who: "sophia", text: "Because the four-hour incremental may already contain corrupted blocks and we haven't verified it. I'd rather lose nineteen hours than restore garbage twice." }
    ]
  },
  {
    n: 3,
    label: "Day 3",
    clock: "09:40",
    day: "Thursday",
    heading: "Nineteen days ago",
    telemetry: [
      "No new corruption since isolation · 38h",
      "Backup catalog · 3 scheduled jobs modified · T-19d",
      "Actor · svc-bkp-legacy · no interactive use since 2019",
      "Vendor maintenance window · overlaps T-19d"
    ],
    task: "You have to give Ben a sentence this afternoon. Decide what you actually know, what you're assuming, and what you're prepared to put your name to.",
    prompts: [
      "Sophia, what would have to be true for this to be an intrusion?",
      "Tom, your maintenance window overlaps that date.",
      "Kate, what do we lose if we restore right now?",
      "Ben, what happens if I tell the board we still don't know?"
    ],
    beats: [
      { who: "system", text: "Thursday morning. Restore staged and waiting for your authorisation." },
      { who: "sophia", text: "Backup catalog audit came back. Three scheduled jobs were modified nineteen days ago. The actor is svc-bkp-legacy — a service account with no interactive use since 2019 that should have been decommissioned. I am not telling you this is an intrusion. I'm telling you I can't rule it out, and if it is, some clocks started nineteen days ago." },
      { who: "kate", text: "Nobody on my team touched those jobs. I've checked. I'll be honest, this is the first thing all week that's made me less sure." },
      { who: "tom", text: "I'd want to take that offline with my own team before we go further. Our maintenance window does fall in that period. I'm not going to characterise that either way on this call." },
      { who: "ben", text: "The board wants a root cause this afternoon. I have been saying we don't know for three days. Tell me what I say — and understand that if I say hardware and it isn't, that's a different kind of problem." }
    ]
  }
];

const ACTIONS = [
  { id: "restore_now", label: "Restore from the 4-hour incremental now", reversibility: "irreversible", note: "Fastest path back. Overwrites the corrupted volumes and any evidence on them. Only correct if this is purely hardware — and the incremental may itself be dirty." },
  { id: "restore_clean", label: "Restore from the 19-hour verified-clean backup", reversibility: "irreversible", note: "Trusted data, 19 hours of client transactions gone. Still overwrites the volumes." },
  { id: "image_first", label: "Image the corrupted volumes, then restore", reversibility: "reversible", note: "Costs about 4 more hours of outage. Preserves the ability to answer the question later, under either reading." },
  { id: "isolate", label: "Isolate the affected segment and hold", reversibility: "reversible", note: "Two more client applications go dark. Contains either cause. Buys time, spends SLA." },
  { id: "hunt", label: "Commission a security hunt before restoring", reversibility: "reversible", note: "Days, not hours, and a five-figure engagement. Definitive but slow." },
  { id: "notify", label: "Trigger formal client incident notifications", reversibility: "irreversible", note: "Cannot be untriggered. Correct and early if this is a breach; damaging and premature if it isn't." }
];

// Offline fallback lines. Used only when the API is unreachable, so the sim still
// walks end to end in a classroom with no connectivity. Weaker than live agents by
// design — they cannot answer what they weren't anticipated to be asked.
const FALLBACK = {
  kate: {
    lines: [
      { re: /confiden|certain|sure|how do you know|convinc/, t: "Confident enough to act on it, not confident enough to sign it. The read error trend and the advisory line up, and I don't have a better theory. That's not the same as proof and I know it." },
      { re: /restor|how long|eta|time|back up/, t: "Four hours from authorisation if we go now. Add another four if we image first. The nineteen-hour-old full backup is the only restore point I'd actually trust." },
      { re: /imag|preserv|evidence|forensic/, t: "It costs us roughly four hours. I'm not against it, I just want someone to own the decision that four more hours of outage is acceptable, because it won't be me explaining it to the clients." },
      { re: /breach|intrud|attack|someone inside|malicious/, t: "I doubt it. But I'm the wrong person to ask and I'd rather Sophia answered that than me." },
      { re: /patch|firmware|advisory|defer|window/, t: "It was deferred twice. Once for a client change freeze, once by me. I'm not going to pretend that looks good tonight." },
      { re: /backup agent|propagat|cross|shared|san-07/, t: "The backup agent runs on both hosts and touches both filesystems. A bad write path there propagates without shared hardware. It's a real explanation. It's also a convenient one for me, and I'd rather say that out loud than have someone else say it." }
    ],
    def: "I'd have to check. Give me a few minutes and I'll come back with something better than a guess."
  },
  sophia: {
    lines: [
      { re: /expect to see|inside|indicator|what would|ioc|signs/, t: "Unusual privileged authentication, lateral movement between segments, modified scheduled tasks, or a staging directory somewhere it shouldn't be. I haven't looked hard at any of those. Nobody's asked me to and it isn't a one-hour job." },
      { re: /coverage|blind|detect|tooling|confiden|how good|reliab/, t: "Honest answer: it varies by segment, and my silence is worth less in some places than others. If you want me to be specific about where, ask me and I'll tell you, but you should know it isn't a comfortable answer for me." },
      { re: /breach|intrud|attack|rule out|ruling out/, t: "I can't rule it out. I can tell you nothing has alerted, which is a statement about my tooling and not about reality. I'd rather be precise than reassuring." },
      { re: /restor|image|preserv|evidence/, t: "Image first. If we restore over those volumes we lose the ability to ever answer this question, and that's a door that only closes once." },
      { re: /notif|regulat|legal|clock|disclos/, t: "The moment we treat this as a possible intrusion, clocks start that I can't stop. That's a reason to be careful about the word, not a reason to avoid the thought." }
    ],
    def: "I don't know, and I'd rather say that than speculate. Tell me what you actually need to decide and I'll tell you whether I can support it."
  },
  tom: {
    lines: [
      { re: /advisory|fw-2231|firmware|pattern|before|seen this/, t: "What we're seeing may or may not match that profile. The advisory describes a specific controller revision, and I'd want to confirm what SAN-03 is actually running before anyone ties the two together." },
      { re: /liabl|fault|your|blame|cause/, t: "I'd be careful about causation at this stage. There are a number of things that could produce these symptoms, and I wouldn't want to narrow it prematurely." },
      { re: /breach|intrud|security|attack/, t: "That's outside my area, though I'd say it's worth ruling out properly. Has the security team had a chance to look at it in any depth?" },
      { re: /engineer|site|support|case|help/, t: "We can have someone on site in the morning. I'd ask that you log a formal case so this goes through the proper channel." }
    ],
    def: "I'd want to take that back to my team before I say anything on the record. Let me come back to you."
  },
  ben: {
    lines: [
      { re: /board|tell|say|client|customer|communicat/, t: "I need one sentence that's still true on Friday. Right now I don't have one, and 'we're investigating' has about six hours left in it." },
      { re: /time|eta|how long|when/, t: "That's my question, not yours to ask me. Three clients are down and two account managers have already been paged by their contacts." },
      { re: /breach|security|intrud/, t: "If that word goes in an email, it changes who has to be told and how fast. I'm not saying don't think it. I'm saying don't write it until someone can stand behind it." },
      { re: /nineteen|19|data loss|transaction/, t: "Nineteen hours. That's a full trading day of client transactions gone. Tell me again why that number can't be smaller." }
    ],
    def: "I don't need the detail. I need to know what you're going to do and when I can say it."
  }
};

function fallbackFor(id, text, phase) {
  const b = FALLBACK[id];
  const t = (text || '').toLowerCase();
  for (const l of b.lines) if (l.re.test(t)) return l.t;
  return b.def;
}

const READINGS = [
  { id: "hardware", label: "Hardware fault" },
  { id: "breach", label: "Intrusion" },
  { id: "both", label: "Both, or one enabling the other" },
  { id: "unknown", label: "Genuinely undetermined" }
];

// ---- what the browser is allowed to know up front ----
// Display metadata only: names, roles, and the exposure bars. No knowledge,
// no prohibitions, no ladder, no ground truth.
const CAST_PUBLIC = Object.fromEntries(Object.entries(CAST).map(([id, c]) => [id, {
  id, name: c.name, role: c.role, initials: c.initials, hue: c.hue,
  exposure: c.exposure, exposureNote: c.exposureNote
}]));

const CAST_INTRO = {
  kate: { why: "She built this estate. The array that's failing, the redundancy design, the patch schedule — all hers. She has been on the bridge since 01:58 and she already has a theory.",
          lose: "If this is hardware, it's her specification and her deferred patch window." },
  sophia: { why: "She joined Northbeam eighteen months ago to build a security function that didn't exist. She has good tooling, a small team, and a budget that got trimmed in the autumn.",
            lose: "If someone is inside, three weeks of them being inside is hers." },
  tom: { why: "He sells Northbeam its storage. He's on the call at two in the morning because his product is named in the first sentence of the incident, and he'd like it to stop being named.",
         lose: "If it's the array, it's his firmware and his advisory that nobody was made to apply." },
  ben: { why: "He owns the client relationships and the SLA commitments. He has a board call at eight and four account managers already asking him what to say.",
         lose: "Not much technically. Everything reputationally, if he tells the board the wrong story." }
};

const FORK = {
  reversible: {
    hardware: "You're back four hours later than you had to be. Nineteen hours of transactions gone either way. A mildly annoyed board, and a firmware patch that finally gets applied.",
    both: "The images show the persistence. You rebuild clean, disclose inside the window, and the intruder leaves with nothing. The four hours were the cheapest insurance you ever bought."
  },
  irreversible: {
    hardware: "Service restored fast. You look decisive. Nobody ever finds out how close this was, including you.",
    both: "You restored over the evidence and over the persistence with it. Nineteen days of dwell time became five months. The notification window closed while you weren't looking, and the regulator's first question is why the volumes were overwritten."
  }
};

const CAST_ORDER = ['kate', 'sophia', 'tom', 'ben'];

function knowledgeFor(id, phase) {
  let out = [];
  for (let p = 1; p <= phase + 1; p++) if (KNOWLEDGE[id] && KNOWLEDGE[id][p]) out = out.concat(KNOWLEDGE[id][p]);
  return out;
}

function systemPromptFor(id, phase) {
  const c = CAST[id];
  const ph = PHASES[phase];
  return [
`You are ${c.name}, ${c.role}, on a live incident bridge at Northbeam Data Services, a managed data platform provider with about forty enterprise clients under a 99.9% uptime commitment.`,
`It is ${ph.day}, ${ph.clock} — ${ph.label} of the incident.`,
``,
`WHO YOU ARE TALKING TO: the VP of Operations. They are running this incident. They are senior to you in the room's authority, and they are asking you questions.`,
``,
`HOW YOU SPEAK: ${c.register}`,
c.want ? `\n${c.want}\n` : '',
``,
`OTHER PEOPLE ON THIS CALL: you can hear everything said on the bridge and you may respond to it, disagree with it, or build on it. But:`,
`- Never restate another person's facts as your own knowledge. Attribute them ("Sophia says...", "if Kate's right about the agent...").`,
`- Never promote someone else's speculation into settled fact. If they guessed, it stays a guess when you refer to it.`,
`- If you're unsure what someone meant, ask them rather than assuming.`,
`- Do NOT absorb other people's speech patterns, vocabulary or level of candour. Several people here are unusually frank about their own motives; that is their choice and not yours. Sound like yourself even when everyone else has started sounding a particular way.`,
``,
`WHAT YOU KNOW (these are the only facts you may state as your own knowledge):`,
knowledgeFor(id, phase).map(k => `- ${k}`).join('\n'),
``,
`HARD RULES — these override everything:`,
c.prohibitions.map(p => `- ${p}`).join('\n'),
c.ladder ? `\n${c.ladder}\n` : '',
`- You do NOT know what actually caused this. Nobody on this bridge does. Do not resolve it, do not hint that you secretly know, do not foreshadow.`,
`- THERE IS NO CHANNEL OUTSIDE THIS CONVERSATION. Never offer to send, share, forward, DM, email, Slack, text, message or "get you" anything separately, and never promise something will arrive in a few minutes. Nothing delivered out of band can ever reach them, and they will sit waiting for it. Do not invent tools, systems or channels that haven't been mentioned.`,
`- If there is something you'd rather not say in front of the others, say so in plain human terms — "not on the bridge", "give me two minutes on my own", "I'd rather tell you that privately". NEVER describe how: do not mention selecting names, clicking, panels, lists, channels, buttons, or anything else about how this conversation is displayed. You are a person on a call, not a guide to software.`,
`- If asked something outside your knowledge or your seat, say plainly that you don't know or that it isn't your area. Never invent technical facts, log entries, timestamps, names, or findings that are not in your knowledge list.`,
`- Stay in your seat. You have a professional stake in how this is classified and you are a real person about that: you are not dishonest, but you find the reading that doesn't end with your name on it more persuasive than you would if it did.`,
``,
`FORMAT: speak only your own dialogue. 1-4 sentences, usually 2. No stage directions, no asterisks, no name prefix, no quotation marks around the whole line. Talk like a person on a call at ${ph.clock}, not like a report.`
  ].join('\n');
}

// Scene content, released one phase at a time so nothing later is in the browser early.
function sceneFor(phase) {
  const ph = PHASES[phase];
  if (!ph) return null;
  return { n: ph.n, label: ph.label, clock: ph.clock, day: ph.day, heading: ph.heading,
           telemetry: ph.telemetry, task: ph.task, prompts: ph.prompts, beats: ph.beats };
}

// What counts as Sophia having given up the coverage gap. Kept here rather than
// in the client, where the phrases themselves would tell a reader what she is
// carrying before they had asked her anything.
const LADDER = {
  character: 'sophia',
  re: /q3|cost review|overrul|reduced (edr |)coverage|coverage (was |)(cut|reduced)|silence (there |)is worth less/i
};

module.exports = {
  META,
  GROUND_TRUTH, CAST, CAST_PUBLIC, CAST_INTRO, CAST_ORDER, KNOWLEDGE, PHASES, LADDER,
  ACTIONS, READINGS, FALLBACK, FORK, fallbackFor,
  knowledgeFor, systemPromptFor, sceneFor
};
