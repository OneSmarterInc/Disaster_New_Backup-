'use strict';
// SERVER-SIDE ONLY. Nothing in this file is sent to a browser as-is.

module.exports = {
  "simId": "rapid-10-bubble",
  "route": "/sim10",
  "title": "Infrastructure or Bubble?",
  "tagline": "Two quarters of a real company. One call: infrastructure or bubble?",
  "minutes": 45,
  "catalogueRevision": "sim10-v3",
  "description": "Read two quarters of financial information from a real company whose name is hidden. Decide whether its business is supported by the evidence, explain your judgment, and say what would change your mind. Then learn its identity and what happened later.",
  "detail": {
    "world": "Technology infrastructure · financial analysis",
    "seat": "Analyst evaluating a company",
    "clock": "Two quarterly reports per case",
    "teaches": "Read financial reports, question company claims, and explain the assumptions behind a judgment.",
    "tangle": "Sales growth, cash needs, and the company's own performance measures may tell different stories.",
    "turn": "You commit to a judgment before learning the company's name or later results.",
    "after": "Review the company identity and later evidence alongside your original verdict.",
    "discussion": "Compare which figures students trusted, how they interpreted them, and what would have changed their judgment.",
    "tryIt": "Try the complete activity before assigning it to students.",
    "sessionShape": "Allow about 45 minutes, depending on whether the instructor selects one or two cases and individual or team play. Reading and decision windows are timed; the instructor controls the reveal and discussion.",
    "catalogueFacts": [
      {
        "label": "Play",
        "value": "Individual or team"
      },
      {
        "label": "Before play",
        "value": "Basic financial knowledge useful"
      },
      {
        "label": "Feedback",
        "value": "Class comparison and discussion"
      }
    ],
    "atAGlance": [
      {
        "label": "Main task",
        "value": "A verdict for each of one or two cases"
      },
      {
        "label": "Numbers",
        "value": "Read and compare financial statements"
      },
      {
        "label": "Play mode",
        "value": "Individual or team"
      }
    ],
    "beats": [
      {
        "at": "Read",
        "what": "Examine two quarters of company figures and claims."
      },
      {
        "at": "Decide",
        "what": "Give a verdict, supporting reasons, and evidence that could change it."
      },
      {
        "at": "Review",
        "what": "Compare your judgment with the company identity and later events."
      }
    ],
    "activity": "Examine the financial statements and management claims. Choose a verdict, identify the figures behind it, and explain what evidence could change it. Your instructor can use one or two cases.",
    "suitableFor": "Financial analysis, business strategy, and technology investment classes.",
    "preparation": "The financial reports are supplied. Basic familiarity with income statements, balance sheets, and cash flow is useful.",
    "output": "A verdict for each selected case, supporting figures and reasons, and evidence that could change the verdict.",
    "durationNote": "Plan about 45 minutes; timing depends on the case count, mode, and discussion.",
    "momentsIntro": ""
  },

  // Ids already declared by other sims in OneSmarterInc/Disaster_New (checked
  // 27 Sep 2026), and legacy ids with mixed history that must never be reused.
  takenIds: ['rapid-01-disaster', 'rapid-02-relay', 'rapid-03-midland', 'rapid-05-approve', 'rapid-06-switch', 'rapid-07-bought', 'rapid-08-later', 'rapid-09-money-land'],
  retiredIds: ['rapid-03-bench', 'rapid-sim-03', 'rapidsimplus-01'],

  // Scaling: every money amount (in USD thousands) is multiplied by this
  // per-case constant and rounded to a whole number. Undisclosed.
  scale: { A: 0.0137, B: 0.52 },

  // Minimum lengths for written answers (characters).
  minMindChangerChars: 80,
  minLineReasonChars: 15,

  // Phase lengths in minutes, keyed by "<cases>-<mode>".
  clock: {
    '1-individual': { read: 12, verdict: 6 },
    '1-team': { read: 10, private: 2, team: 8 },
    '2-individual': { read: 6, verdict: 4 },
    '2-team': { read: 5, private: 1, team: 4 },
  },

  // Play-pack layout: the company's own order. Each section lists tags;
  // { pair: [a, b] } renders the company measure next to the standard one.
  layout: {
    A: [
      { id: 'summary', title: 'Results summary', rows: [
        { pair: ['hl.cash_revenue', 'is.revenue'] },
        { derived: 'dv.reported_growth', growthOf: 'is.revenue', label: 'Revenue growth on the same quarter a year earlier, as reported' },
        'hl.proforma_growth',
        { pair: ['hl.adj_ebitda', 'is.operating_loss'] },
      ], statements: ['mg.strategy', 'mg.demand', 'mg.funding', 'mg.debt'] },
      { id: 'income', title: 'Statement of operations', rows: ['is.revenue', 'is.revenue_upfront', 'is.cost_of_sales', 'is.depreciation', 'is.goodwill_amort', 'is.operating_loss', 'is.interest_expense', 'is.net_loss_common'] },
      { id: 'adjustments', title: 'How the company builds Adjusted EBITDA', rows: ['recon.deferred_cash', 'recon.noncash_capacity', 'recon.stock_comp'] },
      { id: 'balance', title: 'Balance sheet (end of quarter)', rows: ['bs.cash', 'bs.ppe_in_service', 'bs.cip', 'bs.goodwill', 'bs.total_assets', 'bs.accrued_construction', 'bs.debt_current', 'bs.debt_long', 'bs.deferred_revenue', 'bs.preferred'] },
      { id: 'cashflow', title: 'Cash flows', rows: ['cf.capex_quarter', 'cf.operating_ytd', 'cf.investing_ytd', 'cf.equity_raised_ytd', 'cf.debt_raised_ytd', 'cf.debt_repaid_ytd'] },
      { id: 'notes', title: 'Notes', rows: ['nt.remaining_build', 'nt.credit_line', 'nt.asset_sale'], text: ['tx.deferral_shift', 'tx.asset_lives', 'tx.amort_life', 'tx.customer_financing', 'tx.price_decline', 'tx.losses_on_contracts'] },
    ],
    B: [
      { id: 'summary', title: 'Results summary', rows: [
        { pair: ['hl.revenue_ex_resale', 'is.revenue'] },
        { derived: 'dv.reported_growth', growthOf: 'is.revenue', label: 'Revenue growth on the same quarter a year earlier, as reported' },
        { pair: ['hl.adj_ebitda', 'is.operating_loss'] },
        'hl.customers',
      ], statements: ['mg.ebitda_outlook', 'mg.deleverage', 'mg.demand_risk', 'mg.competition'] },
      { id: 'income', title: 'Statement of operations', rows: ['is.revenue', 'is.revenue_recurring', 'is.revenue_resale_related', 'is.cost_of_revenue', 'is.depreciation', 'is.restructuring', 'is.operating_loss', 'is.interest_expense', 'is.debt_gain', 'is.net_loss'] },
      { id: 'balance', title: 'Balance sheet (end of quarter)', rows: ['bs.cash', 'bs.restricted_cash', 'bs.ppe_in_service', 'bs.cip', 'bs.total_assets', 'bs.debt_current', 'bs.debt_long', 'bs.lease_commitments'] },
      { id: 'cashflow', title: 'Cash flows', rows: ['cf.capex_quarter', 'cf.operating_ytd', 'cf.financing_ytd'] },
      { id: 'notes', title: 'Notes', rows: ['nt.bonds_for_shares', 'nt.bond_market_value', 'nt.top_customer_share', 'nt.bad_debt'], text: ['tx.going_concern', 'tx.covenant_breach', 'tx.no_building', 'tx.right_sizing', 'tx.related_resale', 'tx.asset_lives', 'tx.customer_failures'] },
    ],
  },

  // Blank cells allowed in the play pack, with the reason (host-visible only).
  allowBlank: {
    B: { 'bs.lease_commitments': { Q2: 'not captured; show Quarter 1 only' },
         'nt.bond_market_value': { Q2: 'not captured; show Quarter 1 only' },
         'nt.bad_debt': { Q1: 'different disclosure in Quarter 1' } },
  },

  // Reveal stage 2: trimmed rows, all shown in US$ millions, real figures.
  reveal: {
    A: { decimals: 0, rows: ['hl.cash_revenue', 'hl.adj_ebitda', 'recon.deferred_cash', 'is.revenue', 'is.revenue_upfront', 'is.operating_loss', 'is.net_loss_common', 'bs.cash', 'bs.debt_total', 'bs.deferred_revenue', 'cf.capex_quarter'],
         excludeFacts: ['tx.exodus_stake', 'tx.hosting_stake'], // would hint Case B's sector before it is played
         outcome: ['out.bankruptcy', 'out.sec_order', 'out.sec_figures', 'out.special_committee', 'out.restated'] },
    B: { decimals: 1, rows: ['is.revenue', 'is.revenue_acquired', 'is.operating_loss', 'is.debt_gain', 'is.net_loss', 'bs.cash', 'bs.debt_current', 'bs.debt_long', 'cf.capex_quarter', 'cf.operating_q', 'nt.bond_market_value'],
         outcome: ['out.no_bankruptcy', 'out.rescuer', 'out.growth_run'] },
  },
};
