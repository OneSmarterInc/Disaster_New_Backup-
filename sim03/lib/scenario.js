// RapidSim 03 scenario and deterministic outcome engine.
// Outcome rules stay server-side. The browser receives only the outcome it has
// already earned, never future thresholds or alternate branches.

const META = {
  "id": "rapid-03-midland",
  "replaces": [],
  "catalogueRevision": "midland-v2-2026-09",
  "title": "Midland Equipment",
  "tagline": "Two years to choose. The third year tells you what those choices bought.",
  "description": "You lead technology at a heating and cooling equipment company. Divide a $9 million annual budget among five areas for two years. Then see how those choices affect the business in a third year, when you can no longer change them.",
  "minutes": 30,
  "detail": {
    "world": "Technology planning at an equipment company",
    "seat": "Technology leader at Midland Equipment",
    "clock": "Three business years",
    "teaches": "Balance daily operations with future needs and understand why technology spending takes time to pay off.",
    "tangle": "The same budget must keep existing systems running and prepare the company for future needs. Spending more in one area leaves less for another.",
    "turn": "You see the later effects of choices that looked reasonable when you made them.",
    "roomIntro": "Four people want different things from the same $9 million budget. Each represents a different business need.",
    "momentsIntro": "",
    "after": "Review your starting view and allocations, then answer two reflection questions. There is no score or ranking.",
    "discussion": "The instructor can compare anonymous budgets and outcomes to discuss the trade-offs.",
    "tryIt": "Try the complete activity before assigning it to students.",
    "sessionShape": "Allow about 30 minutes for play and the rest of a class hour for discussion. Students should read the briefing packet before the session.",
    "catalogueFacts": [
      {
        "label": "Play",
        "value": "Individual or team"
      },
      {
        "label": "Before play",
        "value": "Read the briefing packet"
      },
      {
        "label": "Feedback",
        "value": "Reflection; no score"
      }
    ],
    "atAGlance": [
      {
        "label": "Main task",
        "value": "Two annual budgets"
      },
      {
        "label": "Numbers",
        "value": "Divide $9 million across five areas"
      },
      {
        "label": "Play mode",
        "value": "Individual or team"
      }
    ],
    "cast": [
      {
        "name": "Dale Brenner",
        "role": "Chief Financial Officer",
        "stake": "Wants to control the cost of running existing systems.",
        "line": "Run",
        "shortWant": "Get the Run cost down without breaking the systems Midland still depends on.",
        "quote": "Six million dollars a year keeps the lights on and produces nothing new. Every conversation we have should start with getting that number down."
      },
      {
        "name": "Renata Oyelaran",
        "role": "VP, Service",
        "stake": "Wants dependable service operations.",
        "line": "Uptime",
        "shortWant": "Keep dispatch dependable; every system dollar is competing with trucks and technicians.",
        "quote": "I do not need software. I need eight more technicians. Every dollar you spend on a system is a dollar that did not go to a truck."
      },
      {
        "name": "Tom Vasquez",
        "role": "Chief Executive",
        "stake": "Wants visible progress to show the board.",
        "line": "Features",
        "shortWant": "Have something real to show the board inside eighteen months.",
        "quote": "In eighteen months I have to stand in front of the board and show them something. I do not care what it is. I care that it is real."
      },
      {
        "name": "Sam Achterberg",
        "role": "Field technician, 22 years",
        "stake": "Wants information that helps technicians avoid unnecessary visits.",
        "line": "Connect",
        "shortWant": "Hear the machines before a $290 truck roll has to go find out in person.",
        "quote": "Nineteen percent of our visits find nothing wrong. At $290 a truck roll, I would rather hear the machine before I drive there. Those machines have been telling us they were about to fail for years."
      }
    ],
    "beats": [
      {
        "at": "Year 1",
        "what": "State your starting view and choose your first budget."
      },
      {
        "at": "Year 2",
        "what": "Review what happened and choose the next budget."
      },
      {
        "at": "Year 3",
        "what": "See the later effects and reflect on your choices."
      }
    ],
    "activity": "Read the briefing, write your starting view, and divide the budget for Year 1. Review the results, set the Year 2 budget, and reflect on what happens in Year 3.",
    "suitableFor": "IT strategy, budgeting, and operations management classes.",
    "preparation": "Read the briefing packet before the session.",
    "output": "A starting view, two annual budgets, and two final reflections.",
    "durationNote": "About 30 minutes of play, plus discussion."
  }
};

const LINES = ['run', 'uptime', 'capacity', 'connect', 'features'];
const LABELS = {
  run: 'Run',
  uptime: 'Uptime',
  capacity: 'Capacity',
  connect: 'Connect',
  features: 'Features'
};
const LINE_DESCRIPTIONS = Object.freeze({
  run: 'Keeps the existing systems alive: the 14-year-old ERP, help desk, licenses, and the systems Midland uses today.',
  uptime: 'Backup and redundancy so dispatch survives a bad day.',
  capacity: 'Headroom for growth and for anything that needs to compute.',
  connect: 'Gets data back from units in the field automatically.',
  features: 'Visible new things the business can point at.'
});

// First-draft calibration lives in data rather than engine code. Facilitated
// sessions copy these defaults and may edit their own copy while still in the
// lobby, so thresholds can change between sections without a deploy.
const { DEFAULT_THRESHOLDS, LEGACY_THRESHOLDS, CALIBRATION_ID, OUTCOME_KEYS,
  sanitizeThresholds, validateThresholds, sessionThresholds, standaloneThresholds, publicRules } = require('./calibration.js');

const COPY = Object.freeze({
  year1: {
    strong: 'The school district is six weeks from renewing its service contract and asks Midland for a performance report across its rooftop units: faults, downtime, and service history. With the units connected, Sam can pull the evidence in an afternoon and the report goes out the next day instead of sending trucks to buildings. The district renews early and mentions the capability to two neighboring districts. Sam: “This is what I meant — the machines already knew; we finally stopped making a technician drive out to ask them.”',
    middle: 'The school district is six weeks from renewal and asks for the same performance report. Some unit data comes back, but coverage is patchy, so the service team still has to fill gaps by hand in a business that makes 14,000 visits a year at about $290 every time a truck rolls. The report arrives late and thin, and the district renews grudgingly. Sam: “We wired enough to prove the idea and not enough to keep my people off roofs.”',
    weak: 'The school district is six weeks from renewal and asks Midland to show how its rooftop units actually performed. With no remote path to the machines, two of Sam’s technicians spend a week on roofs pulling histories by hand, and they still cannot assemble a credible report before the deadline. The district renews on price but starts taking competitor calls. Sam: “Nineteen percent of our visits find nothing wrong, and here we are sending people out again because the data still has nowhere to go.”'
  },
  heat: {
    strong: 'July brings ten straight days above 95 degrees and service calls triple. Dispatch is the only thing standing between sixty-two technicians and chaos, and the backup path holds through the surge; the service department closes its best month ever. The trucks stay moving because the system stays up. Renata: “I still want eight more technicians. But if dispatch had gone down this week, eight more trucks would have been eight more people waiting for paper directions.”',
    middle: 'July brings ten straight days above 95 degrees and service calls triple. Dispatch goes down for six hours on the worst day, so the team falls back to paper, duplicate trips and callbacks in a service operation where every truck roll costs about $290. Customers wait, but the department keeps moving. Renata: “Six hours was enough to turn my department into a clipboard. I can argue about software all year; I cannot argue with that day.”',
    weak: 'July brings ten straight days above 95 degrees and service calls triple. Dispatch is down for four days in the hottest week, leaving sixty-two technicians working from phones and paper while repeat visits pile up and two hospital accounts go public with their anger. The system that was supposed to tell the trucks where to go becomes the failure inside the failure. Renata: “I asked for eight more trucks. Four days like this and I would not have known where to send them.”'
  },
  competitor: {
    strong: 'The Carrolton pilot from the trade press has become a national flat-rate coverage offer, and Midland customers start asking when they can buy the same thing. Flat-rate service only works if Midland can see which units are healthy and price the risk, and the connected history is already there when the question arrives. The alternative would have been starting an eighteen-month connectivity build after the market moved; this portfolio does not have to wait for that clock. Tom: “This is something real. I can put it in front of the board before my eighteen months are up.”',
    middle: 'The Carrolton pilot from Georgia and Tennessee has become a national flat-rate coverage offer, and Midland customers immediately ask for an answer. Midland has enough connected data to price a thirty-unit pilot, but not enough coverage to make the offer broadly without guessing at the risk. Finishing the missing connection now is an eighteen-month job, which is exactly Tom’s board window. Tom: “Thirty units is a pilot. I have a board in eighteen months. I need to know whether this becomes a business before I walk into that room.”',
    weak: 'A national rival turns Carrolton’s flat-rate pilot into a real market offer, and Midland customers start asking why they cannot have it too. Midland cannot price the risk because it still cannot see enough of the four thousand units in the field, and building that visibility now takes about eighteen months; the annual cap means money cannot buy the lost lead time back in one move. Tom: “That is my board window. If the build takes eighteen months from today, I have nothing real to show when I walk into that room.”'
  },
  year3: {
    strong: 'In Year 3 the CEO asks whether Midland can predict failures before a customer calls and sell that capability across the installed base. The company now has years of field history and enough capacity to run the model continuously, so patterns across thousands of units become service calls Midland can prevent instead of emergencies it reacts to. Predictive uptime becomes something Midland can actually sell, not a demo. Tom: “This is real. I can put a service in front of the board instead of another promise.” Sam: “We used to spend $290 to send a truck to hear what the machine could have told us yesterday. Now it tells us before the customer calls.”',
    data_no_room: 'In Year 3 the CEO asks whether Midland can predict failures before a customer calls, and the answer is painful because you have three years of fault history and nowhere to put it. The data exists, but the model runs overnight on borrowed capacity and finishes only some mornings; a conference-room demo works while a service for roughly 4,000 units does not. The CEO asks why it cannot go to every customer by spring, and the honest answer is that the harder half was built while the cheap half was starved. Tom: “A demo that works some mornings is not a launch plan I can take to the board.” Sam: “You finally listened to the machines and then built nowhere for the answer to live. Now we can see the service we still cannot deliver.”',
    pilot: 'In Year 3 the CEO asks for failure prediction across Midland’s installed base. There is enough connected history to make the model real on the newest units, but not enough coverage to promise the same service across roughly 4,000 machines, so the result is a pilot rather than a business. It catches some failures early and proves the idea without yet changing what Midland can sell at scale. Tom: “I can show the board a pilot. I still cannot show them a business.” Sam: “It is real on the units we can hear. Four thousand units is a business; a corner of the fleet is still a demonstration.”',
    weak: 'In Year 3 the CEO asks for AI failure prediction, and the model itself is not the problem. Midland never accumulated enough usable field history, so the failure was effectively decided back in Year 1 when connecting controllers looked like plumbing and something else looked more urgent; three years later there is no history to reconstruct. Technicians are still making 14,000 service visits a year and 19% still find nothing wrong because the machines cannot tell Midland what they know remotely. Tom: “I asked for something real. There is still nothing here that customers can buy at scale.” Sam: “There has never been anywhere to put what they say. Three years later, that is still true.”'
  }
});

const YEAR2_INTRO = Object.freeze({
  strong: 'A year has passed. The district renewed early, and Sam’s report is now the example people point to when they argue that the machines can do more than Midland has been asking of them. Dale is back at the table looking at the Run number, and the same $9 million is available again.',
  middle: 'A year has passed. The district renewed, grudgingly, after Midland patched together a late report and the service team did work the architecture could not do for them. Dale is back at the table looking at the Run number, and the same $9 million is available again.',
  weak: 'A year has passed. The district renewed on price but has started taking competitor calls, and Sam’s team remembers the week spent on roofs because Midland could not pull its own machine history. Dale is back at the table looking at the Run number, and the same $9 million is available again.'
});

const BUYERS = Object.freeze({
  carrolton: {
    id: 'carrolton',
    name: 'Carrolton Systems',
    description: 'Regional competitor',
    copy: 'We are buying the customers and the service contracts. Your systems are overhead we plan to retire in the first year.',
    roomLink: 'No one in the room was arguing for this outcome. Carrolton is buying Midland’s customers and contracts, not the architecture.'
  },
  ridge_hollow: {
    id: 'ridge_hollow',
    name: 'Ridge Hollow Partners',
    description: 'Private equity',
    roomLink: 'This is Dale’s argument from the room, judged by a buyer: keep the cost base lean and do not carry spending that has to be defended forever.',
    high: 'Likes what it sees: a lean operation with no expensive habits. After closing, it plans to keep capital spending tight, harvest cash for four years, and sell; nothing in your portfolio gets in the way of that plan.',
    qualified: 'Interested, with reservations about how much of the spending it would have to keep funding.',
    low: 'Sees a cost base it would have to cut hard, and it has done this often enough to know how that goes.'
  },
  corven: {
    id: 'corven',
    name: 'Corven Building Systems',
    description: 'Platform acquirer',
    roomLink: 'This is Sam’s argument from the room, judged by a buyer: the field data and customer relationships are valuable because they cannot be recreated quickly.',
    high: 'This is the only reason it is at the table. Three years of fault history from four thousand units in buildings it does not yet serve. It is not buying an HVAC dealer, it is buying what those machines have been saying.',
    qualified: 'Sees the beginning of something and would want to finish it themselves, which changes the price and who runs the company afterward.',
    low: 'It came for the fault history from four thousand units and cannot find enough connected history to buy. Without that asset, Corven sees an HVAC dealer rather than the platform Sam kept arguing Midland could become.'
  }
});
const BUYER_CLOSING = 'Three buyers, one company, three different answers. Which one showed up was never yours to control. What you controlled was whether there was anything worth paying for.';

function integer(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function validateAllocation(a, thresholds = DEFAULT_THRESHOLDS) {
  const t = sanitizeThresholds(thresholds);
  if (!a || typeof a !== 'object') return { ok: false, error: 'allocation_required' };
  const out = {};
  for (const line of LINES) {
    const n = integer(a[line]);
    if (n === null || n < 0) return { ok: false, error: `invalid_${line}` };
    out[line] = n;
  }
  const total = LINES.reduce((s, k) => s + out[k], 0);
  if (total !== t.budgetPerYear) return { ok: false, error: `budget_must_equal_${t.budgetPerYear}`, total };
  if (out.run < t.runFloor) return { ok: false, error: `run_minimum_${t.runFloor}` };
  for (const k of ['uptime', 'capacity', 'connect', 'features']) {
    if (out[k] > t.perLineCap) return { ok: false, error: `${k}_maximum_${t.perLineCap}` };
  }
  return { ok: true, allocation: out };
}

function cumulative(y1, y2) {
  const out = {};
  for (const k of LINES) out[k] = (y1[k] || 0) + (y2[k] || 0);
  return out;
}

function year1AllocationNotes(y1, t, band) {
  const connect = Number(y1.connect || 0), run = Number(y1.run || 0);
  let connectNote;
  if (band === 'strong') {
    const margin = connect - t.year1ConnectStrong;
    connectNote = `Year 1 Connect was $${connect}M. ${margin === 0 ? 'That put Midland exactly on the line that made the district report a remote-data job instead of a field exercise.' : `That was $${margin}M above the level that made the district report a remote-data job instead of a field exercise.`}`;
  } else if (band === 'middle') {
    connectNote = `Year 1 Connect was $${connect}M. $${Math.max(1, t.year1ConnectStrong - connect)}M more would have moved the district report from patchwork to a clean remote pull.`;
  } else {
    connectNote = `Year 1 Connect was $0M. With no remote path to the units, the district report became a week on roofs; $${t.year1ConnectStrong}M in Connect would have put Midland on the strong-report line.`;
  }
  const baseline = 6.1;
  const delta = baseline - run;
  const daleNote = delta > 0
    ? `Dale started from last year’s $6.1M Run bill. Holding Run at $${run}M freed $${delta.toFixed(1)}M versus last year for the other four lines.`
    : `Dale started from last year’s $6.1M Run bill. At $${run}M, Run used at least as much of the fixed $${t.budgetPerYear}M as last year, leaving less room for new capability.`;
  return [connectNote, daleNote];
}

function heatAllocationNotes(c, t, band) {
  const x = Number(c.uptime || 0), strong = Number(t.heatUptimeStrong), middle = Number(t.heatUptimeMiddle);
  if (band === 'strong') {
    const extra = x - strong;
    return [`Cumulative Uptime was $${x}M. Dispatch needed $${strong}M to hold through the heat wave; ${extra > 0 ? `$${extra}M sat above that line.` : 'you were exactly on that line.'}`];
  }
  if (band === 'middle') {
    return [`Cumulative Uptime was $${x}M. $${strong - x}M more would have kept dispatch fully online; $${x - middle + 1}M less would have produced the four-day outage.`];
  }
  return [`Cumulative Uptime was $${x}M. $${Math.max(0, middle - x)}M more would have avoided the four-day outage, and $${Math.max(0, strong - x)}M more would have kept dispatch fully online.`];
}

function evaluateYear1(y1, thresholds) {
  const t = sanitizeThresholds(thresholds);
  const c = y1.connect;
  if (c >= t.year1ConnectStrong) {
    return { band: 'strong', title: 'The school district asks for a performance report', narrative: COPY.year1.strong, allocationNotes: year1AllocationNotes(y1, t, 'strong'), year2Intro: YEAR2_INTRO.strong.replace('$9 million', `$${t.budgetPerYear} million`) };
  }
  if (c > 0) {
    return { band: 'middle', title: 'The school district asks for a performance report', narrative: COPY.year1.middle, allocationNotes: year1AllocationNotes(y1, t, 'middle'), year2Intro: YEAR2_INTRO.middle.replace('$9 million', `$${t.budgetPerYear} million`) };
  }
  return { band: 'weak', title: 'The school district asks for a performance report', narrative: COPY.year1.weak, allocationNotes: year1AllocationNotes(y1, t, 'weak'), year2Intro: YEAR2_INTRO.weak.replace('$9 million', `$${t.budgetPerYear} million`) };
}

function evaluateYear2(y1, y2, thresholds) {
  const t = sanitizeThresholds(thresholds);
  const c = cumulative(y1, y2);
  let heat;
  if (c.uptime >= t.heatUptimeStrong) heat = { band: 'strong', narrative: COPY.heat.strong, allocationNotes: heatAllocationNotes(c, t, 'strong') };
  else if (c.uptime >= t.heatUptimeMiddle) heat = { band: 'middle', narrative: COPY.heat.middle, allocationNotes: heatAllocationNotes(c, t, 'middle') };
  else heat = { band: 'weak', narrative: COPY.heat.weak, allocationNotes: heatAllocationNotes(c, t, 'weak') };

  let competitor;
  if (c.connect >= t.competitorConnectStrong) competitor = { band: 'strong', narrative: COPY.competitor.strong };
  else if (c.connect >= t.competitorConnectPilotMin && c.connect <= t.competitorConnectPilotMax) {
    competitor = { band: 'middle', narrative: COPY.competitor.middle };
  } else competitor = { band: 'weak', narrative: COPY.competitor.weak };

  return {
    cumulative: c,
    heat: { title: 'The heat wave', ...heat },
    competitor: { title: "The competitor's flat-rate plan", ...competitor }
  };
}

function evaluateYear3(y1, y2, thresholds) {
  const t = sanitizeThresholds(thresholds);
  const c = cumulative(y1, y2);

  if (c.connect >= t.year3ConnectStrong && c.capacity >= t.year3CapacityStrong) {
    return { band: 'strong', title: 'The CEO wants AI failure prediction', narrative: COPY.year3.strong, cumulative: c };
  }
  if (c.connect >= t.year3ConnectStrong && c.capacity < t.year3CapacityStrong) {
    return { band: 'data_no_room', title: 'The CEO wants AI failure prediction', narrative: COPY.year3.data_no_room, cumulative: c };
  }
  if (c.connect >= t.year3ConnectPilotMin && c.connect <= t.year3ConnectPilotMax) {
    return { band: 'pilot', title: 'The CEO wants AI failure prediction', narrative: COPY.year3.pilot, cumulative: c };
  }
  return { band: 'weak', title: 'The CEO wants AI failure prediction', narrative: COPY.year3.weak, cumulative: c };
}

function evaluateBuyers(y1, y2) {
  const c = cumulative(y1, y2);
  const ridgeSpend = c.run + c.features;
  const ridgeInterest = ridgeSpend <= 8 ? 'high' : ridgeSpend >= 12 ? 'low' : 'qualified';
  const corvenInterest = c.connect >= 5 ? 'high' : c.connect >= 3 ? 'qualified' : 'low';
  return {
    carrolton: {
      id: BUYERS.carrolton.id,
      name: BUYERS.carrolton.name,
      description: BUYERS.carrolton.description,
      interest: 'qualified',
      reason: BUYERS.carrolton.copy,
      roomLink: BUYERS.carrolton.roomLink
    },
    ridge_hollow: {
      id: BUYERS.ridge_hollow.id,
      name: BUYERS.ridge_hollow.name,
      description: BUYERS.ridge_hollow.description,
      interest: ridgeInterest,
      reason: BUYERS.ridge_hollow[ridgeInterest],
      roomLink: BUYERS.ridge_hollow.roomLink
    },
    corven: {
      id: BUYERS.corven.id,
      name: BUYERS.corven.name,
      description: BUYERS.corven.description,
      interest: corvenInterest,
      reason: BUYERS.corven[corvenInterest],
      roomLink: BUYERS.corven.roomLink
    },
    closing: BUYER_CLOSING
  };
}

function evaluateAll(y1, y2, thresholds) {
  return {
    year1: evaluateYear1(y1, thresholds),
    year2: evaluateYear2(y1, y2, thresholds),
    year3: evaluateYear3(y1, y2, thresholds),
    buyers: evaluateBuyers(y1, y2)
  };
}

function publicConfig(thresholds = DEFAULT_THRESHOLDS) {
  const rules = publicRules(thresholds);
  return {
    calibrationId: CALIBRATION_ID,
    meta: {
      id: META.id,
      title: META.title,
      tagline: META.tagline,
      description: META.description,
      minutes: META.minutes
    },
    lines: LINES.map(id => {
      const cast = META.detail.cast.find(x => x.line === LABELS[id]);
      return {
        id,
        label: LABELS[id],
        description: LINE_DESCRIPTIONS[id],
        advocate: cast ? { name: cast.name, want: cast.quote, shortWant: cast.shortWant || cast.stake } : null
      };
    }),
    room: {
      intro: META.detail.roomIntro.replace('nine million dollars', `${rules.annualBudget} million dollars`),
      cast: META.detail.cast.map(({ name, role, line, stake, quote }) => ({ name, role, line, stake, quote }))
    },
    ...rules,
    briefing: {
      title: 'Midland Equipment — Briefing & exhibits',
      note: 'In-app briefing packet. It is collapsed during play so you can reopen facts without rereading the whole setup.',
      intro: [
        'Read this before the session. It is the briefing built into the simulation.',
        `You are about to take over technology decisions at Midland Equipment. In about thirty minutes you will make two annual $${rules.annualBudget} million allocations, then see what the third year reveals after the decision window has closed. The simulation can be played individually or as a team. This briefing should take about six minutes.`
      ],
      company: [
        'Midland sells and services commercial HVAC systems — the large rooftop units that heat and cool schools, hospitals, and office buildings. The company operates in Ohio, Indiana, and Michigan, and has roughly 4,000 of its units installed in customers’ buildings. Revenue comes from two places: selling equipment, and a service department that bills by the visit. Sixty-two field technicians drive to those buildings all day, every day.',
        'The company is 41 years old, profitable, and nobody thinks it is in trouble.'
      ],
      exhibits: [
        {
          title: 'Exhibit 1 — Where the revenue comes from',
          columns: ['', 'Revenue', 'Gross margin', 'Gross profit'],
          rows: [
            ['Equipment sales', '$187M (78%)', '9%', '$16.8M'],
            ['Service', '$53M (22%)', '34%', '$18.0M']
          ],
          note: 'Read those last two numbers again before you move on.'
        },
        {
          title: 'Exhibit 2 — Where last year’s technology money went',
          body: ['The technology budget is $9 million a year and has not changed in four years.'],
          columns: ['Line', 'Last year'],
          rows: [
            ['Keeping current systems running (the 14-year-old ERP, help desk, licenses)', '$6.1M'],
            ['Backup and redundancy', '$0.7M'],
            ['Extra capacity', '$0.4M'],
            ['Getting data back from units in the field', '$0.2M'],
            ['New features and visible projects', '$1.6M']
          ]
        },
        {
          title: 'Exhibit 3 — The service department last year',
          columns: ['', ''],
          rows: [
            ['Service visits', '14,000'],
            ['Visits where the technician found nothing wrong', '19%'],
            ['Repeat visits to the same unit within 30 days', '11%'],
            ['Average cost of sending a truck', '$290']
          ],
          note: 'That is roughly 4,200 trips that arguably should not have happened, at something close to $1.2 million.'
        },
        {
          title: 'Exhibit 4 — System outages, last three years',
          body: ['Eleven unplanned outages, 214 total hours down. Sixty-one percent of those hours fell between June and August. The dispatch system is what technicians use to know where to go.']
        },
        {
          title: 'Exhibit 5 — Customers lost last year',
          body: ['Two accounts, worth $2.1 million a year in service revenue between them. Both gave the same reason on the way out, and it was not price. It was how long they waited for someone to show up.']
        },
        {
          title: 'Exhibit 6 — What the machines already know',
          body: [
            'Every unit Midland has installed since 2016 — about 3,100 of the 4,000 in the field — has a controller that records run hours, temperatures, and fault codes. The data exists today. The only way anyone at Midland can see it is for a technician to drive out and plug a laptop into the unit.',
            'Trade press, March: Carrolton Systems has been piloting a flat-rate coverage program for commercial customers in Georgia and Tennessee.'
          ]
        }
      ],
      people: META.detail.cast.map(({ name, role, quote }) => ({ name, role, quote })),
      peopleNote: 'All four of them are reasonable. None of them is going to tell you the answer, and if you ask any of them what you should do, you will get a confident reply shaped by the part of the company they are responsible for.',
      whatHappens: [
        `You make two annual $${rules.annualBudget} million allocations across five lines. Year 1 reveals the first consequence; after the second allocation, two Year 2 events resolve; Year 3 is then revealed with no further allocation.`,
        'In individual mode you commit your own choices. In team mode the group works from one shared run. In either mode, you cannot save money or borrow from the next year.',
        'Come with a view about what this company should become. You will be asked for it early, in one sentence.'
      ]
    },
    coldOpen: [
      'Midland sells and services the big rooftop heating and cooling units on schools, hospitals, and office buildings across Ohio, Indiana, and Michigan. About four thousand of them are out there right now. Sixty-two technicians drive to those buildings all day, every day.',
      'The main office system is fourteen years old. Every unit installed since 2016 records its own run hours, temperatures, and faults. Nobody has ever looked at that data, because the only way to see it is to drive out and plug in a laptop.',
      'Selling equipment brings in most of the revenue. Servicing it brings in most of the profit.',
      'You are about to take over technology decisions here.'
    ],
    position: rules.position,
    viewPrompt: 'Midland should become a company that can ___ for customers by ___.',
    viewDisclosure: 'Your instructor can see this sentence in the instructor view. It is not scored, and it will come back to you at the close.',
    reflectionPrompts: [
      'Which of Dale, Renata, Tom, or Sam did you overrule most?',
      'If you could change one Year 1 million after seeing Year 3, where would it move and why?'
    ],
    reflectionFollowups: [
      'After seeing Year 3, would you make the same call? Why or why not?',
      ''
    ],
    reflectionDisclosure: 'Your instructor can see these responses and may use them in the class debrief. They are not scored.',
    buyers: {
      authored: true,
      title: 'Three buyers, one company',
      note: 'Each buyer gives a verdict and an interest level. There is no total, ranking or winner.',
      closing: BUYER_CLOSING
    }
  };
}

module.exports = {
  META, LINES, LABELS, DEFAULT_THRESHOLDS, LEGACY_THRESHOLDS, CALIBRATION_ID, OUTCOME_KEYS,
  sanitizeThresholds, validateThresholds, sessionThresholds, standaloneThresholds, publicRules,
  validateAllocation, cumulative, evaluateYear1, evaluateYear2, evaluateYear3,
  evaluateBuyers, evaluateAll, publicConfig
};
