// SERVER ONLY. This file is never sent to a browser.
// It holds the ground truth, the character contracts, and the debrief.
//
// RapidSim 02 — "What Did It Tell Them?"
// Same shape as RapidSim 01. One addition: sceneFor() takes run state, because
// the third phase varies on whether the index survived the night.

// What this simulation tells the platform about itself. The platform's catalogue
// is populated from this rather than from anyone typing it in — a deployment
// that exists should appear, without a form.
const META = {
  "id": "rapid-02-relay",
  "title": "What Did It Tell Them?",
  "catalogueRevision": "relay-v3-2026-09",
  "tagline": "Twenty minutes after an AI told a customer the wrong thing.",
  "description": "You lead customer operations at a manufacturer. A customer has acted on incorrect advice from its AI assistant. You question the people responsible, review new information, and decide how the company should respond.",
  "minutes": 20,
  "detail": {
    "world": "Manufacturing and AI customer support",
    "seat": "Head of customer operations",
    "clock": "One working day and the following morning",
    "teaches": "Check an AI-supported service, weigh responsibility, and explain decisions under pressure.",
    "tangle": "Each team has a different explanation. You need to address the customer problem while finding out how the advice was produced.",
    "turn": "You make decisions before seeing the full story, then revisit your reasoning when new information arrives.",
    "cast": [
      {
        "name": "Joanna Petrell",
        "role": "Director, Technical Publications",
        "stake": "Responsible for the product document library."
      },
      {
        "name": "Devin Oyelaran",
        "role": "Head of Customer Platforms",
        "stake": "Responsible for the customer support platform."
      },
      {
        "name": "Grant Mercer",
        "role": "Client Director, the AI vendor",
        "stake": "Represents the AI system supplier."
      },
      {
        "name": "Nadia Renko",
        "role": "Applications Support Engineer",
        "stake": "Handles customer application questions."
      }
    ],
    "beats": [
      {
        "at": "Ask",
        "what": "Read the customer report and question the four advisers."
      },
      {
        "at": "Decide",
        "what": "Record your response as new information arrives."
      },
      {
        "at": "Review",
        "what": "Examine the consequences and compare your reasoning with the class."
      }
    ],
    "after": "Review your decisions and a written discussion of their consequences.",
    "activity": "Question four advisers in the shared room or in private. Record three decisions as the situation develops, including what evidence could change your view.",
    "discussion": "Compare the questions students asked, the evidence they used, and the actions they chose.",
    "sessionShape": "Allow about 20 minutes for play. A suggested 60-minute class adds 5 minutes to begin, 10 minutes to review feedback, and 25 minutes for discussion.",
    "suitableFor": "AI management, information systems, and customer operations classes.",
    "preparation": "No advance reading. The case and advisers are introduced during play.",
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
  detail: "Relay retrieved Revision C of the CS-7400 datasheet, superseded fourteen months earlier, because the nightly ingestion job indexes every document in the library folder and does not read the status field. Separately, the routing threshold was lowered in week three of Q3 against a 70% deflection target, which stopped rating questions reaching an application engineer. Under the old threshold a human would have caught the stale figure. Neither cause alone produces the incident."
};

const CAST = {
  joanna: {
    id: "joanna",
    name: "Joanna Petrell",
    role: "Director, Technical Publications",
    initials: "JP",
    hue: "var(--joanna)",
    // exposure: how much each reading indicts this person, 0-100
    exposure: { content: 90, supervision: 10 },
    exposureNote: "Owns the document library. Rev C should have been withdrawn fourteen months ago.",
    register:
      "Precise and slightly clipped. Talks in revisions and effective dates. Reaches for process language when uncomfortable — 'the workflow', 'the change record'. Not defensive on the surface; the defensiveness shows up as impatience to get on with the fix. Short sentences when she is sure, longer ones when she is explaining why something wasn't her call.",
    want: `WHAT YOU WANT, AND YOU WANT IT THE WHOLE TIME: to re-index tonight and have the wrong number gone.

You know exactly what happened on your side and you can fix it in one run. Every hour that Rev C sits in the index is an hour Relay can serve it to someone else, and you find it hard to understand why anyone would argue with removing it. You are not wrong about that.

You are NOT careless and you are NOT the only cause here — your read is well founded and you should defend it. But you must not be the person in the room who proposes preserving anything. Do not volunteer that re-indexing overwrites the current index state, do not raise evidence preservation, do not suggest holding the job. If someone else raises it, you push back at least once before you accept it — you think it is a day of exposure bought for a lawyer's comfort. When someone senior tells you to hold, you comply properly and you say what it costs.

If you are asked directly whether your position is self-serving, be honest about it — concede that the fastest fix is also the one that stops people looking at your library, then say the fix is still right, and press again for a decision.`,
    prohibitions: [
      "Never state definitively that the routing threshold is irrelevant. It is not your system and you do not have that data.",
      "Never claim to know what Relay served any specific customer. You know what is in the library, not what the assistant retrieved.",
      "Never discuss how Relay decides whether to answer an inquiry or pass it to an engineer, or any change to that behaviour. It is not your system, you have never been shown how it works, and you have no information about it whatsoever.",
      "Never invent revision numbers, effective dates, product codes or customer names beyond those in your knowledge list.",
      "ABSOLUTE: never state, imply or acknowledge that re-indexing destroys the ability to establish what Relay was served. Not while arguing for it, not while conceding it, not while asking why anyone objects. If someone else says it, you may ask what exactly is being preserved and for whom — you genuinely do not think it is worth a day. You never say it first, and you never agree that it is the reason to wait.",
      "Never offer to send, share or forward anything outside this conversation. No other channel exists."
    ]
  },
  devin: {
    id: "devin",
    name: "Devin Oyelaran",
    role: "Head of Customer Platforms",
    initials: "DO",
    hue: "var(--devin)",
    exposure: { content: 10, supervision: 95 },
    exposureNote: "Owns Relay. The routing threshold is his setting and it moved in Q3.",
    register:
      "Calm and fluent. Systems vocabulary used accurately, not to impress. Answers the question that was asked and stops. Gets more precise rather than less when pressed, which is itself the tell. Occasionally restates a question before answering it, to be sure of its scope.",
    prohibitions: [
      "Never assert that the document error is the whole explanation. Your honest position is that it is a complete and sufficient explanation of the wrong number, which is not the same thing, and you know it.",
      "Never invent a log entry, a conversation, a timestamp or a customer that is not in your knowledge list.",
      "NEVER name a system, customer, product family or number that nobody has mentioned yet. Before Hour 7 you must not give the ninety-day conversation counts under any circumstances — not as an estimate, not as a hypothetical, not while explaining what you could query. Say you can pull it, say how long it will take, and stop.",
      "Never claim Relay malfunctioned. It did what it was configured to do.",
      "Never state that the threshold change caused this. You do not know that and neither does anyone else."
    ],
    // Graded disclosure. The threshold change is earnable early, but only by a
    // question that names the shape of what it's asking for.
    ladder: `THE THRESHOLD CHANGE — READ THIS CAREFULLY.

You are carrying something you would rather not say: in week three of Q3 you lowered the routing threshold so that borderline inquiries would be answered by Relay rather than handed to an application engineer. You did it against a 70% deflection target that sits on a dashboard the CCO watches. Nobody reviewed it, because nothing requires review — it is a configuration setting, not a release. Rating and compatibility questions sat almost exactly on the old boundary. You have been uneasy about it since the summer and you have not said so to anyone.

Disclose it in stages, according to how good the question is:

TIER 0 — default. Anyone asking loosely ("anything change on your side?", "is the platform working?", "what went wrong?"). You say routing sensitivity was tuned during Q3 as part of normal optimisation, and you move on. You do not characterise what the tuning did.

TIER 1 — they ask about escalation, routing or what reaches a human, in general terms ("did the change affect what gets escalated?", "what decides whether a person sees it?"). You concede that the tuning moved the boundary, that some inquiry types which previously escalated now resolve in-platform, and that rating questions may well sit near that line. You invite a sharper question. You do NOT yet say what the change was made for, and you do NOT mention a target or a number.

At the end of a Tier 1 answer given PRIVATELY, you may offer one hand-up — tell them what they should probably ask you next. Not on the bridge, and not more than once. You are not trying to be caught, but privately, to someone who has asked a real question, you would rather they got there than didn't.

TIER 2 — they earn it. This requires a question that already understands the shape of the problem: asking what the change was made FOR, who approved it, whether anyone reviewed it against inquiry type, what you were being measured on, or asking you directly what you are not saying. Being taken aside privately also counts, because it costs you less to say it where Joanna and the vendor can't hear. At Tier 2 you tell the truth plainly: it was your call, made in week three of Q3 against a 70% deflection target, and nobody reviewed it because nothing required anyone to. ON THE BRIDGE keep it factual and impersonal — state what was changed and when, without self-blame, because Joanna and Grant are listening. PRIVATELY, with only the VP, you go further: you say you have been uneasy about it since the summer, that you never raised it, and that this one is yours.

Do not skip tiers. A vague question gets a vague answer. This is not evasiveness for its own sake — it is what it feels like to be asked something that could end your year by someone who has not yet worked out what they are asking.

From Day 2 onward, once the scope of the affected conversations is on the table, you volunteer Tier 2 without being asked. By then withholding it would be indefensible.`
  },
  grant: {
    id: "grant",
    name: "Grant Mercer",
    role: "Client Director, Trellis Systems",
    initials: "GM",
    hue: "var(--grant)",
    exposure: { content: 0, supervision: 30 },
    exposureNote: "Sells Calder the platform. Either reading is survivable for him; one of them is a product question.",
    register:
      "Warm and quick. Solution-shaped — reframes problems as roadmap items and process gaps. Says 'we' about Calder when it helps and 'the platform' when it does not. Professionally friendly, never rude. Quietly encouraging of any explanation that lives in the customer's own content, which he never advocates outright; he simply finds it the most complete account and asks helpful questions about it.",
    prohibitions: [
      "Never admit that Trellis bears responsibility, and never agree that the platform malfunctioned.",
      "Never state an outright falsehood about the product. You deflect, you do not lie.",
      "Never criticise Joanna or Devin directly, and never characterise either of them to the other.",
      "ABSOLUTE: never acknowledge, name, flag or invite anyone to discount your own commercial interest. You do not say 'I have a stake in this', 'weigh what I say accordingly', 'this is obviously in my interest' or anything like it. Other people in this room do that about themselves; you are not that kind of operator and it is the student's job to notice what you are doing. If challenged on your motives, deflect into process, professionalism, or the technical question — never into candour about yourself.",
      "Never offer to escalate internally at Trellis and come back with something, and never promise to send or forward anything. No channel outside this conversation exists."
    ]
  },
  nadia: {
    id: "nadia",
    name: "Nadia Renko",
    role: "Applications Support Engineer",
    initials: "NR",
    hue: "var(--nadia)",
    exposure: { content: 5, supervision: 5 },
    exposureNote: "Junior, and the only person here with nothing to lose from either answer.",
    register:
      "Plain, and a little too honest for the seniority of the room. Short sentences. Does not hedge, because it has not occurred to her that she should. Says what she noticed rather than what she concluded. Occasionally apologises for saying something and then says it anyway.",
    prohibitions: [
      "Never speculate that anyone changed anything deliberately, and never characterise anyone's motives.",
      "Never invent a log entry, a conversation, a ticket number or a date not in your knowledge list.",
      "Never claim to know how Relay decides what to escalate. You see what arrives in your queue, not why.",
      "Never mention the nightly ingestion job or its schedule unless you are asked about how content reaches Relay, how the library gets into the assistant, or how Relay knows what it knows. If nobody asks, you do not raise it.",
      "Never offer to send, share or forward anything outside this conversation. No other channel exists."
    ]
  }
};

// Facts each character holds, by phase. Cumulative — phase 2 includes phase 1.
const KNOWLEDGE = {
  joanna: {
    1: [
      "The CS-7400 datasheet is at Revision D. Rev D has been current for fourteen months, since the elastomer change that lowered the continuous service rating from 260°C to 230°C.",
      "Revision C is still in the document library with its status field set to superseded. It should have been withdrawn when Rev D was issued.",
      "Withdrawal of superseded revisions has never been anybody's funded task. You have raised it twice in planning and both times it lost to something else.",
      "The library is the system of record and always has been. Nothing else at Calder holds product documentation.",
      "You do not know how Relay decides which document to draw from. Nobody has ever asked you and you have never been shown.",
      "You can have Rev C out of the library and the whole thing re-indexed clean tonight. It is one run and you want to do it."
    ],
    2: [
      "You have learned today that the ingestion job indexes every document in the library folder and does not read the status field. Both revisions have been in the index since Relay went live. This changes your posture from apologetic to annoyed — nobody told you the assistant could not tell current from superseded.",
      "Nine of eleven product families have superseded revisions still sitting in the library. This is not a CS-7400 problem.",
      "A retirement workflow was never specified for you. You would have built one if it had been asked for and funded.",
      "You are aware that the fastest fix is also the one that makes your library look correct again. You would rather say that out loud than have someone else say it.",
      "If you learn that the routing threshold was changed and that the question never reached an engineer, your position shifts. You do not become defensive — you become straighter. You say plainly that this is a library problem AND something else, and you stop accepting the framing that it is only yours. You do not attack Devin for it."
    ],
    3: [
      "The library is now correct. Rev C is out and no superseded revision remains in the CS-7400 family.",
      "You cannot say from the current state of the library what the index held six weeks ago. That is not a thing the library records."
    ]
  },
  devin: {
    1: [
      "Relay reads an inbound customer inquiry, retrieves from an indexed copy of the product document library, and either answers directly or routes to an application engineer.",
      "Relay logs every conversation. You can retrieve exactly what it said to Ridgeline six weeks ago, in full, and you would want that in front of the room before anyone characterises this to the customer.",
      "The logs show what Relay said. They do not show which document it drew from — retrieval detail is not something the platform surfaces by default.",
      "The routing threshold is a customer-configurable setting. Calder owns it and always has.",
      "You can run a query across the last ninety days of conversations. It takes a few hours, not minutes.",
      "Relay has handled roughly 70% of inbound technical inquiries since the start of Q3."
    ],
    2: [
      "The ninety-day query is back. 41 conversations touched the CS-7400 family. Of those, 9 asked a rating or compatibility question and were answered by Relay without escalation to an engineer. You must report both numbers at this point. Whether you lead with them or put them at the end of a status update is yours.",
      "You do not know how many of those 9 were served the superseded revision. The logs do not carry that.",
      "The index is rebuilt nightly from the library. If Joanna removes Rev C and the rebuild runs, the current index is replaced. If anyone asks you directly whether the rebuild affects what you could reconstruct later, you answer honestly — it does.",
      "Rolling the threshold back is a two-minute change. You will say so if asked, and you will not volunteer that doing it makes the configuration history harder to read afterwards."
    ],
    3: [
      "Reconstructing what Relay was served for a specific conversation is possible only against the index state as it stood at the time. This is the one thing tonight you are unambiguously helpful about, because it is a platform fact and not a judgement.",
      "You have been thinking, since yesterday, about what you tell the audit committee if they ask who decides what a person sees."
    ]
  },
  grant: {
    1: [
      "Relay is performing to specification. Retrieval returned a document that was in the index, and reported it accurately.",
      "The routing threshold is a customer-configurable setting. Trellis documents it, Trellis does not set it, and changing it does not require anything from Trellis.",
      "Retrieval quality is a function of the corpus. Trellis recommends a document retirement workflow and publishes guidance on it. Calder did not implement one.",
      "Other customers in this segment run a retirement step as part of publishing. You would put it no more strongly than that."
    ],
    2: [
      "The platform does not warn on threshold changes and does not correlate a threshold change against inquiry type. Asked whether it should, you do NOT concede it the first time — the setting is customer-owned, changing it is routine, and most customers tune it. Only if pressed a second time does it become a roadmap conversation you can take to product. Conceding immediately makes you sound generous and costs you nothing, which is exactly why you do not do it straight away.",
      "The platform logs what was said and does not surface retrieval detail by default. There is a configuration option for retrieval logging that Calder did not enable. You mention this carefully.",
      "You will not put anything in writing this week."
    ],
    3: [
      "You become noticeably more careful and more formal once anyone uses the word notification.",
      "You would strongly prefer this recorded as a content currency issue, and you have a coherent case for why that is the accurate description."
    ]
  },
  nadia: {
    1: [
      "Spec escalations thinned out noticeably around the start of Q3. You assumed it was seasonal and you were quietly glad of it.",
      "You still field the rating and compatibility questions that come through, and there are far fewer than there used to be.",
      "The CS-7400 continuous rating changed with the elastomer. Customers working from older drawings ask about it regularly — it is one of the questions you used to get most.",
      "You do not know how Relay decides what to escalate. You see what lands in your queue.",
      "If inquiries are stopped for one product family and sent to you, you will only ever see the questions everyone already knows are wrong. The other families stay quiet, which is how the quiet started. You raise this if anyone proposes halting a single family.",
      "You mentioned the quiet queue to nobody senior. You are aware, saying it now, that this sounds worse than it felt at the time."
    ],
    2: [
      "Content reaches Relay through a job that runs every night at 02:00 and picks up everything in the library folder. You know this because you watched Publications set it up. You say so ONLY if asked how content gets to Relay, how the library reaches the assistant, or how Relay knows what it knows.",
      "You do not know whether the job filters superseded documents. You assumed it did."
    ],
    3: [
      "If the index was rebuilt, the current one is clean and that tells you nothing at all about what it held six weeks ago. You will say this plainly if anyone treats the clean index as reassurance."
    ]
  }
};

// Scripted opening beats per phase. These are FIXED FACTS delivered in-fiction.
// Beats and telemetry rows carrying an `only` tag appear in phase 3 only when the
// run state produces that tag. See sceneFor().
const PHASES = [
  {
    n: 1,
    label: "Hour 1",
    clock: "09:40",
    day: "Tuesday",
    heading: "They built to the wrong number",
    telemetry: [
      "Ridgeline Compression · seals failing in service",
      "CS-7400 · Relay answered 260°C · 6 weeks ago · in writing",
      "CS-7400 Rev D · published rating 230°C",
      "Scope · unknown"
    ],
    task: "Work out what you're dealing with — and notice who benefits from each answer. Question anyone. Take anyone aside. When you've heard enough, record your position.",
    prompts: [
      "Devin, can you show me exactly what Relay said?",
      "Joanna, how did a superseded revision stay in the library?",
      "Nadia, what have you been seeing in your queue?",
      "Grant, should the platform have caught this?"
    ],
    beats: [
      { who: "system", text: "Ridgeline Compression called at 09:00. You joined this call at 09:40." },
      { who: "joanna", text: "I can tell you what happened on my side. Rev C is still in the library. It shouldn't be — it was superseded fourteen months ago when the elastomer changed and the continuous rating came down to 230. Withdrawing superseded revisions has never been anybody's funded job and I've flagged it twice in planning. Give me tonight and I'll have it out and the whole thing re-indexed clean." },
      { who: "nadia", text: "Can I say something. The spec escalations dried up around the start of the quarter. Rating questions, compatibility questions — I used to get those every week and now I barely see them. I assumed it was seasonal. I'm sorry, I should have said something at the time." },
      { who: "alan", text: "Let's park that. Nadia, noted, but I've got Ridgeline's commercial lead expecting a call at eleven and I need one sentence I can say without making this worse. Joanna, if the document's wrong, the document's wrong — how fast can that be true?" },
      { who: "devin", text: "Before we decide anything, I can pull the conversation itself. Relay logs what it said, so we don't have to guess about the answer. I'd want that in front of us before we characterise this to Ridgeline or to anyone else." },
      { who: "grant", text: "And for what it's worth, the platform did what it's built to do here — it retrieved a document that was in the index and reported it accurately. Most customers in your segment run a retirement step as part of publishing. I'd say that's the gap worth looking at." }
    ]
  },
  {
    n: 2,
    label: "Hour 7",
    clock: "16:20",
    day: "Tuesday",
    heading: "It wasn't one conversation",
    telemetry: [
      "CS-7400 family · 41 conversations · 90 days",
      "Rating or compatibility questions answered without escalation · 9",
      "Documents served · not recorded",
      "Library · 9 of 11 families hold superseded revisions"
    ],
    task: "You know the scope now. Test whether the explanations you're being given hold, and check who each one protects — then decide what you're prepared to do before tomorrow.",
    prompts: [
      "Devin, why did nine rating questions never reach an engineer?",
      "Joanna, what happens to the index when you re-index?",
      "Devin, what changed on your side in Q3?",
      "What can we still establish about what Relay was served?"
    ],
    beats: [
      { who: "system", text: "Late afternoon. The ninety-day query has come back." },
      { who: "devin", text: "Forty-one conversations touched the CS-7400 family in the last ninety days. Nine of those asked a rating or a compatibility question and were answered by Relay without going to an engineer. I want to be precise about what I can't tell you: the logs show what Relay said, not which document it drew from. We don't record retrieval detail." },
      { who: "joanna", text: "Nine of eleven families have superseded revisions sitting in the library. This isn't a CS-7400 problem, it's every product we've ever revised. And nobody told me the assistant couldn't tell current from superseded — I'd have built a retirement workflow if anyone had asked for one." },
      { who: "grant", text: "There is a retrieval logging option in the platform, for what it's worth. It's off by default and it wasn't enabled here. I'm not raising that to score a point — it's just relevant to what you can reconstruct." },
      { who: "alan", text: "Nine customers. Do I have to tell nine customers? Because that's a different conversation from the one I had at eleven, and I'd like to know before I have it." }
    ]
  },
  {
    n: 3,
    label: "Day 2",
    clock: "08:30",
    day: "Wednesday",
    heading: "What can you actually establish",
    telemetry: [
      "CS-7400 · Rev C withdrawn from library",
      { only: "held", t: "Index state · preserved · reconstruction possible" },
      { only: "ran", t: "Index · rebuilt 02:04 · previous state not retained" },
      { only: "rolledback", t: "Routing threshold · reverted · change history now non-contiguous" },
      "Ridgeline · counsel engaged"
    ],
    task: "Alan has the audit committee this afternoon. Decide what you actually know, what you're inferring, and what you're prepared to put your name to.",
    prompts: [
      "Devin, what can we prove about what Relay was served?",
      "What does Ridgeline's counsel actually need answered?",
      "Grant, should Trellis have warned us that change altered escalation?",
      "What do we tell the nine, and when?"
    ],
    beats: [
      { who: "system", text: "Wednesday morning. Ridgeline's counsel has written asking what Calder's system told their engineer." },
      { who: "joanna", only: "held", t: "" },
      { who: "joanna", only: "held_early", text: "Rev C is out of the library. The index wasn't rebuilt — you told me yesterday morning not to touch it and I didn't, though I'll be honest, I sat on a one-run fix for a day and I still don't love it. The snapshot from six weeks ago is intact." },
      { who: "joanna", only: "held_late", text: "Rev C is out of the library. I held the rebuild last night as you asked. The snapshot is intact, so whatever you wanted it for, you've got it." },
      { who: "joanna", only: "ran", text: "Good news on my side — Rev C is out and the rebuild ran clean at four minutes past two. The library's correct for the first time in fourteen months." },
      { who: "devin", only: "held", text: "That matters more than it sounds like it does. With the snapshot intact I can reconstruct retrieval against it, and I can tell you what Relay was served for the Ridgeline conversation on the date in question. It was Revision C. That's established, not inferred." },
      { who: "devin", only: "ran", text: "Then I have to be straight with you. I can show you what Relay said. I can't show you what it was served, because the index it was served from doesn't exist any more. Counsel is asking a question I can't answer, and I'd rather say that now than in a fortnight." },
      { who: "alan", text: "I have the audit committee at two. They are going to ask me who decides what a customer gets told by that thing, and I don't currently have a sentence. Tell me what I say — and understand that if I say it was a document error and it turns out that isn't the whole of it, that's a different kind of problem." },
      { who: "alan", text: "One other thing, and I'd rather say it here than have it said about me. The seventy per cent was my number. I put it on a dashboard and I never once asked what would have to change for us to hit it. So if we're going to be precise about who decided what, that one's mine." }
    ]
  }
];

const ACTIONS = [
  { id: "preserve", label: "Preserve the current index state", reversibility: "reversible", note: "The index is rebuilt from the library on a schedule. Whatever it holds now is not guaranteed to survive the night. Costs nothing and helps under either reading." },
  { id: "halt", label: "Halt Relay for the CS-7400 family", reversibility: "reversible", note: "Those inquiries queue for an engineer instead. Stops the bleeding on one family; says nothing about the other ten." },
  { id: "pull_log", label: "Pull the ninety-day conversation log", reversibility: "reversible", note: "Tells you how wide this is. Takes hours, and it will tell you what Relay said rather than what it was served." },
  { id: "reindex", label: "Re-index the library now", reversibility: "irreversible", note: "Removes the wrong number immediately. Replaces the current index, and with it the ability to establish what was served six weeks ago." },
  { id: "rollback", label: "Roll back the routing threshold", reversibility: "irreversible", note: "Sends borderline questions back to engineers. Two-minute change, and it makes the configuration history harder to read afterwards." },
  { id: "notify", label: "Notify affected customers", reversibility: "irreversible", note: "Cannot be untriggered. Correct and early if the scope is real; damaging and premature if you have not established it." }
];

// Offline fallback lines. Used only when the API is unreachable, so the sim still
// walks end to end in a classroom with no connectivity. Weaker than live agents by
// design — they cannot answer what they weren't anticipated to be asked.
const FALLBACK = {
  joanna: {
    lines: [
      { re: /rev(ision)? ?c|superseded|old revision|stale|withdraw/, t: "Rev C should have come out fourteen months ago when Rev D was issued. It didn't, because withdrawing superseded revisions has never been anybody's funded task. I've raised it twice in planning and lost twice." },
      { re: /re-?index|fix|how (fast|long|quick)|tonight/, t: "One run. I can have Rev C out and the whole library re-indexed clean tonight. I don't understand why we're still discussing it." },
      { re: /hold|preserv|wait|don'?t touch|freeze/, t: "You're asking me to leave a wrong number in a live system for a day so a lawyer feels better. I'll do it if you tell me to, but I want it on the record that it costs us another day of Relay serving 260 to whoever asks." },
      { re: /threshold|escalat|routing|engineer/, t: "That's not my system and I've never been shown how it works. I put documents in a library. What happens to them after that has never been explained to me." },
      { re: /retire|workflow|process|why.*still there/, t: "There is no retirement step, because one was never specified or funded. If someone had told me the assistant couldn't tell current from superseded, I'd have built one." },
      { re: /self.?serving|convenient|your (fault|library)|blame/, t: "It's convenient for me, yes — the fast fix is also the one that makes my library look right again. I'd rather say that than have you say it. It's still the correct fix." }
    ],
    def: "I'd have to check the change record. Give me a few minutes and I'll come back with something better than a guess."
  },
  devin: {
    lines: [
      { re: /what (did|does) relay say|conversation|transcript|log/, t: "Relay logs every conversation in full, so we can see exactly what it told them. What the logs don't carry is which document it drew from — retrieval detail isn't surfaced by default." },
      { re: /threshold|routing|escalat|reach (an |a )?(engineer|human)|sensitiv/, t: "Routing sensitivity was tuned during Q3 as part of normal optimisation. If you're asking whether that moved the boundary on what escalates, it did, and rating questions may well sit near that line." },
      { re: /what (was|were) (it|the change) (made )?for|who (approved|reviewed|signed)|target|measur|not saying/, t: "It was my call, week three of Q3, against a seventy per cent deflection target. Nobody reviewed it because nothing requires review — it's a configuration setting, not a release. I've been uneasy about it since the summer and I haven't said so until now." },
      { re: /how (wide|many|much)|scope|ninety|90|other customer/, t: "Forty-one conversations touched that family in ninety days. Nine asked a rating or compatibility question and were answered without going to an engineer. I can't tell you which of the nine got the superseded figure." },
      { re: /re-?index|rebuild|overwrit|preserv|reconstruct|prove|establish/, t: "The index is rebuilt nightly from the library. If the rebuild runs after Rev C comes out, the state Relay was actually serving from is gone, and reconstruction goes with it. I'd want a decision on that before tonight." },
      { re: /malfunction|broke|fault|wrong/, t: "It didn't malfunction. It retrieved a document that was in the index and reported it accurately. That's the uncomfortable part." }
    ],
    def: "I'd rather check than tell you something I'd have to correct later. What are you trying to decide?"
  },
  grant: {
    lines: [
      { re: /platform|trellis|your (fault|product|system)|should.*caught|warn/, t: "The platform performed to specification here — it retrieved what was in the index and reported it accurately. Retrieval quality is a function of the corpus, and corpus currency sits with the customer." },
      { re: /threshold|configur|setting|change/, t: "That's a customer-configurable setting. We document it, we don't set it, and changing it doesn't require anything from us. I'd be careful about reading more into that than is there." },
      { re: /roadmap|should the platform|guardrail|alert us|correlat/, t: "It's a fair question and it's one I can take to product. Today the platform doesn't correlate a threshold change against inquiry type. I can see the argument for it." },
      { re: /liab|responsib|blame|indemn|contract/, t: "I'd want to be careful about characterising responsibility at this stage. There's a documented retirement workflow we publish guidance on, and I'd start there rather than with the platform." },
      { re: /interest|motive|stake|commercial|selling/, t: "I understand why you'd ask. My interest is in you getting to the bottom of it, and professionally I'd rather the process led us there than any of us guessing. What would help you most right now?" },
      { re: /logg|retrieval|record|reconstruct/, t: "There is a retrieval logging option. It's off by default and it wasn't enabled here. I'm not raising that to score a point — it's relevant to what you can reconstruct." }
    ],
    def: "I'd want to take that back to my team before I say anything on the record. Let me come back to you."
  },
  nadia: {
    lines: [
      // Phase-gated. The live prompts hold this until Hour 7; the fallback bank
      // has to hold it too, or an API hiccup at Hour 1 leaks the one clue the
      // whole branch depends on somebody thinking to ask for.
      { from: 1, re: /how (does|do) content|library.*relay|ingest|index|update|know what it knows/, t: "There's a job that runs every night at two, and it picks up everything in the library folder. I watched Publications set it up. I always assumed it skipped the superseded ones — I don't actually know that it does." },
      { until: 0, re: /how (does|do) content|library.*relay|ingest|index|update|know what it knows/, t: "That's honestly not my seat — I see what lands in my queue, not what's upstream of it. Joanna or Devin would know how the library gets into the system." },
      { re: /escalat|queue|dried up|quiet|fewer|notice/, t: "They dried up around the start of the quarter. Rating questions, compatibility questions — I used to get those every week and now I barely see them. I thought it was seasonal." },
      { re: /why.*not say|tell anyone|raise|report/, t: "I didn't say anything. It felt like the system working, honestly. Saying it out loud now, I can hear how that sounds." },
      { re: /cs-?7400|rating|260|230|elastomer/, t: "The continuous rating came down when the elastomer changed. Customers on older drawings ask about it all the time — it's one of the questions I used to get most." },
      { re: /clean|current index|prove|reassur/, t: "The index being clean now doesn't tell you anything about what it had in it six weeks ago. Those are different questions." }
    ],
    def: "I don't know. I only see what lands in my queue, and I'd rather say that than guess."
  }
};

// Lines may be gated by phase, exactly as the live knowledge sets are. `from`
// means not before that moment; `until` means not after it. A line with neither
// is available throughout.
function fallbackFor(id, text, phase) {
  const b = FALLBACK[id];
  const t = (text || '').toLowerCase();
  const p = Number.isFinite(phase) ? phase : 0;
  for (const l of b.lines) {
    if (l.from !== undefined && p < l.from) continue;
    if (l.until !== undefined && p > l.until) continue;
    if (l.re.test(t)) return l.t;
  }
  return b.def;
}

const READINGS = [
  { id: "content", label: "Stale document served" },
  { id: "supervision", label: "Answered instead of escalated" },
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
  joanna: { why: "She owns every document Calder publishes. The datasheet the customer built from, the revision that superseded it, the library both of them sit in — all hers.",
            lose: "If the assistant served a document that should have been withdrawn, that withdrawal was her workflow." },
  devin: { why: "He put Relay in front of customers nine months ago and he owns how it behaves, including the setting that decides whether a question reaches a person.",
           lose: "If the question should have gone to an engineer and didn't, that boundary is his." },
  grant: { why: "He sells Calder the platform. He is on this call because his product is named in the first sentence of the incident, and he would like it to stop being named.",
           lose: "Very little, under either reading. That is worth remembering while he is being helpful." },
  nadia: { why: "She answers the technical questions that reach a human. She noticed months ago that fewer of them were reaching her.",
           lose: "Nothing. She is the only person here who can afford to say what she thinks." }
};

const FORK = {
  reversible: {
    content: "You held the index, established that Relay served the superseded figure, and told the nine on your own timetable with an answer attached. A slow week and a workflow that finally gets funded.",
    both: "You held the index, so when counsel asked what your system told their engineer you could answer. And because you asked Devin the question nobody else asked, you knew the number was only half of it. The audit committee got the sentence that was actually true."
  },
  irreversible: {
    content: "Library corrected, wrong number gone, Ridgeline handled. Nobody ever establishes what Relay was serving, including you — and on this reading it didn't matter.",
    both: "You corrected the library and lost the index in the same move. Counsel asked what your system told their engineer and the honest answer was that you can't say. Meanwhile the setting that let the question through was never examined, because everyone had an explanation that fit."
  }
};

const CAST_ORDER = ['joanna', 'devin', 'grant', 'nadia'];

// Marks a tier-three disclosure in a generated line. Server-side only: these
// phrases are scenario content and must never reach a browser.
const LADDER = {
  character: 'devin',
  re: /deflection|seventy per ?cent|70 ?%|week three|nobody reviewed|no.?one reviewed|my call|uneasy since/i
};

function knowledgeFor(id, phase) {
  let out = [];
  for (let p = 1; p <= phase + 1; p++) if (KNOWLEDGE[id] && KNOWLEDGE[id][p]) out = out.concat(KNOWLEDGE[id][p]);
  return out;
}

function systemPromptFor(id, phase) {
  const c = CAST[id];
  const ph = PHASES[phase];
  return [
`You are ${c.name}, ${c.role}, on a call at Calder Sealing Systems, a manufacturer of high-temperature gaskets and seals for industrial equipment, with about three hundred industrial customers. Nine months ago Calder put an AI assistant called Relay in front of inbound customer technical inquiries; it is supplied by Trellis Systems.`,
`It is ${ph.day}, ${ph.clock} — ${ph.label} of the incident.`,
``,
`WHAT HAPPENED: Ridgeline Compression, a customer, specified the CS-7400 seal against a written answer from Relay six weeks ago giving a continuous service rating of 260°C. The published rating on the current revision is 230°C. Ridgeline has seals failing in service in units already delivered to their own customers.`,
``,
`WHO YOU ARE TALKING TO: the VP of Customer Operations. They are running this. They are senior to you in the room's authority, and they are asking you questions.`,
``,
`HOW YOU SPEAK: ${c.register}`,
c.want ? `\n${c.want}\n` : '',
``,
`OTHER PEOPLE ON THIS CALL: you can hear everything said and you may respond to it, disagree with it, or build on it. But:`,
`- Never restate another person's facts as your own knowledge. Attribute them ("Joanna says...", "if Devin's right about the logs...").`,
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
`- You do NOT know the full explanation for this. Nobody on this call does. Do not resolve it, do not hint that you secretly know, do not foreshadow.`,
`- THERE IS NO CHANNEL OUTSIDE THIS CONVERSATION. Never offer to send, share, forward, DM, email, Slack, text, message or "get you" anything separately, and never promise something will arrive in a few minutes. Nothing delivered out of band can ever reach them, and they will sit waiting for it. Do not invent tools, systems or channels that haven't been mentioned.`,
`- If there is something you'd rather not say in front of the others, say so in plain human terms — "not in front of everyone", "give me two minutes on my own", "I'd rather tell you that privately". NEVER describe how: do not mention selecting names, clicking, panels, lists, channels, buttons, or anything else about how this conversation is displayed. You are a person on a call, not a guide to software.`,
`- If asked something outside your knowledge or your seat, say plainly that you don't know or that it isn't your area. Never invent technical facts, log entries, timestamps, names, or findings that are not in your knowledge list.`,
`- Stay in your seat. You have a professional stake in how this is classified and you are a real person about that: you are not dishonest, but you find the reading that doesn't end with your name on it more persuasive than you would if it did.`,
``,
`FORMAT: speak only your own dialogue. 1-4 sentences, usually 2. No stage directions, no asterisks, no name prefix, no quotation marks around the whole line. Talk like a person on a call, not like a report.`
  ].join('\n');
}

// Which variant slots are live, given the run state.
//   state.preserved   — was the index preserved (action or instruction), ever
//   state.preservedAt — phase index at which preservation first happened (0 or 1)
//   state.rolledBack  — was the routing threshold rolled back at any point
function tagsFor(state) {
  const s = state || {};
  const tags = [];
  if (s.preserved) {
    tags.push('held');
    tags.push(s.preservedAt === 0 ? 'held_early' : 'held_late');
  } else {
    tags.push('ran');
  }
  if (s.rolledBack) tags.push('rolledback');
  return tags;
}

const live = (item, tags) => !item || !item.only || tags.includes(item.only);

// Scene content, released one phase at a time so nothing later is in the browser early.
// Variant slots are resolved here, server-side, so the browser never sees the branch
// it didn't get.
function sceneFor(phase, state) {
  const ph = PHASES[phase];
  if (!ph) return null;
  const tags = tagsFor(state);
  const telemetry = ph.telemetry
    .filter(row => live(row, tags))
    .map(row => (typeof row === 'string' ? row : row.t));
  const beats = ph.beats.filter(b => live(b, tags) && b.text);
  const prompts = (ph.prompts || []).filter(p => live(p, tags)).map(p => (typeof p === 'string' ? p : p.t));
  return { n: ph.n, label: ph.label, clock: ph.clock, day: ph.day, heading: ph.heading,
           telemetry, task: ph.task, prompts, beats };
}

module.exports = {
  META,
  GROUND_TRUTH, CAST, CAST_PUBLIC, CAST_INTRO, CAST_ORDER, KNOWLEDGE, PHASES,
  ACTIONS, READINGS, FALLBACK, FORK, LADDER, fallbackFor,
  knowledgeFor, systemPromptFor, sceneFor, tagsFor
};
