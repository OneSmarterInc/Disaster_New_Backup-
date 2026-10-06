const pack = require('../data/pack.json');
const sheets = require('../data/sheets');
const config = require('../data/config');

const TIER_RANK = { Solo: 1, Crew: 2, Fleet: 3 };

// Scope is derived from the record, the way a student would derive it.
const inScope = a => String(a.signup_date).startsWith('prior year');
const activeLastDay = a => a.tier_end !== null; // gone accounts have no end tier
const activeEveryDay = a => a.cancel_date === null;
const round1 = x => Math.round(x * 10 + 1e-9) / 10;

function scoped(accounts = pack.accounts) { return accounts.filter(inScope); }

const count = {
  A: a => activeLastDay(a),
  B: a => activeEveryDay(a),
  C: a => activeLastDay(a) && TIER_RANK[a.tier_end] >= TIER_RANK[a.tier_start],
  D: a => activeLastDay(a) && a.q_end_invoice_status === 'paid',
};

function compute(sheetId, accounts = pack.accounts) {
  const s = scoped(accounts);
  if (sheetId === 'E') {
    const start = s.reduce((t, a) => t + a.mrr_start, 0);
    const end = s.filter(activeLastDay).reduce((t, a) => t + a.mrr_end, 0);
    return { value: round1((end / start) * 100), numerator: end, denominator: start, unit: 'dollars' };
  }
  const kept = s.filter(count[sheetId]).length;
  return { value: round1((kept / s.length) * 100), numerator: kept, denominator: s.length, unit: 'accounts' };
}

// Stage 2: the worked derivation, generated from the same records.
function derivation(sheetId) {
  const s = scoped();
  const r = compute(sheetId);
  const excludedNew = pack.accounts.length - s.length;
  if (sheetId === 'E') {
    const lost = s.filter(a => !activeLastDay(a));
    const down = s.filter(a => activeLastDay(a) && a.mrr_end < a.mrr_start);
    return [
      `${excludedNew} mid-quarter signups excluded; ${s.length} accounts in scope, starting MRR $${r.denominator.toLocaleString('en-US')}.`,
      `${lost.length} cancelled accounts bill nothing at quarter end: -$${lost.reduce((t, a) => t + a.mrr_start, 0).toLocaleString('en-US')}.`,
      `${down.length} downgrades bill less: -$${down.reduce((t, a) => t + a.mrr_start - a.mrr_end, 0).toLocaleString('en-US')}.`,
      `$${r.numerator.toLocaleString('en-US')} / $${r.denominator.toLocaleString('en-US')} = ${r.value.toFixed(1)}%.`,
    ];
  }
  const out = s.filter(a => !count[sheetId](a));
  const why = {
    A: 'cancelled and still gone on the last day',
    B: 'cancelled at some point, including the two that came back',
    C: 'gone, or on a lower tier than they started',
    D: 'gone, or active with an unpaid quarter-end invoice',
  }[sheetId];
  return [
    `${excludedNew} mid-quarter signups excluded; ${s.length} accounts in scope.`,
    `${out.length} accounts not retained: ${why}.`,
    `${r.numerator} / ${r.denominator} = ${r.value.toFixed(1)}%.`,
  ];
}

function assignSheets(n) {
  if (n < config.minTeams) throw new Error(`At least ${config.minTeams} teams are required.`);
  return Array.from({ length: n }, (_, i) => config.assignmentOrder[i % config.assignmentOrder.length]);
}

// Instructor-only: does a committed number match its sheet?
function checkCommit(sheetId, committed) {
  if (committed === null || committed === undefined) return { status: 'none' };
  const correct = compute(sheetId).value;
  return Math.abs(committed - correct) <= config.errorTolerance + 1e-9
    ? { status: 'ok' } : { status: 'mismatch', correct };
}

// The ONLY function that builds what a student receives. The gate tests this exact output.
function studentPayload(sheetId) {
  const clean = pack.accounts.map(({ _event, ...rest }) => rest);
  return {
    company: pack.company,
    period: pack.period,
    plans: pack.plans,
    startingMrrInScope: pack.startingMrrInScope,
    accounts: clean,
    tickets: pack.tickets,
    sheet: { title: 'Retention definition', lines: sheets.sheetLines(sheetId) },
  };
}

module.exports = { compute, derivation, assignSheets, checkCommit, studentPayload, scoped };
