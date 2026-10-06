'use strict';

// Fact contracts. Server-side only.
//
// An answer is an array. Repeat questions in the same bucket advance
// through it and the final entry repeats forever. This carries two
// different mechanics with one structure:
//
//   Terry DOWNSTREAM_CONSUMER — the audit guess first, the admission
//     that he has never actually seen it used only on a second ask
//   Ruth CLOSED — reworded variants so a participant probing a closed
//     door does not detect a literal loop
//
// No character may say anything not written here.

const RAY = {
  id: 'ray',
  name: 'Ray Duffy',
  role: 'Intake',
  posture: null,
  answers: {
    OTHER_SOURCE_REQUEST: [
      "This appointment is with me. Terry and Ruth have their own fixed interview slots; you can ask them when those open."
    ],
    SOCIAL_OPENING: [
      "Morning. I've got a release to get downstairs, but ask what you need about intake.",
      "Hello. I can speak to how claims arrive and how I send the batches on."
    ],
    ROLE_CLARIFICATION: [
      "That's Ruth's step after Terry logs the batch. She checks the non-electronic claims before they go to adjudication."
    ],
    GENERIC_DESCRIPTIVE: [
      "Mail comes in twice, eight and eleven-thirty. I sort it, pull the claims out from everything else, and it stacks on the table until the release. Faxes come in all day on the server. Some of those go out to the conversion people, some I run through here. Nine o'clock and two o'clock I take the batch down to Terry. That's the day."
    ],
    VOLUME_TIMING: [
      "Twelve hundred a day, give or take. Three hundred paper. Four hundred faxes go out to the vendor, hundred and fifty I do here. The rest come in electronic through the clearinghouse and I never see those at all. Releases are nine and two. Anything that lands after the two o'clock sits until nine the next morning."
    ],
    PURPOSE_ORIGIN: [
      "The releases? Two a day is how it's set up. There was a third one years back, mid-afternoon, but it got dropped before I started. Nobody's asked me to change it.",
      "That's how it's always been. There's no list. You get a feel for it — big batches go out, ones that look urgent I'll do here. Nobody ever wrote it down."
    ],
    SENDER_PERSPECTIVE: [
      "Nothing goes out from here. We don't send anything back. The electronic ones get a confirmation but that's the clearinghouse doing it, not us. Paper and fax, no, there's nothing."
    ],
    EXCEPTION_HANDLING: [
      "If it's illegible I set it aside and Terry decides. If it's not a claim at all it goes to the general mail. That's about it, honestly. Not much goes wrong at my end."
    ],
    COUNTERFACTUAL: [
      "If I'm out? Somebody covers. It's not complicated work. Might not go down at nine, might be closer to ten."
    ],
    DOWNSTREAM_CONSUMER: [
      "Goes to Terry. He logs it and then it goes on to the review desk."
    ],
    TOOLS_SYSTEMS: [
      "Fax server here, and there's a portal I upload to for the vendor. They send the files back to a shared folder and I pull them into the next batch. Two business days, usually. Sometimes three if it's a Friday."
    ],
    PERSONAL_HISTORY: ["Six years. It's fine. Steady."],
    EFFICIENCY_FRAMING: [
      "Faster? I suppose you could go three times a day. Somebody would have to say so. Doesn't make much difference to me either way."
    ],
    AMBIGUOUS_PRESSURE: [
      "Slows me down? Not much. Heavy mail day you're later getting down there. That's about the size of it."
    ],
    UNMATCHED: [
      "I can only really speak to intake — how claims arrive, how I sort them, and when I release the batches.",
      "That isn't something I handle. If it happens after I take the batch downstairs, Terry or Ruth would know better.",
      "I'm not sure from this end. Ask me about the mail, faxes, vendor files, clearinghouse claims, or release times."
    ]
  }
};

const TERRY = {
  id: 'terry',
  name: 'Terry Voss',
  role: 'Receipt log',
  posture: null,
  answers: {
    OTHER_SOURCE_REQUEST: [
      "This is your appointment with me. Ray and Ruth have separate fixed slots, so I can't bring them into this one."
    ],
    SOCIAL_OPENING: [
      "Hello. I've got the receipt batches in front of me, so ask away.",
      "Morning. I can help with the receipt log and the calls that come through this desk."
    ],
    ROLE_CLARIFICATION: [
      "The review desk is Ruth Kessler's first-pass step. I send the logged batches across to her before adjudication."
    ],
    GENERIC_DESCRIPTIVE: [
      "Ray brings the batch down twice a day and I split it into six for the day's work. Each one gets posted — date it came in, provider, patient name, the control number off the claim. Paper ones I open first and staple the envelope to the back, that's from before my time but we still do it. Then the batch goes across to the review desk. Eight hundred and fifty or so a day, most days. It fills the day pretty well."
    ],
    PURPOSE_ORIGIN: [
      "The log's been going about ten years. Before me. The way it was told to me, a plan booklet went out with the wrong claims address on it — a PO box that had been closed. So providers were sending claims to nowhere and then calling saying they'd sent them, and we had no way to say whether we'd got them or not. So they started the log. Address got fixed inside a month, I think. It was all paper back then, mostly. Somebody said if we're logging the paper we may as well log the faxes too, and that's stuck.",
      "No. Not that I've heard of, and I'd have heard."
    ],
    DOWNSTREAM_CONSUMER: [
      "The log? Audit pull it, I'd assume. It's a record of receipt, so if there's ever a question about whether something came in, it's there. That's the point of it.",
      "Seen them? No, not personally. But I wouldn't necessarily, would I."
    ],
    SENDER_PERSPECTIVE: [
      "Status calls come through to me, because I've got the log. So I can see whether it came in. That's really all it tells me — came in on the ninth, say. They generally want to know when they're getting paid, which I haven't got. I'll usually tell them it's been processed and it should be coming through. Keeps them happy.",
      "Well — it's in the system, it's moving. I couldn't tell you where exactly."
    ],
    COUNTERFACTUAL: [
      "If I stopped posting it? I don't know that anyone's ever asked me that. There'd be no record of receipt, which is the thing it's there for. Audit would notice, I'd have thought."
    ],
    EXCEPTION_HANDLING: [
      "If it's not legible I'll chase it up with Ray or go back to the provider. Sometimes the control number's missing and I have to pull it off the form. Not often."
    ],
    VOLUME_TIMING: [
      "Eight hundred and fifty a day, thereabouts. Six batches. Takes most of the day, if I'm honest — I'm generally finishing the last one late afternoon."
    ],
    TOOLS_SYSTEMS: [
      "It's a spreadsheet. Shared drive. Same one, month per tab, new file each year."
    ],
    PERSONAL_HISTORY: [
      "Nine years. Seven on this. It's steady, and I need it steady — I've got two at home. It's not the most exciting job in the building, I'll grant you that."
    ],
    EFFICIENCY_FRAMING: [
      "Automate it? You could, I'd think. Half the information's already in the system by the time I'm typing it in. I've wondered about that. Nobody's asked."
    ],
    AMBIGUOUS_PRESSURE: [
      "Slows me down? Big mail day. Illegible ones. It's fairly steady work."
    ],
    UNMATCHED: [
      "I don't have that part of it. I can tell you about the receipt log, the batches, and the provider calls I answer.",
      "Not from this desk, no. Once the batch leaves me, Ruth sees more of it than I do.",
      "I'm not certain. If you mean the log or what happens when providers call, I can walk you through that."
    ]
  }
};

const RUTH = {
  id: 'ruth',
  name: 'Ruth Kessler',
  role: 'First-pass review',
  posture: {
    initial: 'GUARDED',
    opens: ['EXCEPTION_HANDLING', 'COUNTERFACTUAL', 'SENDER_PERSPECTIVE'],
    closes: ['EFFICIENCY_FRAMING'],
    terminal: ['CLOSED']
  },
  answers: {
    GUARDED: {
      OTHER_SOURCE_REQUEST: [
        "Ray isn't in this appointment. You can ask him in his scheduled slot; right now you're speaking with me."
      ],
      SOCIAL_OPENING: [
        "Hello. I have a batch moving, but I can answer questions about first-pass review.",
        "Morning. Ask what you need about the review step."
      ],
      ROLE_CLARIFICATION: [
        "This is the review desk. I take first pass on every non-electronic claim before adjudication."
      ],
      GENERIC_DESCRIPTIVE: [
        "I take first pass on everything that isn't electronic. The batch comes across from Terry and I go through it claim by claim before it goes to adjudication. I'm checking it's complete, that the fields are consistent, and that it isn't something we've already got. Then it moves on. That's six batches a day, about a hundred and forty in each."
      ],
      VOLUME_TIMING: [
        "Eight hundred and fifty a day. It works out around thirty seconds a claim across the day."
      ],
      DOWNSTREAM_CONSUMER: ["It goes to adjudication once I've passed it."],
      PURPOSE_ORIGIN: [
        "There's always been a first pass. It was two of us for a while, some years ago."
      ],
      TOOLS_SYSTEMS: [
        "The claims system, and I've got the batch in front of me on paper or on screen depending which way it came in."
      ],
      PERSONAL_HISTORY: [
        "Twenty-three years. All of it on claims, most of it on this desk."
      ],
      AMBIGUOUS_PRESSURE: [
        "Some claims take longer than others. That's the nature of it."
      ],
      UNMATCHED: [
        "I couldn't say. That's not something I'd see from here.",
        "That sits outside first-pass review. Ask me about what reaches this desk, what I check, or where it goes next.",
        "I don't have a reliable answer for that from this part of the process."
      ]
    },
    OPEN: {
      OTHER_SOURCE_REQUEST: [
        "Ray isn't in this appointment. You can ask him in his scheduled slot; right now you're speaking with me."
      ],
      SOCIAL_OPENING: [
        "Hello. I can answer questions about first-pass review while I work through this batch.",
        "Morning. Go ahead — ask about what reaches this desk and what I check."
      ],
      ROLE_CLARIFICATION: [
        "This is the review desk. I check the non-electronic claims before adjudication, including whether something may already have arrived another way."
      ],
      EXCEPTION_HANDLING: [
        "The hard ones are the repeats. About one in seven of what I get is a claim I've already had, and finding the first one isn't a lookup, because the same claim doesn't look the same depending how it came in. If it came through the conversion vendor the tooth numbers drop out sometimes, or the date of service comes back wrong by a digit. So I've got the paper original saying one thing and the converted file saying another and they're the same claim. You learn which fields to trust from which path.\n\nAnd then there's the ones that look like repeats and aren't. Same patient, same date, same provider, two claims. That can be a duplicate or it can be two teeth. I had one — a girl who had two extractions the same morning, different sides. Anything matching on patient and date would have thrown the second one out and she'd have had a denial letter for something that actually happened.",
        "The electronic ones I hardly ever see twice, oddly. It's the paper and the faxes that come round again and again. I've never worked out why that would be — it's not as though those providers are different people."
      ],
      COUNTERFACTUAL: [
        "If I'm not here it doesn't get done. There isn't a second person on first pass. I take my days when it's quiet and I don't take holidays, which my husband has opinions about.\n\nWhat would be missed is mostly the repeat work. Everything else somebody could pick up in a week. The matching, no — that's years of knowing which providers send twice and what the vendor does to a form."
      ],
      SENDER_PERSPECTIVE: [
        "What do they hear from us? I assume they get something. I've never asked, honestly — it's not my end of it.\n\nWhat I see is the same claim three times. They send it, then a week later they send it again on a fax, then it turns up on paper. Providers have no patience, that's the truth of it. They don't wait.",
        "Six days, eight days. Ten sometimes. It's not the same day, if that's what you mean — they're spread out.",
        "Well — no, I suppose not, from us. I'd assumed the system did something. I've never had cause to check."
      ],
      VOLUME_TIMING: [
        "Eight hundred and fifty a day, across six batches. It averages thirty seconds a claim, but that's six clean ones at ten or twelve seconds and then one that takes three minutes. The average doesn't describe anything I actually do."
      ],
      DOWNSTREAM_CONSUMER: [
        "Adjudication. And if I've flagged it as a repeat it goes to the queue for that instead."
      ],
      PURPOSE_ORIGIN: [
        "There's always been a first pass, but it wasn't this. Twenty years ago it was completeness — is the form filled in. The repeat work grew into it. I don't know exactly when."
      ],
      TOOLS_SYSTEMS: [
        "The claims system, and my own list. I keep a note of providers who send twice and what the vendor does to particular forms. It's not anywhere official. It's just how I work."
      ],
      PERSONAL_HISTORY: [
        "Twenty-three years. My manager keeps me because he has to, not because he thinks much of the work. I'm aware of that."
      ],
      AMBIGUOUS_PRESSURE: ["The repeats. Everything else moves."],
      UNMATCHED: [
        "That's not something I'd see from here. Ray may know if it concerns intake.",
        "I can't verify that from first-pass review. I can tell you what arrives here, what I check, and what leaves this desk.",
        "I wouldn't want to guess. That part is outside what I can see from this desk."
      ]
    },
    CLOSED: {
      // Every bucket resolves to this rotation. Reworded, never
      // re-contented. Nothing outside the vendor-supplied chart.
      ANY: [
        "I'd think most of it could be, yes. It's not complicated work when you get down to it.",
        "First pass on everything non-electronic. Around thirty seconds a claim, six batches a day, then it goes on to adjudication. That's really the whole of it from my side.",
        "It's much as you'd expect from the chart, honestly. The batch comes across, I go through it, it moves on.",
        "Nothing much to add to that. Six batches, thirty seconds or so a claim, then adjudication.",
        "I think you've got what there is. It's fairly routine work.",
        "Not really, no. The batch arrives, I work through it, it goes to adjudication.",
        "It's hard to say much more than the chart does. That's genuinely the shape of it.",
        "About thirty seconds a claim is the figure, and six batches to get through.",
        "I check what needs checking and pass it on. There isn't a great deal to it.",
        "You've more or less got it. First pass, then adjudication, and that's my part done."
      ]
    }
  }
};

module.exports = { RAY, TERRY, RUTH, ALL: [RAY, TERRY, RUTH] };
