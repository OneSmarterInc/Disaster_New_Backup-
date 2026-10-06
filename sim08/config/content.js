// RapidSim 08 — Eighteen Months Later
// Every word a student or instructor sees lives here, not in code.
// Edit this file to change copy; `npm test` refuses placeholders, banned words,
// days of the week, course or institution names, and a question menu whose
// routes stop covering every vendor's hidden risk.
//
// Vendor keys: kestrel · tailwind · pawtime
// Outcome tiers (instructor-only): adopted · lucky · knew · shadow

const META = {
  "id": "rapid-08-later",
  "replaces": [],
  "catalogueRevision": "later-v2-2026-09",
  "title": "Eighteen Months Later",
  "tagline": "You choose in twenty minutes. You find out a year and a half later.",
  "description": "You help four veterinary clinics choose a scheduling system. Compare three vendors, spend a total of six questions, and choose a supplier and a plan to start using the system. Then see the result eighteen months later.",
  "minutes": 25,
  "detail": {
    "world": "Choosing software for veterinary clinics",
    "seat": "Member of the selection committee at Brookfield Veterinary",
    "clock": "A timed selection followed by an eighteen-month jump",
    "teaches": "Ask useful questions about software and plan how staff will start using it.",
    "tangle": "You cannot ask everything. The choice must fit both the budget and the way people work.",
    "turn": "You compare the sales presentation with what daily work looks like after the system has been introduced.",
    "after": "Review your vendor choice, questions, launch plan, and later result. There is no score.",
    "discussion": "The instructor can compare choices and results to discuss which questions and preparations mattered.",
    "tryIt": "Try the complete activity before assigning it to students.",
    "sessionShape": "Allow about 25 minutes for the activity. The timed briefing and decision stages total 17 minutes, including nine minutes for vendor questions; add time to read the result and discuss it. Team play is recommended.",
    "recommendedMode": "team",
    "catalogueFacts": [
      {
        "label": "Play",
        "value": "Team (recommended) or individual"
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
        "value": "One vendor and one launch plan"
      },
      {
        "label": "Numbers",
        "value": "Compare costs within a $240,000 budget"
      },
      {
        "label": "Play mode",
        "value": "Team (recommended) or individual"
      }
    ],
    "activity": "Review three proposals and demonstrations. Spend six questions across the vendors, choose a system, and commit to a plan for introducing it at the clinics.",
    "suitableFor": "Systems analysis, software purchasing, and change management classes.",
    "preparation": "No advance reading. Proposals, demonstrations, and questions are supplied during play.",
    "output": "Six vendor questions, one system choice, and a plan for starting to use it.",
    "beats": [
      {
        "at": "Compare",
        "what": "Read three proposals and watch the demonstrations."
      },
      {
        "at": "Ask and choose",
        "what": "Use six questions, select a vendor, and choose a launch plan."
      },
      {
        "at": "Review",
        "what": "Read the eighteen-month report and discuss your choices."
      }
    ],
    "durationNote": "Allow about 25 minutes for the activity, plus class discussion.",
    "momentsIntro": ""
  }
};

// Seconds per phase. The report phase has no end; the instructor closes the session.
const CLOCK = {
  briefingSeconds: 120,
  demoSeconds: 180,
  questionSeconds: 540,
  commitSeconds: 120,
  planSeconds: 60
};

const QUESTION_BUDGET = 6;
const BUDGET_CEILING = 240000;

const PRACTICE = {
  name: 'Brookfield Veterinary',
  clinics: ['Main Street', 'Northgate', 'Elm Park', 'Riverside'],
  person: { name: 'Rosa Pruitt', short: 'Rosa', role: 'Front-desk lead, Main Street', years: 'fourteen years at the desk' }
};

const BRIEFING = {
  heading: "You're choosing Brookfield's next scheduling system.",
  paragraphs: [
    "Brookfield Veterinary has four clinics and a scheduling system that's about to lose support. Each clinic keeps its own calendar, so when Main Street is full the front desk phones around to find an opening somewhere else. Clients want to book online. The vets want fewer no-shows. The board wants one system across all four sites, and it's approved up to $240,000 over three years.",
    "You're the committee choosing that system. Three vendors made the shortlist, and each has sent a proposal and a representative. You'll see each vendor's prepared demonstration first. Then you can put six questions to the vendors from the menu, and each question goes to all three. You can't ask everything, and the clock won't wait.",
    "When the questions close, you commit to one vendor, then to one go-live plan. Then the practice goes live, and you find out what happened. Nothing is scored."
  ],
  teamExtra:
    "Your team shares one budget of six questions. Anyone on the team can spend one, so talk before you do. The vendor and the go-live plan are private votes, and the majority decides. If the team can't settle on a vendor, the board chooses on price.",
  individualExtra:
    "If you don't commit to a vendor before the clock runs out, the board chooses on price."
};

// Student-visible proposal summary. Hidden risks live only in QUESTIONS and REPORTS.
const VENDORS = [
  {
    key: 'kestrel', name: 'Kestrel Practice Suite', rep: 'Gavin Hale',
    pitch: 'Full practice management with scheduling as one module: records, billing and booking in one place.',
    implementation: 'Vendor-led, twelve weeks, all four clinics go live together',
    fee: 96000, monthly: 3200, threeYear: 211200,
    demo: 'Gavin books a routine wellness visit for a dog with complete records, sends the reminder, and shows the day view with all four clinics side by side. It is quick and polished.'
  },
  {
    key: 'tailwind', name: 'Tailwind Scheduling', rep: 'Lena Marsh',
    pitch: 'Scheduling only, built to be configured around how your practice already works.',
    implementation: 'Partner-led, eight weeks, booking rules configured by your practice',
    fee: 48000, monthly: 1650, threeYear: 107400,
    demo: 'Lena books the same wellness visit, shows a booking rule filling the slot automatically, and sends the reminder. Clean and fast.'
  },
  {
    key: 'pawtime', name: 'Pawtime', rep: 'Neil Becker',
    pitch: 'Simple scheduling your front desk will pick up in a week.',
    implementation: 'Self-serve, two weeks',
    fee: 6000, monthly: 540, threeYear: 25440,
    demo: 'Neil books the same wellness visit in three clicks and sends the reminder. The screen looks a lot like the one Brookfield uses now.'
  }
];

// The menu. `routes` marks which answers carry a vendor's hidden risk:
// direct surfaces it; partial hints at it. Found = one direct, or two partials.
const QUESTIONS = [
  {
    id: 'q01', group: 'diligence',
    text: "What's your platform architecture, and where is our data hosted?",
    answers: {
      kestrel: 'Cloud-native and multi-tenant, hosted in two US regions with automatic failover. Your data never leaves the country.',
      tailwind: 'Fully cloud, on a major US provider, with nightly backups and point-in-time restore.',
      pawtime: "It's all in the cloud, US data centres, backed up every night. You won't need a server in the closet."
    },
    routes: {}
  },
  {
    id: 'q02', group: 'diligence',
    text: "What's your uptime commitment, and what happens when you miss it?",
    answers: {
      kestrel: "99.95 per cent, written into the contract, with service credits if we miss it. We haven't missed it in three years.",
      tailwind: '99.9 per cent contractual. If we fall short, the credit comes off your next invoice.',
      pawtime: "99.9. If we miss it you get a credit. Honestly, we've never had to pay one out."
    },
    routes: {}
  },
  {
    id: 'q03', group: 'diligence',
    text: "What's on your product roadmap for the next two years?",
    answers: {
      kestrel: 'AI-assisted triage notes, a client mobile app, and deeper lab integration over the next eighteen months.',
      tailwind: 'Better no-show prediction, and a rules library so new customers can start from templates.',
      pawtime: 'Online payment at booking and a nicer reminder editor. We keep it small on purpose.'
    },
    routes: {}
  },
  {
    id: 'q04', group: 'diligence',
    text: 'What security certifications do you hold?',
    answers: {
      kestrel: 'SOC 2 Type II, annual penetration testing, encryption at rest and in transit, role-based access throughout.',
      tailwind: 'SOC 2 Type II and encryption end to end. I can send the report under NDA.',
      pawtime: 'SOC 2 Type II as of last year, encryption everywhere. Happy to send the report over.'
    },
    routes: {}
  },
  {
    id: 'q05', group: 'diligence',
    text: 'Can you give us three reference customers?',
    answers: {
      kestrel: 'Absolutely. Three large groups, including a twelve-clinic practice in the Southeast. Their practice managers love it.',
      tailwind: "Yes, three practices about your size. I'll put you in touch with the owners.",
      pawtime: "Sure. Three practices that have been with us for years. They're all single-clinic, but they'll tell you how easy it is."
    },
    routes: { pawtime: 'partial' }
  },
  {
    id: 'q06', group: 'diligence',
    text: 'What does it integrate with: lab results, payments, reminders?',
    answers: {
      kestrel: 'All of those, plus imaging and pharmacy. Over forty integrations out of the box.',
      tailwind: 'Labs, payments and reminders natively. Anything else through our open API.',
      pawtime: 'Payments and reminders are built in. Labs through a partner connector.'
    },
    routes: {}
  },
  {
    id: 'q07', group: 'diligence',
    text: "What's the full five-year cost, including everything not in the quote?",
    answers: {
      kestrel: 'Licence and implementation as quoted. Most practices your size also budget for extra front-desk cover in the first quarter, somewhere around $25,000 to $30,000.',
      tailwind: 'The quote, plus a small partner fee if you want rule changes after go-live. Call it $3,000 a year.',
      pawtime: "What's on the quote is what you pay. No surprises."
    },
    routes: { kestrel: 'partial' }
  },
  {
    id: 'q08', group: 'diligence',
    text: 'How do you move our existing appointments and client records across?',
    answers: {
      kestrel: 'Our migration team moves everything. You validate a sample before cutover.',
      tailwind: 'Our implementation partner handles it and runs a test load first.',
      pawtime: 'You export a spreadsheet from your current system and we import it. Most practices are done in an afternoon.'
    },
    routes: {}
  },
  {
    id: 'q09', group: 'adoption',
    text: 'Who at our practice has to change how they work, and by how much?',
    answers: {
      kestrel: "Everyone at the front desk moves to a new booking flow, and the vets get a new day view. It's a real change. It's also a better way of working.",
      tailwind: "Less than you'd think. Routine booking looks the way it does today, and the rules handle the rest once they're set up.",
      pawtime: "Hardly anyone changes anything. It looks and works a lot like what you've got now."
    },
    routes: { pawtime: 'partial' }
  },
  {
    id: 'q10', group: 'adoption',
    text: 'What are the first three months like for the person at the front desk?',
    answers: {
      kestrel: 'Candidly, check-in runs slower for two or three months. Super users get two days of training. The front desk gets a ninety-minute video. Practices that fund extra cover through that stretch come out fine.',
      tailwind: "They'll book routine visits from the first day. It's the same screen they'd expect.",
      pawtime: 'Pretty painless. Most front desks are comfortable inside a week.'
    },
    routes: { kestrel: 'direct' }
  },
  {
    id: 'q11', group: 'adoption',
    text: 'In your system, who handles emergencies, walk-ins and same-day squeezes?',
    answers: {
      kestrel: "There's an emergency flag and an override queue. Your practice manager decides who works it.",
      tailwind: "That's all configurable. You define how emergencies, walk-ins and squeezes are handled, and the system enforces it. The practices that name someone to own that before go-live do well. The ones that don't tend to feel it.",
      pawtime: 'The front desk books them into whatever slot is open, same as now.'
    },
    routes: { tailwind: 'direct' }
  },
  {
    id: 'q12', group: 'adoption',
    text: 'What happens to the things our staff do by hand today?',
    answers: {
      kestrel: 'The whiteboard and the phone calls go away. Everything sits in one calendar across all four clinics.',
      tailwind: 'Anything that follows a rule, the system takes over. Anything that is a judgement call, somebody still has to make, and that person has to be written into the rules.',
      pawtime: 'Each clinic has its own calendar, so the calling around would stay as it is. A few customers keep a shared sheet of openings between sites.'
    },
    routes: { tailwind: 'direct', pawtime: 'direct' }
  },
  {
    id: 'q13', group: 'adoption',
    text: 'Can we talk to a front-desk person at a reference customer, not the manager?',
    answers: {
      kestrel: 'Keisha, front desk at a reference group: "The first two months were rough. We ran a paper sign-in sheet beside it until we caught up, and a couple of our sites still do."',
      tailwind: 'Marco, front desk at a reference practice: "Routine booking was easy. Emergencies were a mess until our manager finally sat down and wrote the rules. That took about four months."',
      pawtime: 'Jen, front desk at a reference practice: "Love it. We\'re one clinic, so it\'s just us, and it\'s simple."'
    },
    routes: { kestrel: 'direct', tailwind: 'partial' }
  },
  {
    id: 'q14', group: 'demo',
    text: 'Show us a booking for a client with no phone number on file.',
    answers: {
      kestrel: 'The screen won\'t save. A red banner asks for a supervisor override code. Gavin enters his own admin code and moves on.',
      tailwind: 'The booking saves with an amber "follow up" flag.',
      pawtime: "The booking saves. A small note says reminders won't be sent."
    },
    routes: { kestrel: 'partial' }
  },
  {
    id: 'q15', group: 'demo',
    text: "Show us booking a patient into a different clinic from the one you're logged into.",
    answers: {
      kestrel: 'Gavin picks Northgate from a dropdown and books. Done in seconds.',
      tailwind: 'Lena switches location in the header and books. Done in seconds.',
      pawtime: 'Neil logs out, logs back in to the Northgate account, and books. "Each clinic\'s its own account. On our Group plan you get a shared view across clinics. That\'s $290 more a month."'
    },
    routes: { pawtime: 'direct' }
  },
  {
    id: 'q16', group: 'demo',
    text: 'Show us what the screen does when someone enters it wrong.',
    answers: {
      kestrel: 'A validation message with an error code. The clerk has to fix it before moving on.',
      tailwind: 'It saves and drops into a review queue "for a supervisor". Asked which supervisor, Lena says: "Whoever you configure."',
      pawtime: 'An undo button. Simple.'
    },
    routes: { tailwind: 'partial' }
  }
];

// Shown only after the vendor is committed, so the list cannot hint at questions.
const PLANS = [
  { key: 'cover', text: 'Fund extra front-desk cover for the first three months (about $28,000).', cost: 28000, matches: ['kestrel'] },
  { key: 'owner', text: 'Name an owner for emergencies, walk-ins and squeezes, and have them write the rules before go-live.', cost: 0, matches: ['tailwind'] },
  { key: 'multisite', text: "Buy the vendor's multi-site tier before go-live, if it has one.", cost: 10440, matches: ['pawtime'] },
  { key: 'parallel', text: 'Run the old scheduler in parallel for three months, just in case.', cost: 0, matches: [] }
];

const REPORTS = {
  kestrel: {
    adopted: {
      headline: 'Whiteboard down by month four',
      text: "Eighteen months on, Brookfield runs on Kestrel at all four clinics. The first ten weeks were as slow as Gavin said they'd be: check-in at Main Street went from about four minutes to nine, and the queue reached the door first thing most mornings. The extra front-desk cover you funded absorbed it. Rosa spent those weeks learning the new flow instead of working around it, and by month four the emergency whiteboard came down. Nobody asked her to take it down. She just stopped needing it. The practice spent $239,200 of its $240,000."
    },
    lucky: {
      headline: 'Cover cut at two clinics; paper sign-in at one',
      text: "Eighteen months on, Kestrel is live at all four clinics, and it mostly works. You funded extra front-desk cover, which turned out to be exactly the right call, though nobody on the committee could say why when the board asked. That made the money easy to cut. Main Street kept its cover. Northgate and Elm Park lost theirs in the second month's budget review, and their check-in times never fully recovered. Riverside still runs a paper sign-in sheet on busy days, and someone types it in at lunch."
    },
    knew: {
      headline: 'Paper sign-in at three clinics',
      text: "Eighteen months on, Kestrel is live, and nothing that happened surprised the committee. You'd heard that check-in would slow for months, and you spent the preparation elsewhere. Check-in at Main Street went from four minutes to nine and stayed above seven through the summer. Rosa started a paper sign-in sheet in week two, \"just until we catch up\". Three clinics still use it. Every afternoon someone types the morning's sheet into a $211,200 system."
    },
    shadow: {
      headline: 'Paper sign-in and whiteboard run the desk',
      text: 'Eighteen months on, Kestrel is technically live at all four clinics. Check-in went from four minutes to nine in the first month. Nobody had planned for that, so the front desk did what front desks do: Rosa put a paper sign-in sheet on the counter on day three, and it worked. It\'s still there. So is the emergency whiteboard. The vets like the new day view, and the practice now pays $3,200 a month to store what the front desk writes on paper first.'
    }
  },
  tailwind: {
    adopted: {
      headline: 'Rosa wrote the rules; whiteboard down by month three',
      text: "Eighteen months on, Tailwind runs all four clinics. Before go-live, Rosa spent two afternoons writing down what she'd carried in her head for fourteen years: which emergencies jump the queue, which vets take a same-day squeeze, when a walk-in waits and when it doesn't. Those became the rules. The first month still had rough edges, and Rosa fixed them in the rules instead of on the whiteboard. The whiteboard came down in month three. When Rosa was on leave last spring, Northgate covered Main Street's front desk without making a single phone call."
    },
    lucky: {
      headline: 'Rules from the template; a list taped under the counter',
      text: "Eighteen months on, Tailwind is live. You named an owner for emergencies and walk-ins before go-live, which was the right instinct, but nobody told the owner what the job was. The practice manager took it on top of everything else and wrote the rules from the vendor's template, not from Rosa. The template didn't know that Dr Osei takes squeezes and Dr Lind never does. Routine booking works. The exceptions half-work, and Rosa keeps a short list taped under the counter of the ones the system gets wrong."
    },
    knew: {
      headline: 'Default rules; emergencies back on the whiteboard',
      text: "Eighteen months on, Tailwind is live and routine booking is smooth. The committee knew the exception rules needed an owner, but nobody was named. The rules shipped as the vendor's defaults, and the first emergency that week was booked into the next open slot, two hours out. Rosa moved it by hand and kept the whiteboard up \"for emergencies only\". Emergencies, walk-ins and squeezes are about a fifth of Main Street's day, and they all go through the whiteboard now."
    },
    shadow: {
      headline: 'Routine visits only; whiteboard and phone run the rest',
      text: "Eighteen months on, Tailwind handles routine visits beautifully. Everything else runs the way it did before you bought it. The system was never told how Brookfield handles emergencies, walk-ins or same-day squeezes, because nobody knew it had to be told. Rosa knew. She kept the whiteboard and the phone, and most afternoons she still calls Northgate to ask who has a gap. Lena's team has offered twice to configure the rules. Both times the practice asked who would write them, and nobody had the time."
    }
  },
  pawtime: {
    adopted: {
      headline: 'Shared view; the call-around stopped in month one',
      text: "Eighteen months on, Pawtime runs all four clinics on the Group plan. The front desk was comfortable inside a week, just as Neil promised. Because you bought the shared view before go-live, Main Street can see Northgate's gaps without picking up the phone, and the call-around stopped in the first month. Rosa says it's the least exciting system change she's been through. The practice spent about $36,000 of a $240,000 budget and has started asking what to do with the rest."
    },
    lucky: {
      headline: 'Shared view at three clinics; one still phones',
      text: "Eighteen months on, Pawtime is live and the Group plan is on the invoice. You bought the multi-site tier as a precaution, and it turned out to be the thing that made the system work. Nobody at the practice knew that, though, so nobody was trained on it. Three clinics use the shared view. Riverside never switched it on and still phones Main Street to ask about openings. The front desk there calls it \"the other screen\"."
    },
    knew: {
      headline: 'Four accounts and a shared spreadsheet',
      text: "Eighteen months on, Pawtime is live at all four clinics as four separate accounts. The committee had watched Neil log out and log back in, and it seemed like a small thing at the time. In the first week, Rosa made a shared spreadsheet of openings so the clinics could stop phoning each other. It's now the most-used screen in the practice. Every clinic updates it by hand twice a day, and when someone forgets, a patient is sent to a clinic with no gap."
    },
    shadow: {
      headline: 'Four calendars and a spreadsheet',
      text: "Eighteen months on, Pawtime is live, cheap and well liked. The front desk learned it in a week. It's four clinics on four accounts with no way to see each other's calendars, which is exactly where you started. The calling around never stopped. In month two, Rosa built a shared spreadsheet of openings, and it now runs all the cross-clinic booking. The board approved $240,000 to get one calendar across four sites. It spent $25,440 and got four calendars and a spreadsheet."
    }
  }
};

// Sentences added around a report. `parallel` follows any outcome except adopted.
const REPORT_NOTES = {
  boardChose: "Your committee didn't settle on a vendor before the clock ran out, so the board chose on price.",
  noPlan: "The committee didn't agree on a go-live plan, so none was funded.",
  parallel: 'The old scheduler you kept running in parallel was never switched off. Northgate still books into it when things get busy.'
};

const STUDENT_COPY = {
  phaseLabels: {
    briefing: 'Demonstrations begin in',
    demos: 'Questions open in',
    questions: 'Questions close in',
    commit: 'Vendor choice closes in',
    plan: 'Go-live plan closes in'
  },
  waitingForStart: 'Your instructor will start the session shortly.',
  waitingForTeam: 'Your instructor is putting teams together. You will see your team here once it is set.',
  paused: 'Your instructor has paused the session. The clock will resume shortly.',
  sessionClosed: 'This session has closed.',
  proposalsHeading: 'The shortlist',
  demosHeading: 'The prepared demonstrations',
  demosLead: 'Each vendor shows the booking they prepared. Questions open when the demonstrations finish.',
  menuHeading: 'Question menu',
  menuLead: 'Each question goes to all three vendors. Once spent, it cannot be taken back.',
  remaining: '{n} of {of} questions left',
  remainingNone: 'All six questions spent.',
  confirmAsk: 'Spend one of your questions on this?',
  confirmTeam: 'This spends one of your team\'s shared questions.',
  askedBy: 'asked by {name}',
  answersHeading: 'What the vendors said',
  answersEmpty: 'Nothing asked yet.',
  noneSpent: 'No questions spent.',
  commitHeading: 'Commit to a vendor',
  commitLead: 'Your answers stay on screen. Choose the vendor Brookfield will buy.',
  commitTeam: 'Your vote is private. The majority decides.',
  confirmVendor: 'Commit to {vendor}? This is final.',
  votedVendor: 'Your vote is in. The choice is locked when the clock runs out.',
  planHeading: 'Choose one go-live plan',
  planLead: 'Brookfield is buying {vendor}. Choose the one preparation you will fund before go-live.',
  confirmPlan: 'Commit to this plan? This is final.',
  votedPlan: 'Your vote is in. The plan is locked when the clock runs out.',
  reportKicker: 'Eighteen months later',
  reportChose: 'Brookfield bought {vendor}',
  youAsked: 'The questions you spent',
  yourPlan: 'Your go-live plan',
  noPlanChosen: 'No plan',
  go: 'Confirm',
  back: 'Go back'
};

// Instructor-only. The projector reveals in four steps after the report opens.
const DEBRIEF = {
  steps: [
    { key: 'vendors', label: '1 · Vendors' },
    { key: 'outcomes', label: '2 · Eighteen months on' },
    { key: 'questions', label: '3 · Questions and plans' },
    { key: 'routes', label: '4 · Where the warnings were' }
  ],
  disagreement:
    '{a} and {b} both bought {vendor} and ended up in different places. Before anything else, what did one of you know that the other didn\'t?',
  disagreementNone:
    'Nobody who chose the same vendor landed differently. Ask which team came closest to asking the question that mattered, and what stopped them.',
  naming: [
    'Total cost of ownership: the quote is the first item, not the total.',
    'Shadow systems: the paper sheet, the whiteboard, the spreadsheet beside the real system.',
    'Configuration against customisation: configurable means somebody has to configure it.',
    'Change management: who has to work differently, and who pays for the slow weeks.',
    'Ask what would make this fail, not what you should do.'
  ],
  turn: 'Name a system you have been made to use, and the workaround you or someone near you invented to get around it.',
  riskLabels: {
    kestrel: 'Front-desk training gap',
    tailwind: 'Nobody owns the exceptions',
    pawtime: 'No shared calendar across clinics'
  },
  tierLabels: { adopted: 'Adopted', lucky: 'Right plan, not found', knew: 'Found, wrong plan', shadow: 'Shadow system' }
};

module.exports = {
  META, CLOCK, QUESTION_BUDGET, BUDGET_CEILING, PRACTICE, BRIEFING, VENDORS, QUESTIONS,
  PLANS, REPORTS, REPORT_NOTES, STUDENT_COPY, DEBRIEF
};
