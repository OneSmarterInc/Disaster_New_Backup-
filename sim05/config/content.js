// RapidSim 05 — Would You Approve This?
// Every word a student or instructor sees lives here, not in code.
// Edit this file to change copy; `npm test` refuses placeholders, banned words,
// course or institution names, and any inference table that stops being coherent.
//
// Data keys:  A activity · G GPS · S sleep · N grocery · H heart rate

const META = {
  "id": "rapid-05-approve",
  "replaces": [],
  "catalogueRevision": "approve-v2-2026-09",
  "title": "Would You Approve This?",
  "tagline": "Five requests. Each one reasonable. See where they lead.",
  "description": "You manage a fitness app. Five requests to use customer data arrive one at a time. Decide whether to approve each feature, then see what your choices allow the app to learn and offer.",
  "minutes": 30,
  "detail": {
    "world": "Product decisions at a fitness app",
    "seat": "Product manager at Loopwell",
    "clock": "Five rounds with a three-minute decision window each",
    "teaches": "Consider how separate data decisions add up and weigh useful features against what they reveal about a customer.",
    "tangle": "Each feature has a business reason. You need to consider both that request and the effect of combining it with earlier choices.",
    "turn": "You see the combined effect of a series of small decisions, rather than judging one request on its own.",
    "after": "Review your five decisions and what the app can and cannot offer the customer. There is no score.",
    "discussion": "The instructor can show how the class split on each request and compare the results.",
    "tryIt": "Try the complete activity before assigning it to students.",
    "sessionShape": "Allow about 30 minutes for play, including five three-minute decisions and the feedback between them. Add time for class discussion. In team mode, students vote on each request.",
    "recommendedMode": "individual",
    "catalogueFacts": [
      {
        "label": "Play",
        "value": "Individual (recommended) or team"
      },
      {
        "label": "Before play",
        "value": "No advance reading"
      },
      {
        "label": "Feedback",
        "value": "Review; no score"
      }
    ],
    "atAGlance": [
      {
        "label": "Main task",
        "value": "Five final approvals or rejections"
      },
      {
        "label": "Numbers",
        "value": "No calculations required"
      },
      {
        "label": "Play mode",
        "value": "Individual (recommended) or team"
      }
    ],
    "activity": "Read each feature request and approve or decline it. Review its effect on one customer before the next request arrives. Earlier decisions cannot be changed.",
    "suitableFor": "Product management, data ethics, and information systems classes.",
    "preparation": "No advance reading. All five requests are supplied during play.",
    "output": "Five final approve-or-decline decisions and a summary of their combined effects.",
    "beats": [
      {
        "at": "Read",
        "what": "Consider one feature request and its business reason."
      },
      {
        "at": "Choose",
        "what": "Approve or decline before the three-minute window ends."
      },
      {
        "at": "Review",
        "what": "See its effect, continue through five rounds, and review the full set of choices."
      }
    ],
    "durationNote": "About 30 minutes of play, plus discussion.",
    "momentsIntro": ""
  }
};

const CLOCK = {
  briefingSeconds: 60,
  decisionSeconds: 180,
  revealSeconds: 60,
  endingSeconds: 180
};

const CUSTOMER = { name: 'Dana Okafor', short: 'Dana', age: 34, since: 'Loopwell customer for two years' };

const BRIEFING = {
  heading: "You're the product manager at Loopwell.",
  individual: [
    "Loopwell is a fitness app with about two million users. Over the next twenty minutes, five feature requests will reach you, one at a time. Each comes from your own team with a business reason attached, and you approve it or decline it.",
    "Your decisions are final. You can't go back to an earlier round, and nothing you approve can be withdrawn later. Each round has a three-minute clock, and if it runs out before you decide, the feature ships (that's how the roadmap works here).",
    "After each decision you'll see what it means for one customer, Dana Okafor, 34, who has used Loopwell for two years. Your own choices stay private. The screen at the front shows only totals for the whole class."
  ],
  teamExtra: 'Your team decides by majority vote, and a tie ships the feature. A vote not cast before the clock runs out counts as approval.',
  // The timed minute before round 1: a recap, because the walkthrough did the teaching.
  recapHeading: 'Round 1 opens in a moment.',
  recap: 'You will see five requests, one at a time, and you have three minutes to decide on each one. Your decisions are final. If the clock runs out before you decide, the feature ships.'
};

// Untimed screens shown while the class gathers (or before a solo run starts).
const WALKTHROUGH = [
  {
    title: "You're the product manager at Loopwell.",
    body: [
      'Loopwell is a fitness app with about two million users. Five feature requests will reach you, one at a time. Each comes from your own team with a business reason attached, and you approve it or decline it.',
      "You'll see what each decision means for one customer, Dana Okafor.",
      'Take your time with these screens. Nothing starts until your instructor starts the session.'
    ],
    soloBody: [
      'Loopwell is a fitness app with about two million users. Five feature requests will reach you, one at a time. Each comes from your own team with a business reason attached, and you approve it or decline it.',
      "You'll see what each decision means for one customer, Dana Okafor.",
      'Take your time with these screens. The clock starts only when you press Start.'
    ]
  },
  {
    title: 'How a round works',
    example: true,
    body: [
      "Each round shows one request, why your team wants it, and what data it adds. Beside it is the screen Dana would get in her app if the feature ships.",
      "You have three minutes to approve or decline, and you confirm before your choice is recorded."
    ],
    labels: { request: 'The request', why: 'Why the team wants it', adds: 'What it adds', app: "Dana's app if it ships", buttons: 'Approve or decline', clock: 'Three minutes' }
  },
  {
    title: "Dana's file",
    fileExample: { tag: 'Example', label: 'What Loopwell can work out', level: 'high' },
    body: [
      'Dana Okafor, 34, has used Loopwell for two years. After each round her file shows what Loopwell can now work out about her, and how sure it can be.',
      'There are three levels: high confidence, reasonable confidence, and a loose guess. The file only ever shows what could be worked out, never what Loopwell does with it.'
    ]
  },
  {
    title: 'The rules',
    body: [
      "Your decisions are final. You can't go back to an earlier round, and nothing you approve can be withdrawn later.",
      "If the clock runs out before you decide, the feature ships (that's how the roadmap works here).",
      'Your own choices stay private. The screen at the front shows only totals for the whole class, and there is no score.'
    ],
    soloBody: [
      "Your decisions are final. You can't go back to an earlier round, and nothing you approve can be withdrawn later.",
      "If the clock runs out before you decide, the feature ships (that's how the roadmap works here).",
      'Your choices are yours alone, and there is no score.'
    ],
    teamBody: 'Your team decides by majority vote, and a tie ships the feature. A vote not cast before the clock runs out counts as approval.'
  }
];

const ROUNDS = [
  {
    n: 1, key: 'A',
    title: 'Step count and active minutes',
    request: "Let Loopwell read step count and active minutes from the phone's motion sensor, all day.",
    reason: "It's the core of the product. Without it, Loopwell is a notebook.",
    adds: "Loopwell gets a minute-by-minute record of when Dana is moving and when she isn't.",
    cost: 'Loopwell becomes a manual logging app. Most users, Dana included, stop logging within two weeks.',
    missing: 'Automatic step and activity tracking',
    app: { kind: 'steps', name: 'Step tracking', title: 'Today', big: '8,412', bigUnit: 'steps', small: '46 active minutes', off: 'Log your activity by hand to see your day.' }
  },
  {
    n: 2, key: 'G',
    title: 'Location on logged walks and runs',
    request: 'Let Loopwell record GPS while Dana logs a walk or run, so the app can draw her route.',
    reason: 'Route maps are the most-requested feature, and users who save routes stay twice as long.',
    adds: 'Loopwell learns where each workout starts, where it goes and where it ends.',
    cost: 'Route maps ship at two competitors this quarter. Dana requested them and now plans her runs in another app.',
    missing: 'Route maps for her runs',
    app: { kind: 'route', name: 'Route maps', title: 'Evening run', big: '3.2 mi', bigUnit: '31 min', small: 'Your route', off: "Route maps aren't available." }
  },
  {
    n: 3, key: 'S',
    title: 'Overnight sleep tracking',
    request: "Let Loopwell track Dana's sleep overnight, with one coarse location check at bedtime.",
    reason: "Sleep is the feature users cite most when they cancel, and competitors already have it. The bedtime location check keeps sleep reports in the right time zone.",
    adds: 'Loopwell learns when Dana falls asleep and wakes, and roughly where her phone is each night.',
    cost: "Sleep is the feature users cite most when they cancel. Dana's renewal is due next month.",
    missing: 'Sleep reports',
    app: { kind: 'sleep', name: 'Sleep reports', title: 'Last night', big: '7 h 12 m', bigUnit: 'asleep', small: 'Asleep 11:04 pm, awake 6:16 am', off: "Sleep reports aren't available." }
  },
  {
    n: 4, key: 'N',
    title: 'Grocery loyalty card link',
    request: 'Let Dana link her grocery loyalty card so nutrition tips can use what she actually buys.',
    reason: "The nutrition tier is next year's main new revenue, and people act on tips based on real purchases three times as often as tips based on food logs.",
    adds: 'Loopwell sees every item she buys at that chain, with the date and the store.',
    cost: "The nutrition tier doesn't launch, and next year's revenue plan assumed it would. Dana's diet questions go unanswered.",
    missing: 'Nutrition tips based on her shopping',
    app: { kind: 'tip', name: 'Nutrition tips', title: 'Nutrition tip', big: 'Swap your yogurt', bigUnit: '', small: 'Your usual yogurt has 18\u00a0g of sugar. The plain one has 5\u00a0g.', off: 'Nutrition tips need a food log. Add meals by hand to get tips.' }
  },
  {
    n: 5, key: 'H',
    title: 'Resting heart rate from her watch',
    request: "Let Loopwell sync resting heart rate from Dana's watch.",
    reason: 'Calorie estimates are the top complaint in support tickets. Heart rate cuts the error by more than half.',
    adds: 'Loopwell gets her resting heart rate, measured continuously, every day.',
    cost: "Calorie estimates stay off by up to 20% for users like Dana. That's the top complaint in support tickets.",
    missing: 'Accurate calorie estimates',
    app: { kind: 'calories', name: 'Calorie estimates', title: 'Calories burned today', big: '412 calories', bigUnit: '', small: 'This estimate uses your heart rate, so it is accurate to within 5%.', off: 'This estimate uses steps only, so it can be off by up to 20%.' }
  }
];

// Each inference lists levels from strongest to weakest. The first level whose
// `requires` keys are all approved is the one reached. `lighter` replaces the
// text when the instructor chose the lighter setting at session creation.
const INFERENCES = [
  {
    id: 'routine',
    label: 'Daily routine',
    levels: [
      {
        level: 'high', requires: ['A'],
        text: 'Loopwell knows when Dana usually wakes, when she commutes and when she sits still for hours. It can estimate her working day to within about fifteen minutes.'
      }
    ]
  },
  {
    id: 'places',
    label: 'Home and workplace',
    levels: [
      {
        level: 'high', requires: ['G'],
        text: 'Loopwell knows where Dana lives and where she works. Most of her routes start and end at the same two places, so it can place both with high confidence.'
      },
      {
        level: 'moderate', requires: ['S'],
        text: 'Loopwell knows where Dana lives. Her phone spends most nights in the same place, so it can estimate her home address with reasonable confidence, though not where she works.'
      }
    ]
  },
  {
    id: 'second',
    label: 'A second address',
    levels: [
      {
        level: 'high', requires: ['S'],
        text: "Loopwell knows that Dana sleeps at a second address across town two nights a week. It can't tell whose address it is or why she's there."
      }
    ]
  },
  {
    id: 'health',
    label: 'Early pregnancy',
    lighterLabel: 'A change in her health',
    levels: [
      {
        level: 'high', requires: ['A', 'S', 'N', 'H'],
        text: "Loopwell can tell that Dana is likely in early pregnancy. Her resting heart rate is up, her runs are shorter, she sleeps longer, and three weeks ago she stopped buying alcohol and started buying ginger and crackers. No single signal says it. Together they point one way, weeks before she's likely told anyone.",
        lighter: "Loopwell can tell, with high confidence, that something in Dana's health changed about a month ago. Her resting heart rate is up, her runs are shorter, she sleeps longer, and her shopping changed three weeks ago. No single signal says it. Together they point one way."
      },
      {
        level: 'moderate', requires: ['H', 'A'], label: 'A change in her health',
        text: "Loopwell can tell that something changed in Dana's body about a month ago. Her resting heart rate is up and her runs are shorter. It can't yet say what.",
        lighter: "Loopwell can tell that something changed in Dana's body about a month ago. Her resting heart rate is up and her runs are shorter. It can't yet say what."
      },
      {
        level: 'moderate', requires: ['N', 'S'], label: 'A change in her health',
        text: "Loopwell can tell that something changed for Dana about a month ago. She sleeps longer, stopped buying alcohol and started buying ginger and crackers. It can't yet say what.",
        lighter: "Loopwell can tell that something changed for Dana about a month ago. She sleeps longer and her shopping changed. It can't yet say what."
      },
      {
        level: 'low', requires: ['N'], label: 'A change in her shopping',
        text: "Loopwell has noticed that Dana's shopping changed three weeks ago: no alcohol, more ginger and crackers. On its own that fits several stories.",
        lighter: "Loopwell has noticed that Dana's shopping changed three weeks ago. On its own that fits several stories."
      }
    ]
  }
];

// Ending groups, checked in order; the first match wins.
const ENDINGS = [
  { group: 1, label: 'Early pregnancy, high confidence', lighterLabel: 'Health change, high confidence', when: { health: ['high'] } },
  { group: 2, label: 'Early pregnancy, moderate or low', lighterLabel: 'Health change, moderate or low', when: { health: ['moderate', 'low'] } },
  { group: 3, label: 'Second address, no pregnancy estimate', lighterLabel: 'Second address, no health estimate', when: { second: ['high'] } },
  { group: 4, label: 'Home and workplace only', when: { places: ['high', 'moderate'] } },
  { group: 5, label: 'Routine only', when: { routine: ['high'] } },
  { group: 6, label: 'Nothing beyond what she enters herself', when: null }
];

const STUDENT_COPY = {
  decide: { approve: 'Approve', decline: 'Decline' },
  outcomeWords: { approve: 'Approved', decline: 'Declined', timeout: 'Shipped when the clock ran out' },
  revealHeading: 'What Loopwell can now work out about Dana',
  revealEmpty: 'Loopwell knows nothing yet beyond what Dana enters herself.',
  newMarker: 'New',
  updatedMarker: 'Updated',
  newInFile: "New in Dana's file",
  updatedInFile: "Updated in Dana's file",
  revealUnchanged: "Dana's file is unchanged.",
  costHeading: 'What this means',
  endingHeading: 'Where this leaves Dana',
  endingKnows: 'What Loopwell can work out about Dana',
  endingMissing: "What Loopwell couldn't offer her",
  endingMissingEmpty: 'Every feature shipped.',
  yourDecisions: 'Your five decisions',
  yourVotes: 'Your vote',
  teamDecision: 'Team decision',
  levelWords: { high: 'High confidence', moderate: 'Reasonable confidence', low: 'A loose guess' },
  waitingForStart: 'Your instructor will start the session. This page updates on its own.',
  waitingForTeam: 'Your instructor is placing you on a team. This page updates on its own.',
  paused: 'Your instructor has paused the session. The clock is stopped.',
  confirmApprove: "Approve this request? You can't change it later.",
  confirmDecline: "Decline this request? You can't change it later.",
  votedIndividual: 'Decision recorded. The result appears when the round closes.',
  votedTeam: "Your vote is in. Your team's decision appears when the round closes.",
  roundOpensIn: 'Round {n} opens in',
  roundClosesIn: 'Round closes in',
  endingIn: 'The ending opens in',
  sessionClosed: 'This session has closed.',
  timeoutRule: 'If the clock runs out, the feature ships.',
  countLine: 'You approved {approve} and declined {decline}.',
  teamCountLine: 'Your team approved {approve} and declined {decline}.',
  timeoutCountOne: 'The clock ran out on one more, and it shipped.',
  timeoutCountMany: 'The clock ran out on {timeout} more, and they shipped.',
  timeoutCountAll: 'The clock ran out on all five, and every one shipped.',
  closingLine: 'Your instructor will take it from here.',
  soloClosingLine: "That's the end of the simulation. Nothing here is scored.",
  soloReflection: 'Before you close this page, name a company that holds data about you, and something it could work out that you never told it.',
  outcomeSentence: { approve: 'You approved this request.', decline: 'You declined this request.', timeout: 'The clock ran out, so this feature shipped.' },
  teamOutcomeSentence: { approve: 'Your team approved this request.', decline: 'Your team declined this request.', timeout: 'The clock ran out, so this feature shipped.' },
  summaryNone: "Loopwell can't work out anything about Dana that she didn't tell it.",
  summaryOne: 'Loopwell can now work out one thing about Dana that she never told it.',
  summaryMany: 'Loopwell can now work out {n} things about Dana that she never told it.',
  countAllApproved: '{who} approved all five requests.',
  countAllDeclined: '{who} declined all five requests.',
  countBoth: '{who} approved {approve} and declined {decline}.',
  countApprovedOnly: '{who} approved {approve}.',
  countDeclinedOnly: '{who} declined {decline}.',
  appHeading: "Dana's app",
  appIfShips: "Dana's app if this ships",
  appNotShipped: 'Not in her app',
  walkNext: 'Next',
  walkBack: 'Back',
  walkReview: 'Back to the walkthrough',
  walkReady: "I'm ready",
  walkStartSolo: 'Start',
  walkWaiting: 'You are ready. Your instructor will start the session.',
  walkSkip: 'Skip to the open round',
  walkLate: 'The session has already started.',
  skipToResult: 'Show me the result',
  skipToNext: 'Go to round {n}',
  skipToEnding: 'Go to the ending',
  expandHint: 'Tap a line to read it in full.',
  teamYoureOn: "You're on {team}.",
  teamRename: 'Rename your team',
  teamRenameSave: 'Save name',
  teamRenameHint: 'Anyone on your team can rename it until the session starts.'
};

const DEBRIEF = {
  disagreement: 'Round {round} split {approve}–{decline}. Find one of each.',
  disagreementTeams: 'Round {round} split {teams} internally. Ask {whose} members where they disagreed.',
  noDisagreement: 'No round divided the class. Ask who hesitated longest, and at which round.',
  naming: [
    { term: 'Collected vs inferred', line: 'Loopwell collected steps, routes, sleep, shopping and heart rate. It inferred a pregnancy nobody told it about.' },
    { term: 'Purpose limitation', line: "Data gathered for one purpose shouldn't be used for another. Route maps don't justify knowing where Dana sleeps." },
    { term: 'Data minimization', line: 'Collect only what a feature needs. Sleep reports needed a time zone, not a nightly location.' },
    { term: 'Consent for every step, covering none of the result', line: 'Dana agreed to each feature. She never agreed to the combination.' }
  ],
  turn: 'Name a company that holds data about you, and something it could work out that you never told it.',
  teamPrompt: 'Who voted against something that shipped anyway?',
  headlineMain: '{reached} of {total} {unit} ended with Loopwell estimating {what}.',
  headlineZero: 'None of the {total} {unit} ended with Loopwell estimating {what}.',
  headlineNoneDeclined: 'None of them declined a request.',
  headlineSomeDeclined: 'Of those, {declinedSome} declined at least one request.',
  headlineWhat: { standard: "a change in Dana's health", lighter: "a change in Dana's health" },
  headlineLevels: ['high', 'moderate']
};

module.exports = { META, CLOCK, CUSTOMER, BRIEFING, WALKTHROUGH, ROUNDS, INFERENCES, ENDINGS, STUDENT_COPY, DEBRIEF };
