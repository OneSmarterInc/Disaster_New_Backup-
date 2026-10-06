// Every sheet is the shared lines plus exactly one contested line.
// Department and purpose are revealed only at Stage 2 and must never reach a student.
const shared = [
  'Period: 1 July to 30 September.',
  'Scope: only accounts active on 1 July. Accounts that signed up after 1 July are excluded.',
  'Source: the account records in the data pack.',
  'Report retention as a percentage to one decimal place, rounded half up.',
];

const contested = {
  A: 'An account counts as retained if it was active on the last day of the quarter.',
  B: 'An account counts as retained if it was active on every day of the quarter.',
  C: 'An account counts as retained if it was active on the last day of the quarter on the same tier or higher.',
  D: 'An account counts as retained if it was active on the last day of the quarter and had paid its quarter-end invoice.',
  E: 'Retention is the share of starting monthly revenue still billed on the last day of the quarter, including accounts whose invoice is unpaid.',
};

const reveal = {
  A: { department: 'Sales', purpose: 'Wins back a customer and wants credit for it.' },
  B: { department: 'Customer Success', purpose: 'Any lapse means the relationship failed.' },
  C: { department: 'Product', purpose: 'A downgrade means the product disappointed.' },
  D: { department: 'Finance', purpose: "Unpaid isn't retained until the cash arrives." },
  E: { department: 'Investor Relations', purpose: 'Investors price dollars, not logos.' },
};

function sheetLines(id) {
  return [...shared.slice(0, 3), contested[id], shared[3]];
}

module.exports = { shared, contested, reveal, sheetLines, ids: ['A', 'B', 'C', 'D', 'E'] };
