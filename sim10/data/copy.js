'use strict';
// Every word a student can see before the reveal lives in `play`.
// The build gate runs the denylist and context checks over all of it.
// Text that quotes an amount is a function of `money`, which formats a
// USD-thousands source figure after scaling; `figures` lists each one
// with its filing reference so the gate can check provenance.

const glossary = {
  'capital expenditure': 'Money spent on long-lived assets such as buildings, networks and equipment. It is paid in cash now and turned into an expense gradually over later years.',
  'depreciation': 'The expense that spreads the cost of a long-lived asset over the years it is expected to be used. Recording it uses no cash.',
  'useful life': 'The number of years a company expects to use an asset. A longer useful life means a smaller depreciation expense each year.',
  'EBITDA': 'Earnings before interest, tax, depreciation and amortisation. Companies often publish an adjusted version that adds back further items of their own choosing, with no common standard for what goes in.',
  'deferred revenue': 'Cash a customer has paid for something not yet delivered. It sits on the balance sheet as a debt to the customer and turns into revenue as the service is provided.',
};

const play = {
  A: {
    briefing: [
      'A colleague is deciding whether to commit money to the company below. They haven\'t asked you whether to do it. They\'ve asked one question: is this company building infrastructure that will be needed, or is it inside a bubble?',
      'The company builds a network of long-lived physical assets and sells capacity on it to other businesses. It writes off its network equipment over as long as twenty-five years. Several other companies are building comparable networks.',
      'You have two consecutive quarters of its reported figures and what management said about demand. The company is real, and at the time nobody yet knew the answer. All amounts have been scaled by a single factor; every ratio, growth rate and trend is exactly as reported.',
      'Please don\'t try to identify the company. If you find it, the exercise is over for you.',
    ],
    pairNotes: {
      'hl.cash_revenue|is.revenue': 'The company\'s measure adds cash customers paid up front for capacity that will be recognised as revenue over later years.',
      'hl.adj_ebitda|is.operating_loss': 'The company\'s measure adds back depreciation, write-offs of acquired goodwill, the cost of capacity sold, share-based pay, and cash received but not yet earned.',
    },
    lineNotes: {
      'hl.proforma_growth': 'Company figure: as if every business it bought had been owned in both periods, excluding a business it is selling.',
      'hl.cash_revenue': 'Quarter 2 is rounded by the company.',
      'cf.capex_quarter': 'Cash paid in the quarter for network building and equipment.',
      'nt.remaining_build': 'Both quarters: the company expects to finish by the middle of next year.',
      'nt.asset_sale': 'Agreed after Quarter 1 closed and disclosed in the Quarter 1 report.',
      'bs.deferred_revenue': 'Short-term and long-term parts combined.',
    },
    statements: {
      'mg.strategy': 'Management says the company aims to be the leading provider of data services over a network of unmatched reach, and expects the network to make it the lowest-cost provider in most of its markets.',
      'mg.demand': 'Management attributes like-for-like revenue growth mainly to rising demand for data products.',
      'mg.funding': 'Management expects to pay for all planned building without raising more money, using a larger bank credit line, money raised by a part-owned affiliate, the agreed sale of a regional business, and cash from operations.',
      'mg.debt': 'Management acknowledges a large amount of debt and says operating cash, the credit line and its continued ability to raise capital will cover spending, interest and repayments for the foreseeable future.',
    },
    text: {
      'tx.deferral_shift': () => 'From this year most capacity contracts are booked as revenue spread over the contract term instead of all at once. The company says this lowers reported revenue now, raises it later, and does not change cash.',
      'tx.asset_lives': () => 'Network systems are depreciated over their remaining economic lives. The company\'s policy puts network equipment at 3 to 25 years.',
      'tx.amort_life': () => 'After discussion with the securities regulator, the company shortened the life over which it writes off one block of acquired goodwill from 10 years to 5, and restated earlier periods. No effect on cash.',
      'tx.customer_financing': () => 'The company has lent limited amounts to customers to help them buy capacity, repayable in instalments over up to four years, and says this will not materially affect its liquidity.',
      'tx.price_decline': () => 'Margins fell partly because of lower prices on the capacity the company sells.',
      'tx.losses_on_contracts': (money) => `The company wrote down assets for expected losses on capacity sales contracts: ${money(38000)} in Quarter 1 and ${money(3000)} in Quarter 2.`,
    },
    figures: [
      { tag: 'tx.losses_on_contracts', k: 38000, src: 'gc-10q-2000q2 p.10 note 3' },
      { tag: 'tx.losses_on_contracts', k: 3000, src: 'gc-10q-2000q3 p.10 note 3' },
    ],
  },

  B: {
    briefing: [
      'A different company, a different period. A colleague is deciding whether to commit money to the company below. They haven\'t asked you whether to do it. They\'ve asked one question: is this company building infrastructure that will be needed, or is it inside a bubble?',
      'The company fits out large facilities inside leased buildings and sells space and capacity in them to other businesses. It writes off the equipment inside over seven to ten years, and the building works over no longer than the lease, which runs up to twenty-three years. Several other companies offer comparable space.',
      'You have two consecutive quarters of its reported figures and what management said about demand. The company is real, and at the time nobody yet knew the answer. All amounts have been scaled by a single factor; every ratio, growth rate and trend is exactly as reported.',
      'Please don\'t try to identify the company. If you find it, the exercise is over for you.',
    ],
    pairNotes: {
      'hl.revenue_ex_resale|is.revenue': 'The company\'s measure removes equipment it bought and resold through two companies linked to its directors.',
      'hl.adj_ebitda|is.operating_loss': 'The company\'s measure adds back depreciation, share-based pay and, in Quarter 2, restructuring charges.',
    },
    lineNotes: {
      'bs.cash': 'Cash plus short-term investments.',
      'bs.restricted_cash': 'Held as security for leases; the company cannot spend it.',
      'bs.debt_current': 'Quarter 2 includes the whole bank loan, moved here after the company broke its loan terms.',
      'bs.lease_commitments': 'Quarter 2 figure not shown.',
      'cf.capex_quarter': 'Includes paying builders for work already done.',
      'nt.bond_market_value': 'What investors would pay for 100 of the company\'s bonds. Quarter 2 figure not shown.',
      'nt.bad_debt': 'In Quarter 1 the company reported instead that customers already bankrupt or closed made up 3.0% of revenue.',
    },
    statements: {
      'mg.ebitda_outlook': 'Management expects its own operating-profit measure to move toward breakeven over the next few quarters, through growth in core revenue and tight control of spending.',
      'mg.deleverage': 'Management intends to issue a large number of new shares to retire its remaining bonds, and says bondholders have indicated they are willing.',
      'mg.demand_risk': 'Management warns that if demand for the kind of service it sells stops growing, a viable market for its facilities may not emerge.',
      'mg.competition': 'Management says it competes with larger, better-funded providers of similar space that could cut prices, and with newer firms copying its model.',
    },
    text: {
      'tx.going_concern': () => 'The accounts are prepared on the assumption that the company carries on, and the notes explain the doubts at length: losses and negative operating cash in every period since it started.',
      'tx.covenant_breach': (money) => `Quarter 2: the company broke the terms of its bank loan, including a revenue target. The banks agreed to waive this on condition that at least ${money(100000)} of bonds (face value) are converted into shares by a fixed date; otherwise the company is in breach again. The company says it may need to seek bankruptcy protection to force the conversion.`,
      'tx.no_building': () => 'The largest facility was finished in Quarter 1. Nothing is under construction, and there are no plans to build or expand unless new funding is found.',
      'tx.right_sizing': () => 'Large customers have been cutting the capacity they are committed to pay for, often in exchange for longer contracts. The company says it has renegotiated all seven of its largest customers and expects no further significant cuts.',
      'tx.related_resale': () => 'Part of revenue is equipment bought from and resold through two companies whose executives sit on this company\'s board; it is booked at the full sale price. The company says it does not expect significant resales in future.',
      'tx.asset_lives': () => 'The main equipment inside the facilities is depreciated over seven to ten years, and building works over no longer than the lease, with leases running up to twenty-three years.',
      'tx.customer_failures': () => 'Several customers, some of them large, have filed for bankruptcy. Overdue balances from two of them were written off or fully reserved in Quarter 2.',
    },
    figures: [
      { tag: 'tx.covenant_breach', k: 100000, src: 'eqix-10q-2002q2 p.7-8 note 1' },
    ],
  },
};

// Revealed only after the instructor releases stage 1. Not denylist-checked.
const reveal = {
  A: {
    name: 'Global Crossing Ltd.',
    period: 'April to September 2000',
    asset: 'An undersea and land fibre-optic network linking North America, Europe, Asia and Latin America. It sold capacity on the network to telecom carriers and large businesses.',
    basis: [
      'Each quarter is shown as the company reported it at the time. The quarter to September 2001 excludes two businesses the company had moved to discontinued operations, so its revenue is on a narrower basis.',
      'From the quarter to December 2000 the company reported \u201cRecurring Adjusted EBITDA\u201d, which leaves out items it called non-recurring. The two quarters you read show its earlier measure, \u201cAdjusted EBITDA\u201d.',
      'The December 2000 cash revenue and Recurring Adjusted EBITDA come from the company\u2019s results announcement as reported in the trade press; they agree with the totals in its annual report.',
      'A dash means the figure was not reported on the same basis that quarter. The company later restated all of 2000 and the first three quarters of 2001.',
    ],
  },
  B: {
    name: 'Equinix, Inc.',
    period: 'January to June 2002',
    asset: 'Data centres in leased buildings where internet networks, content companies and large businesses placed their equipment and connected to one another.',
    basis: [
      'Each quarter is shown as the company reported it at the time. From the quarter to March 2003 the figures include two similar businesses it combined with on 31 December 2002.',
      'The December 2002 quarter had no separate report. Its figures are the annual totals less the first nine months, so they carry rounding of up to $0.1m. Capital spending for that quarter is not shown.',
      'Cash includes short-term investments where the company held them.',
    ],
  },
};

// Host-only notes. `beforeReveal` is denylist-checked; `afterReveal` is not.
const notes = {
  A: {
    beforeReveal: {
      disagreement: [
        'Pick a pair that cited the same line with opposite calls. The strongest pairs for this case sit in the results summary or the Adjusted EBITDA build: cash revenue, Adjusted EBITDA, or cash received but not yet earned.',
        'Opening question one: you both pointed at the same line. What does it tell you that it doesn\'t tell your partner?',
        'Opening question two: what would the next quarter\'s figure on this line have to be for you to switch?',
        'Stop before anyone names the company. If someone offers a guess, say "hold that" and move on.',
      ],
      naming: [
        ['Vendor financing', 'tx.customer_financing'],
        ['Company-defined profit measures', 'hl.adj_ebitda'],
        ['Counting cash paid in advance as if earned', 'recon.deferred_cash'],
        ['Reciprocal capacity deals (buying from customers who buy from you)', 'hl.cash_revenue'],
        ['Recognising long-term capacity sales up front', 'is.revenue_upfront'],
        ['Goodwill write-off periods', 'tx.amort_life'],
        ['Useful-life assumptions', 'tx.asset_lives'],
        ['Overbuilding and falling prices', 'tx.price_decline'],
        ['Growth bought through acquisitions', 'hl.proforma_growth'],
      ],
      turn: 'Pick a company building long-lived capacity today. Which of these lines would you look at first, and where in its reports would you find them?',
      minorityCase: {
        infra: 'The case for infrastructure: like-for-like growth is positive and speeding up (7% then 13%). Deferred revenue is cash already in hand, not a promise. The cost to finish the network is falling, and completion is expected within a year. Customer lending is described as limited. A network that is nearly finished and already carrying paying traffic is hard to call a bubble.',
        bubble: 'The case for a bubble: reported revenue growth is several hundred percent, but like-for-like growth is single digits to low teens. The company measure of profit is smaller than the cash it received in advance, so strip that out and there is little left. Cash nearly halved in one quarter; capital spending is larger than revenue; prices are falling; and the company is lending customers money to buy from it.',
      },
    },
    afterReveal: [
      'The goodwill life moved shorter, under regulator pressure. Ask: which way would you expect a company under pressure to move its asset lives, and what would that do to reported profit?',
      'The reciprocal deals the SEC later described began in the quarter right after the two quarters students saw. Nothing in Quarters 1 and 2 shows them; that is the point of the reveal.',
      'If Case B follows: Equinix\'s own filings list Global Crossing among its customers that went bankrupt.',
    ],
  },
  B: {
    beforeReveal: {
      disagreement: [
        'Pick a pair that cited the same line with opposite calls. The strongest pairs for this case: bond market value, construction in progress, cash from operations, or the customer count.',
        'Opening question one: you both pointed at the same line. What does it tell you that it doesn\'t tell your partner?',
        'Opening question two: did you read this company differently because of the first one? Which line did you carry over?',
        'Stop before anyone names the company. If someone offers a guess, say "hold that" and move on.',
      ],
      naming: [
        ['Going-concern doubt', 'tx.going_concern'],
        ['Covenant breach and waiver', 'tx.covenant_breach'],
        ['Debt-for-equity exchange', 'nt.bonds_for_shares'],
        ['Distressed debt pricing', 'nt.bond_market_value'],
        ['Gains from retiring debt below face value', 'is.debt_gain'],
        ['Related-party revenue booked gross', 'is.revenue_resale_related'],
        ['Customer concentration', 'nt.top_customer_share'],
        ['Contract right-sizing', 'tx.right_sizing'],
        ['Lease commitments kept off the balance sheet', 'bs.lease_commitments'],
      ],
      turn: 'Pick a company building long-lived capacity today. Is it building now, or has it stopped? Which line tells you, and what would you want to see next quarter?',
      minorityCase: {
        infra: 'The case for infrastructure: building has stopped, so the cash going out is operating cash, and that is small. Customers are still rising (232 to 248). Costs are being cut. Bondholders are taking shares instead of forcing a default, which says they think the equity is worth something. The facilities exist and are filling.',
        bubble: 'The case for a bubble: the auditors\' notes doubt the company can carry on. It broke its bank terms and may need bankruptcy to force a debt swap. Its bonds trade at about a third of face value. Revenue fell in Quarter 2, and several customers have gone bankrupt.',
      },
    },
    afterReveal: [
      'This is the trap working as designed: Case B looked worse than Case A on almost every line, and it survived.',
      'The quarter right after the students\' window shows a net profit (the bond gain) and positive operating cash. Ask who would have seen that coming, and from which line.',
      'Related-party equipment resale booked gross echoes Case A\'s reciprocal deals, on a tiny scale, and the company stopped it.',
    ],
  },
};

module.exports = { glossary, play, reveal, notes };
