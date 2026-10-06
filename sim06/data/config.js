'use strict';
// Sim-06 "Do We Switch?" — all content and thresholds live here.
// Editable without touching the engine. Run `node tools/build-gate.js` after any edit.

module.exports = {
  sim: {
    id: 'rapid-06-switch',
    number: 6,
    title: 'Do We Switch?',
    cardLine: 'One decision, taken while the reports are still arriving.',
    teaches: 'What a second supplier actually buys you · How to act before the cause is known',
  },

  modes: ['individual', 'team'], // required at session creation, no default

  clock: {
    playSeconds: 600,          // 10 real minutes
    storyStart: '11:05',
    storyMinutesPerRealMinute: 6,
  },

  economics: {
    currency: 'US$',
    normalPerStoryMinute: 800,   // $48,000 busiest hour across 12 stores
    outagePerStoryMinute: 560,   // ~30% of card transactions still clear
    switchWindowStoryMinutes: 8, // zero card sales while terminals re-register
  },

  reasonMaxLength: 200,
  projectorMinGroupForReading: 3, // hide per-state reading share below this, to protect individuals

  briefing: [
    "You run store operations for Harlow Home & Hardware, a chain of twelve hardware and home goods stores across the Tri-County region. It's 11:05, the busiest hour of the trading day, and card payments are failing in every store. Some transactions go through after a long wait. Most time out.",
    "Harlow has two network providers. Northline Fibre carries everything day to day. ClearPath Business was added three years ago as a backup, and its fixed-wireless link sits in every store ready to take over. Switching is one call to ClearPath and a re-registration of every terminal, which takes about eight minutes during which no store can take a card at all. It can't be undone before close of business.",
    "Reports will come in over the next hour of store time. You can switch to ClearPath at any point, or commit to staying on Northline at any point. Either choice asks you for one line explaining why. If you do neither before the clock runs out, that's recorded too.",
    "Two documents are attached: an extract from the Northline contract and ClearPath's network summary. You can open them now or at any time during play.",
  ],

  // Shown once before the briefing. Written to be understood on the first read.
  walkthrough: [
    { title: 'What is going on',
      text: [
        'Card payments are failing in all twelve Harlow Home & Hardware stores.',
        'You run store operations. You will read reports as they come in and decide what to do about it.',
      ] },
    { title: 'How the reports arrive',
      text: [
        'When your instructor starts the clock, a new report appears about every 45 seconds. There are twelve.',
        'Everyone in the room gets each report at the same moment.',
        'The clock runs ten minutes. That is one hour of store time, from 11:05 to 12:05.',
        'A red counter at the top shows the card sales Harlow has lost so far.',
      ],
      soloText: [
        'When you press Start simulation, a new report appears about every 45 seconds. There are twelve.',
        'The clock runs ten minutes. That is one hour of store time, from 11:05 to 12:05.',
        'A red counter at the top shows the card sales Harlow has lost so far.',
      ] },
    { title: 'The one decision',
      text: [
        'Switch to ClearPath moves every store to the backup provider. It takes about eight minutes, and no store can take a card during those eight minutes.',
        'Stay on Northline means you commit to the provider Harlow uses now.',
        'Each button asks for one line saying why. You can press one button, once, at any time. You cannot undo it.',
        'If you press neither before the clock ends, that is recorded as no decision.',
      ],
      teamNote: 'You are playing in a team. The first person on your team to press a button decides for the whole team.' },
    { title: 'Before the clock starts',
      text: [
        'Read the briefing. Then open the two documents: the Northline contract and the ClearPath network summary.',
        'You can open both documents again at any time during play.',
        'Nothing in this simulation is scored.',
      ] },
  ],

  documents: [
    {
      id: 'northline',
      title: 'Northline Fibre contract extract',
      subtitle: 'Master Services Agreement, Harlow Home & Hardware · Extract: Schedules B and C',
      blocks: [
        { heading: 'Schedule B, Service levels', text: 'Availability target 99.9 percent measured monthly per site. Fault response within 1 hour of report. Restoration target 4 hours for faults within the Northline access network. Faults outside the Northline access network are excluded from restoration targets and service credits (see Schedule C).' },
        { heading: 'Schedule C, Third-party network services', text: 'Northline uses the following third parties in delivering the service. Northline remains responsible to the customer for their performance except as stated in Schedule B.' },
        { id: 'c1', text: 'C.1 Brightwell Data Centres — colocation of Northline core routing equipment.' },
        { id: 'c2', text: 'C.2 Meridian Transit Networks — regional backhaul between Northline exchanges in the Tri-County region.', revealHighlight: true },
        { id: 'c3', text: 'C.3 Oakridge Field Services — installation and on-site maintenance of customer premises equipment.' },
      ],
    },
    {
      id: 'clearpath',
      title: 'ClearPath Business network summary',
      subtitle: 'Your backup, built to be different.',
      blocks: [
        { text: "ClearPath Business gives you a connection that's physically separate from your primary provider. Our fixed-wireless link runs from a rooftop antenna at each site to our own tower network, so a cut cable in the street can't take out both." },
        { id: 'coverage', text: 'Coverage: 94 percent of business addresses in the Tri-County region. Failover time: typically under 10 minutes. Name resolution handled through Palisade DNS for fast, reliable lookups.' },
        { id: 'backhaul', text: "Regional traffic carried over Meridian Transit's backhaul to our internet exchange points.", revealHighlight: true },
        { text: 'Support: 24/7 business line, average answer time under 2 minutes.' },
      ],
    },
  ],

  // Fixed order and timing for every student. atSeconds is real seconds after Begin.
  reports: [
    { n: 1,  atSeconds: 0,   source: 'Head office POS desk',   text: 'Card payments timing out at all twelve stores. About one in three is going through after 40 to 60 seconds.' },
    { n: 2,  atSeconds: 45,  source: 'Dana Okafor, flagship store', text: 'Our terminals took a firmware update overnight. First morning on the new version and now this.' },
    { n: 3,  atSeconds: 90,  source: 'Northline status page',  text: 'Investigating reports of degraded service for some business customers in the Tri-County region.' },
    { n: 4,  atSeconds: 135, source: 'Terminal vendor helpdesk', text: "We've had two other calls this morning from customers on the new firmware. We're looking into it." },
    { n: 5,  atSeconds: 180, source: 'Dana Okafor',            text: 'Mr. Reyes has a full cart and has tried his card three times. He\'s asking whether he should come back later.' },
    { n: 6,  atSeconds: 230, source: 'ClearPath status page',  text: 'All systems operational.' },
    { n: 7,  atSeconds: 280, source: 'Terminal vendor helpdesk', text: 'We rolled the firmware back at stores 3 and 7 as a test. No change at either.' },
    { n: 8,  atSeconds: 330, source: 'Store 9 manager',        text: 'Ours are going through more often than an hour ago. Maybe one in two now.' },
    { n: 9,  atSeconds: 380, source: 'Dana Okafor',            text: "The coffee shop next door says their card machine is down too. They're on ClearPath." },
    { n: 10, atSeconds: 430, source: 'Northline status page',  text: "Fault identified outside the Northline network. We're working with our partner on restoration. No estimate yet." },
    { n: 11, atSeconds: 480, source: 'Social media, forwarded by a store', text: 'Photo of utility crews at a street cabinet on Route 4, van marked Meridian Transit.' },
    { n: 12, atSeconds: 540, source: 'Dana Okafor',            text: "Mr. Reyes left his cart and went home. We've got a queue of eleven at the one register taking cash." },
  ],

  switchCompleteMessage: 'Terminals re-registered on ClearPath. Transactions still timing out at about the same rate.',

  reveal: {
    map: {
      nodes: [
        { id: 'stores',    label: 'Harlow Home & Hardware · 12 stores' },
        { id: 'northline', label: 'Northline Fibre (fibre)' },
        { id: 'clearpath', label: 'ClearPath Business (fixed wireless)' },
        { id: 'meridian',  label: 'Meridian Transit · Route 4 exchange', fault: true },
        { id: 'processor', label: 'Card processor' },
      ],
      edges: [
        ['stores', 'northline'], ['stores', 'clearpath'],
        ['northline', 'meridian'], ['clearpath', 'meridian'],
        ['meridian', 'processor'],
      ],
      faultNote: 'Cable damaged by roadworks, 11:02. Restored 12:40.',
    },
    caption: 'Harlow had two contracts and two providers. Both providers bought backhaul from the same company, which appears in both documents and in neither of Harlow\'s contracts.',
    decisionLines: {
      switch: 'You switched to ClearPath at report {n} ({time}). Your reason: {reason}',
      stay:   'You committed to staying on Northline at report {n} ({time}). Your reason: {reason}',
      none:   'You made no decision before the clock ran out.',
    },
    readingLine: { decided: 'Before deciding you opened:', none: 'Before the clock ended you opened:' },
  },

  // The name the lesson turns on. Build gate: must appear in a highlighted line of every
  // document and must never appear in the briefing.
  hiddenDependency: 'Meridian',

  // Instructor console only, shown after the clock ends. Order matters: disagreement before naming.
  debrief: [
    { step: 'Disagreement', prompt: 'Before showing anything: who switched early, and what made you sure? Who committed to holding, and what did you see? Who never decided, and what were you waiting for?' },
    { step: 'Naming', prompt: 'Redundancy means having two of something. Diversity means the second one fails for different reasons than the first. Then concentration risk and blast radius, and the point that the dependency sat outside every contract Harlow signed (Northline Schedule B excludes it by name).' },
    { step: 'Reading', prompt: 'Put up the reading figures. Did the people who opened both documents decide differently? Anyone who found Meridian in both: did you believe it, or did the reports win?' },
    { step: 'The turn', prompt: 'Name a service you depend on. Then name who it depends on. Keep going until you reach a company you had never heard of.' },
  ],

  retiredIds: ['rapid-03-bench'],
};
