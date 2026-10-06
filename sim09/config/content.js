// RapidSim 09 — Where Does the Money Land?
// Every word a student or instructor sees lives here, not in code. Every figure
// carries its source. Figures marked basis: 'estimate' are reconstructed and say
// how; everything else is read from a filing or a dated public record.
//
// Company keys:  RA reverse-auction firm · IC industry-community operator
//                LS lab-supplies marketplace · MS marketplace-software vendor
//                PS procurement-software vendor
// Real names appear only in REVEAL, never before the instructor releases a stage.

const META = {
  "id": "rapid-09-money-land",
  "replaces": [],
  "catalogueRevision": "money-land-v2-2026-09",
  "title": "Where Does the Money Land?",
  "tagline": "The direction is obvious. Put your fund behind the destination.",
  "description": "It is June 2000 and you have $1 million to invest. Read a forecast about businesses buying online, write down what you expect to change and who you think will earn money, then divide the fund among five companies.",
  "minutes": 20,
  "detail": {
    "world": "Investing in online business trade in 2000",
    "seat": "Investment partner with a $1 million fund",
    "clock": "About twenty minutes, followed by three historical reveals",
    "teaches": "Separate growth in a technology from success for an individual business, and connect investment choices to a clear reason.",
    "tangle": "Several businesses may benefit from the same trend in different ways. Your investment has to show which explanation you believe.",
    "turn": "Your original statements stay alongside your investment choices, so you can compare both with later results.",
    "after": "Review your statements, allocation, and its value at each reveal stage. There is no ranking.",
    "discussion": "Compare concentrated and spread-out investments, and check whether each allocation matches its stated reason.",
    "tryIt": "Try the complete activity before assigning it to students.",
    "sessionShape": "Allow about 20 minutes for the briefing, written statements, and allocation. The instructor releases the historical results in three stages and leads the discussion. Team play is recommended.",
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
        "value": "Reflection; no ranking"
      }
    ],
    "atAGlance": [
      {
        "label": "Main task",
        "value": "One final investment allocation"
      },
      {
        "label": "Numbers",
        "value": "Divide $1 million among five companies"
      },
      {
        "label": "Play mode",
        "value": "Team (recommended) or individual"
      }
    ],
    "activity": "Read the forecast and company cards. Write separate statements about the market trend and who will benefit. Then divide the fund among five companies and review later events.",
    "suitableFor": "Technology strategy, entrepreneurship, and investment decision classes.",
    "preparation": "No advance reading. The forecast and company cards are provided.",
    "output": "Two written statements and one final allocation of a $1 million fund.",
    "beats": [
      {
        "at": "Read",
        "what": "Study the forecast and the five company cards."
      },
      {
        "at": "Explain and invest",
        "what": "Write two statements, then commit the fund."
      },
      {
        "at": "Reflect",
        "what": "Review later events and compare them with your original reasons."
      }
    ],
    "durationNote": "About 20 minutes before the historical reveals and discussion.",
    "momentsIntro": ""
  }
};

const CLOCK = {
  briefingSeconds: 300,  // briefing, forecast and company cards
  wallSeconds: 360,      // the two statements
  allocateSeconds: 480   // the fund; statements are locked by now
};

const BRIEFING = {
  heading: "It's late June 2000. You have a fund to place.",
  individual: [
    "You're a partner at a fund with $1,000,000 to invest. Everyone you meet this year says the same thing: purchasing between businesses is moving onto the internet, and marketplaces will sit in the middle of it. The forecast below is the one on every desk.",
    "Before any money moves, you write two statements. The first says where the forecast thinks things are heading: its direction. The second says who it thinks will be paid for it: its destination. You can bet only on the destination. Take the direction as given (it isn't what you're betting on).",
    "Then you place the fund across five companies chasing this forecast, in steps of $50,000. You may put everything on one, spread it, or hold cash. Holding cash is allowed only if your destination statement names someone other than the five as the one who gets paid.",
    "Your allocation is final. Once allocation opens, your two statements lock. Nothing is scored and nobody else sees your choices. The room only ever sees totals, and your instructor decides when history arrives."
  ],
  teamExtra: 'Your team writes one pair of statements and makes one allocation, on one screen. Argue it out loud. Whoever holds the screen submits for the team.'
};

// The forecast, as quoted in one of these companies' own annual report.
// Forrester and IDC originally published these in 2000.
const FORECAST = {
  heading: 'The forecast',
  source: 'Forrester Research and International Data Corporation, 2000, as quoted in a marketplace company\'s annual report',
  steps: [
    { figure: '$2.7 trillion', text: 'Business-to-business trade over the internet by 2004, according to Forrester.' },
    { figure: '53%', text: 'The share of that trade Forrester expects to flow through online marketplaces.' },
    { figure: '$1.4 trillion', text: 'What that comes to: the trade passing through marketplaces in 2004.' },
    { figure: '$1.7 billion to almost $9 billion', text: 'IDC\'s forecast for spending on internet purchasing software, from 2000 to 2004.' }
  ],
  note: 'Every step follows from the one before. Nobody in 2000 thought these numbers were foolish.'
};

// The wall. Direction is free text. Destination is a structured pick plus a reason.
// Cash is allowed only when the pick is one where cashAllowed is true.
const WALL = {
  heading: 'Two statements, before any money moves',
  direction: {
    label: 'Direction',
    prompt: 'What does the forecast say is going to happen? Write it in your own words.',
    minChars: 40
  },
  destination: {
    label: 'Destination',
    prompt: 'Who does the forecast say will be paid for it, and who do you think will actually be paid?',
    pickLabel: 'Who captures the value?',
    options: [
      { key: 'marketplaces', text: 'The companies that run the marketplaces', cashAllowed: false },
      { key: 'software', text: 'The companies that sell the software marketplaces run on', cashAllowed: false },
      { key: 'buyers', text: 'The businesses doing the buying', cashAllowed: true },
      { key: 'sellers', text: 'The businesses doing the selling', cashAllowed: true },
      { key: 'incumbents', text: 'The established business-software firms', cashAllowed: true },
      { key: 'nobody', text: 'Nobody in particular: competition hands it to customers', cashAllowed: true }
    ],
    reasonLabel: 'Why?',
    minChars: 40
  },
  lockNotice: 'Your statements lock when allocation opens. You will see them again when history arrives.'
};

const FUND = {
  total: 1000000,
  step: 50000,
  cashLabel: 'Hold as cash',
  cashRefused: 'Cash is only allowed when your destination names someone other than the five. Yours names {pick}.',
  unplacedRefused: 'Every dollar has to go somewhere: a company or cash. {left} is still unplaced.'
};

// Stage values are what one June 2000 share was worth to a holder at each stage,
// following splits, reverse splits, mergers and cash-outs. Entry is the price paid.
// Display rule (engine): 0 shows as $0; above 0 and under $10,000 shows as
// "under $10K"; anything else rounds to the nearest $10,000.
const COMPANIES = [
  {
    key: 'RA', category: 'marketplaces',
    descriptor: 'The reverse-auction firm',
    does: 'Runs online auctions where suppliers bid prices down for industrial buyers: castings, circuit boards, packaging, coal. Its own staff research suppliers, write each request for quotation and run the auction live.',
    model: 'Mostly fixed monthly fees from each buyer, plus bonuses when the buyer hits savings or volume targets. It never takes title to the goods.',
    numbers: [
      '1999 revenue: $20.9 million, up from $7.8 million in 1998',
      'Staff: 376 at the end of 1999',
      'Auctions run in 1999 covered $2.7 billion of purchasing',
      'Two customers made up 34% of 1999 revenue'
    ],
    position: 'Listed in December 1999. The shares were offered at $48 and closed the first day at $280. In January a major automaker gave notice it was ending its contract, and the stock fell hard. This quarter it has traded between $36.75 and $135.',
    funding: 'The public offering raised $182 million.',
    entry: { price: 85.88, basis: 'estimate', note: 'Midpoint of the April to June 2000 bid range ($36.75 to $135.00); no single-day close was available.' },
    stages: {
      2002: { perShare: 16.545, basis: 'estimate', note: 'Midpoint of the April to June 2002 bid range, $9.71 to $23.38.' },
      2004: { perShare: 6.52, basis: 'filing', note: 'Close on June 30, 2004, the day before its merger completed.' },
      2010: { perShare: 6.81875, basis: 'filing', note: '0.375 shares of the procurement-software vendor plus $2.00 cash per share, valued at that company\'s March 31, 2010 close of $12.85.' }
    },
    sources: ['Company 10-K for 2000 (revenue, staff, volume, concentration, bid ranges)', 'Company 10-K for 2002 (2002 bid ranges)', 'Merger terms in the acquirer\'s 2004 filings']
  },
  {
    key: 'IC', category: 'marketplaces',
    descriptor: 'The industry-community operator',
    does: 'Runs more than fifty online trade communities, one per industry, from water treatment to semiconductors. Each carries news, directories and product listings, and it has begun adding places to actually buy and sell. Last December it bought an exchange for electronic components.',
    model: 'Advertising and sponsorship from suppliers who want to reach each community, plus fees on trade as transactions grow.',
    numbers: [
      '1999 revenue: $18.4 million, with a net loss of $53.5 million',
      'January to March 2000 revenue: $27.5 million, about half of it from the components exchange',
      'Communities: more than fifty',
      'Market value: $10.9 billion on March 10, 2000; $3.9 billion by May 4',
      'In January a large software company invested $100 million'
    ],
    position: 'The best-known name in business-to-business trade online. This quarter its shares have traded between $28.00 and $59.75, down from a high of $138.88 in March.',
    funding: 'Public since February 1999. Several acquisitions paid for in stock.',
    entry: { price: 43.875, basis: 'estimate', note: 'Midpoint of the April to June 2000 closing range ($28.00 to $59.75).' },
    stages: {
      2002: { perShare: 0.45, basis: 'estimate', note: 'Midpoint of the April to June 2002 closing range, $1.60 to $7.40, divided by ten for the July 2002 reverse split.' },
      2004: { perShare: 0.156, basis: 'filing', note: 'Close of $1.56 on June 30, 2004, divided by ten for the 2002 reverse split.' },
      2010: { perShare: 0.03657, basis: 'filing', note: 'Bought in January 2008 for $2.56 a share, after reverse splits of one for ten (2002) and one for seven (2006). Held as cash since.' }
    },
    sources: ['Company 10-Q for March 2000 (first-quarter revenue)', 'Company 1999 annual results (revenue, loss)', 'Company 10-K for 2000 (2000 ranges, splits)', 'Company 10-K for 2002 (2002 ranges)', 'Company 10-K for 2004 (June 30, 2004 close)', 'Merger filings, 2007 to 2008']
  },
  {
    key: 'LS', category: 'marketplaces',
    descriptor: 'The lab-supplies marketplace',
    does: 'An online catalogue where scientists at drug and biotech companies order research chemicals, enzymes and lab equipment from hundreds of suppliers in one place. In February it bought a marketplace for specialty medical products and is setting up marketplaces with partners in food service, fluid processing and hospital supplies.',
    model: 'It buys from the supplier and resells to the scientist, so every sale counts as its revenue. What it keeps is the gap between the two prices.',
    numbers: [
      '1999 revenue: $30.8 million',
      '1999 gross profit on that revenue: $1.5 million',
      'In 1998, its first year of trading, sales were $29,000'
    ],
    position: 'Its shares peaked at $243.50 in February. This quarter they have traded between $14.00 and $59.50.',
    funding: '$45 million from venture investors, $117 million from its July 1999 public offering, and $242.5 million of convertible notes sold in April 2000.',
    entry: { price: 36.75, basis: 'estimate', note: 'Midpoint of the April to June 2000 sale range ($14.00 to $59.50).' },
    stages: {
      2002: { perShare: 0.2, basis: 'estimate', note: 'Shares traded at 39 cents in June 2001 and fell further; this assumes about 20 cents by mid-2002. Any value under $3.67 shows the same "under $10K".' },
      2004: { perShare: 0.05, basis: 'estimate', note: 'A small software company by then, trading for pennies. Shows as "under $10K" at any price under $3.67.' },
      2010: { perShare: 0, basis: 'filing', note: 'Filed for bankruptcy in January 2011; its assets were sold. Treated as nothing left for holders.' }
    },
    sources: ['Company 10-K for 1999 and 2000 (revenue, gross profit, funding, ranges)', 'Company 10-K for 2002 (renaming, restructuring)', 'Bankruptcy and asset sale, 2011']
  },
  {
    key: 'MS', category: 'software',
    descriptor: 'The marketplace-software vendor',
    does: 'Sells the software that marketplaces are built on, and the services to set them up. It links the marketplaces it powers into one global network, and it is building a purchasing exchange with one of the largest carmakers.',
    model: 'Software licences, implementation services, and a share of the fees on trade that passes through the marketplaces it powers.',
    numbers: [
      '1999 revenue: $33.6 million, up from $2.6 million in 1998',
      'Staff: 594 at the end of 1999',
      'Net loss in 1999: $63.3 million'
    ],
    position: 'Its shares have traded between $33.00 and $70.00 this quarter, down from $135.63 in March.',
    funding: 'Public since July 1999. Large acquisitions paid for in stock.',
    entry: { price: 51.5, basis: 'estimate', note: 'Midpoint of the April to June 2000 closing range ($33.00 to $70.00).' },
    stages: {
      2002: { perShare: 0.33, basis: 'estimate', note: 'Built from the $86.9 million non-affiliate market value the company reported for June 30, 2002, and its share count after the 2002 reverse split. Shows as "under $10K" at any value under $0.52.' },
      2004: { perShare: 0.05, basis: 'estimate', note: 'Weeks from bankruptcy and nearly out of cash. Shows as "under $10K" at any price under $0.52.' },
      2010: { perShare: 0, basis: 'filing', note: 'Filed for bankruptcy in October 2004. Patents were auctioned for $15.5 million and the rest sold; nothing reached shareholders.' }
    },
    sources: ['Company 10-K for 2000 (1999 revenue, staff, losses, 2000 ranges)', 'Company 10-K for 2002 and 2003 (June 2002 market value, share count)', 'Bankruptcy and patent auction reports, 2004']
  },
  {
    key: 'PS', category: 'software',
    descriptor: 'The procurement-software vendor',
    does: 'Sells software that lets a large company\'s employees buy office supplies, computers and services from approved suppliers through one system, with approvals and spending limits built in. It also runs a network connecting those buyers to their suppliers.',
    model: 'Software licences and maintenance, plus fees for using its supplier network.',
    numbers: [
      'Revenue for the year to September 1999: $45 million, up from $8 million a year earlier',
      'Public since June 1999'
    ],
    position: 'The closest thing to a winner the sector has. Its shares closed at $92.19 on June 27, and have traded between $50.00 and $105.38 this quarter, down from $165.50 in March.',
    funding: 'Public since June 1999. Several acquisitions paid for in stock.',
    entry: { price: 92.19, basis: 'record', note: 'Close on June 27, 2000, as reported that day.' },
    stages: {
      2002: { perShare: 3.37, basis: 'estimate', note: 'Midpoint of the April to June 2002 sale range, $2.00 to $4.74.' },
      2004: { perShare: 2.00889, basis: 'estimate', note: 'Implied by the reverse-auction firm\'s June 30, 2004 close and the merger terms (2.25 shares plus $2.00 cash).' },
      2010: { perShare: 2.14167, basis: 'filing', note: 'Close of $12.85 on March 31, 2010, divided by six for the July 2004 reverse split.' }
    },
    sources: ['Company 10-K for 2000 and 2002 (price ranges, splits)', 'Company 10-K for 2010 (March 31, 2010 close)', 'Revenue history as reported by the company']
  }
];

// Staged reveal. The instructor releases one stage at a time to the whole room.
// Each stage shows the student's own two statements first, then this.
const REVEAL = {
  yourStatements: 'What you wrote in June 2000',
  fundHeading: 'Your fund',
  stages: [
    {
      year: 2002,
      heading: 'Two years later',
      direction: 'Businesses kept moving purchasing online. Online auctions for industrial parts became a normal tool in purchasing departments.',
      destination: 'The large buyers mostly did not join independent marketplaces. They built their own, alone or with rivals in their industry, and hired software vendors to run them. The marketplaces that sat in the middle lost their reason to exist.',
      companies: {
        RA: 'Still growing and close to breaking even. Its revenue kept rising, and it is the strongest company of the five. The price has fallen far below what you paid.',
        IC: 'Sold its components exchange, closed or sold its fifty-plus communities, and turned itself into a small supply-chain software company.',
        LS: 'Shut its lab-supplies and medical marketplaces in December 2000 and laid off 235 people. Customers went back to the big lab-supply distributors.',
        MS: 'Revenue collapsed as the planned exchanges stalled. Reverse split one for ten in 2002.',
        PS: 'Still selling, still losing money. Its shares traded as low as $2 this spring.'
      }
    },
    {
      year: 2004,
      heading: 'Four years later',
      direction: 'Online sourcing and procurement software became standard in large companies. The established business-software firms added the same features to the systems their customers already ran.',
      destination: 'The buyers kept the savings. Suppliers bid prices down in the auctions, and that money went to the companies doing the buying, not to the auction runners.',
      companies: {
        RA: 'Agreed in January to merge into the procurement-software vendor for about $493 million, a fraction of what it was worth in 2000.',
        IC: 'A small software company, trading at $1.56 after its reverse split, about 16 cents for each share bought in 2000.',
        LS: 'Renamed, and selling business-process software. Its marketplaces are long gone.',
        MS: 'Filed for bankruptcy in October. Its patents were sold at auction for $15.5 million.',
        PS: 'Survived, absorbed the reverse-auction firm, and reverse split one for six to lift its share price.'
      }
    },
    {
      year: 2010,
      heading: 'Ten years later',
      direction: 'Buying and selling between businesses over electronic networks is now how most large companies purchase. The forecast\'s direction was right.',
      destination: 'Two years from now, one of the largest established business-software firms buys the procurement-software vendor for $4.3 billion, far below what it was worth in 2000. The money from the move online settled with the buyers who saved, and with the incumbents who sold them the software.',
      companies: {
        RA: 'Its holders own shares of the procurement-software vendor plus the $2.00 a share they received in cash.',
        IC: 'Sold in January 2008 for $2.56 a share, about four cents for each share bought in 2000.',
        LS: 'Heading into bankruptcy. It files in January 2011 and its assets are sold.',
        MS: 'Gone since 2004. Shareholders received nothing.',
        PS: 'Profitable and growing, with its supplier network at the centre of the business.'
      }
    }
  ],
  names: {
    RA: 'FreeMarkets (Pittsburgh)',
    IC: 'VerticalNet (Horsham, Pennsylvania)',
    LS: 'Chemdex, renamed Ventro in 2000 and NexPrise in 2002',
    MS: 'Commerce One (Pleasanton, California)',
    PS: 'Ariba (Mountain View, later Sunnyvale, California)'
  },
  namesHeading: 'Who they were',
  closing: 'Read your direction statement again. Then read your destination statement.'
};

const STUDENT_COPY = {
  continue: 'Continue',
  submitStatements: 'Lock these statements',
  confirmStatements: "Lock your statements? You can't change them after this.",
  submitAllocation: 'Commit the fund',
  confirmAllocation: "Commit this allocation? It's final.",
  goBack: 'Go back',
  lockedStatements: 'Your statements are locked.',
  committed: 'Your allocation is in. History arrives when your instructor releases it.',
  waitingForStart: 'Your instructor will start the session. This page updates on its own.',
  waitingForTeam: 'Your instructor is placing you on a team. This page updates on its own.',
  waitingForStage: 'The next stage opens when your instructor releases it.',
  paused: 'Your instructor has paused the session. The clock is stopped.',
  wallClosesIn: 'Statements lock in',
  allocationClosesIn: 'Allocation closes in',
  timedOutStatements: 'Time ran out before your statements were locked. You can still allocate, but you cannot hold cash.',
  timedOutAllocation: 'Time ran out before you committed. Your fund stayed unplaced.',
  underTen: 'under $10K',
  sessionClosed: 'This session has closed.'
};

// Projector-only. Thresholds live here so they can change without a deploy.
const FLAGS = {
  contradictionShare: 0.5,  // share of the fund placed against the team's own destination pick
  concentratedShare: 0.6,   // at or above this in one company counts as a concentrated bet
  contradictionText: '{team} said {pick}, then put {share} into companies that bet the other way.',
  pairHeading: 'The most concentrated bet beside the most spread one'
};

const DEBRIEF = {
  facilitatorNote: [
    'Everyone loses money. That is the outcome the sim was built to produce, and saying so before the first stage lands keeps the room from reading it as failure.',
    'The direction statements will almost all hold. Put two of them on the projector at the 2010 stage and ask what they have in common. Then put the destination statements beside them.',
    'Two figures are reconstructed rather than read from a single day\'s close (see the source notes on each company). None of them changes which companies lost almost everything.'
  ],
  disagreement: 'Ask the most concentrated team and the most spread team why, before anyone mentions what happened.',
  naming: [
    'The direction test: was the forecast right about what would happen?',
    'The destination test: was it right about who would be paid?',
    'Adoption is not revenue',
    'When a capability becomes cheap and universal, the firm that planned to charge for it loses its price'
  ],
  turn: 'Find a forecast being made right now about your own field. Write its direction claim and its destination claim separately, and say what would have to be true for the second to hold.',
  cashPrompt: 'For the teams that held cash: where did you say the money would land, and were you right?',
  teamPrompt: 'Who on your team wanted to concentrate, and who wanted to spread?',
  sawItComing: 'Six months after these funds committed, in December 2000, a Wharton faculty member told the school\'s business journal that big buyers would build their own purchasing systems and keep the savings, rather than pay an outside marketplace to do it. The destination was visible within the year. Ask who in the room wrote something close to that.',
  epilogue: 'If anyone held on until 2012: the procurement-software vendor was bought for $45 a share. A June 2000 holder of it would have $80K of every $1M. A holder of the reverse-auction firm, carried through the merger, would have about $220K. The best outcome in the room still lost most of the money.'
};

module.exports = { META, CLOCK, BRIEFING, FORECAST, WALL, FUND, COMPANIES, REVEAL, STUDENT_COPY, FLAGS, DEBRIEF };
