// Builds data/pack.json deterministically. Run: node data/build-pack.js
// The pack is the single source of truth. Results are never typed in anywhere
// else except config.expectedResults, which the gate checks against the engine.
const fs = require('fs');
const path = require('path');

const PRICE = { Solo: 79, Crew: 249, Fleet: 899 };

// [name, trade, city, vehicles, tierStart, event, extra]
// event: none | gone | back | grace | down | new
const rows = [
  ['Halvorsen Plumbing', 'Plumbing', 'Ashby', 1, 'Solo', 'none'],
  ['Northgate Heating & Air', 'HVAC', 'Colfax', 34, 'Fleet', 'gone', { cancel: '08-19' }],
  ['Greenline Lawn Co.', 'Landscaping', 'Marlow', 4, 'Crew', 'grace'],
  ['Dale Kurtz Electric', 'Electrical', 'Ashby', 1, 'Solo', 'grace'],
  ['Brookside Pool Service', 'Pool service', 'Tilden', 6, 'Crew', 'down', { tierEnd: 'Solo', on: '08-02' }],
  ['Tri-County Roofing', 'Roofing', 'Colfax', 9, 'Crew', 'none'],
  ['Ortega Drain & Sewer', 'Plumbing', 'Wexley', 1, 'Solo', 'back', { cancel: '07-24', back: '08-30' }],
  ['Summit Mechanical', 'HVAC', 'Harlan', 22, 'Fleet', 'down', { tierEnd: 'Crew', on: '09-05' }],
  ['Pine & Pebble Landscapes', 'Landscaping', 'Tilden', 1, 'Solo', 'none'],
  ['Keller Garage Doors', 'Garage doors', 'Marlow', 3, 'Crew', 'none'],
  ['Redtail Pest Control', 'Pest control', 'Harlan', 1, 'Solo', 'grace'],
  ['Mendez Family Plumbing', 'Plumbing', 'Colfax', 7, 'Crew', 'back', { cancel: '07-15', back: '08-08' }],
  ['Ironwood Electric', 'Electrical', 'Wexley', 14, 'Fleet', 'none'],
  ['Clearwater Irrigation', 'Landscaping', 'Ashby', 1, 'Solo', 'none'],
  ['Boone Heating & Cooling', 'HVAC', 'Marlow', 5, 'Crew', 'grace'],
  ['J. Whitfield Roofing', 'Roofing', 'Tilden', 1, 'Solo', 'gone', { cancel: '09-12' }],
  ['Lakeshore Plumbing Group', 'Plumbing', 'Harlan', 40, 'Fleet', 'gone', { cancel: '07-29' }],
  ['Sparrow Lawn Care', 'Landscaping', 'Wexley', 1, 'Solo', 'none'],
  ['Fairbanks HVAC', 'HVAC', 'Ashby', 8, 'Crew', 'none'],
  ['Crane Electric Services', 'Electrical', 'Colfax', 2, 'Crew', 'down', { tierEnd: 'Solo', on: '07-21' }],
  ['Pruitt Pest Solutions', 'Pest control', 'Marlow', 1, 'Solo', 'none'],
  ['Westfield Pools', 'Pool service', 'Harlan', 1, 'Solo', 'grace'],
  ['Hartley Plumbing & Heat', 'Plumbing', 'Tilden', 10, 'Crew', 'none'],
  ['Copperline Mechanical', 'HVAC', 'Wexley', 18, 'Fleet', 'none'],
  ['Benny Ruiz Landscaping', 'Landscaping', 'Colfax', 1, 'Solo', 'none'],
  ['Stonebridge Roofing', 'Roofing', 'Ashby', 6, 'Crew', 'gone', { cancel: '08-27' }],
  ['Okafor Electric', 'Electrical', 'Tilden', 1, 'Solo', 'none'],
  ['Maple Street Plumbing', 'Plumbing', 'Marlow', 3, 'Crew', 'down', { tierEnd: 'Solo', on: '09-18' }],
  ['Evergreen Grounds', 'Landscaping', 'Harlan', 27, 'Fleet', 'none'],
  ['Quick Fix Garage Doors', 'Garage doors', 'Wexley', 1, 'Solo', 'grace'],
  ['Delgado Heating', 'HVAC', 'Colfax', 4, 'Crew', 'none'],
  ['Lindqvist Pest Control', 'Pest control', 'Ashby', 1, 'Solo', 'none'],
  ['Moss Creek Pools', 'Pool service', 'Tilden', 1, 'Solo', 'none'],
  ['Patel Plumbing Services', 'Plumbing', 'Harlan', 5, 'Crew', 'none'],
  ['Harbor Electric', 'Electrical', 'Marlow', 1, 'Solo', 'none'],
  ['Granite Peak Roofing', 'Roofing', 'Wexley', 7, 'Crew', 'none'],
  ['Tall Oaks Tree & Lawn', 'Landscaping', 'Colfax', 1, 'Solo', 'none'],
  ['Wren Heating & Air', 'HVAC', 'Tilden', 9, 'Crew', 'none'],
  ['Sam Nakamura Plumbing', 'Plumbing', 'Ashby', 1, 'Solo', 'none'],
  ['Riverbend Electric', 'Electrical', 'Harlan', 3, 'Crew', 'none'],
  // Signed up mid-quarter: out of scope on every sheet.
  ['Fenwick Lawn & Snow', 'Landscaping', 'Marlow', 1, 'Solo', 'new', { signup: '08-11' }],
  ['Castillo Air Systems', 'HVAC', 'Wexley', 5, 'Crew', 'new', { signup: '07-22' }],
  ['Bright Spark Electric', 'Electrical', 'Colfax', 1, 'Solo', 'new', { signup: '09-02' }],
];

// Signup dates for in-scope accounts: before the quarter, written without a year.
const priorSignups = ['03-04', '11-19', '01-27', '06-02', '09-15', '04-30', '02-11', '10-08', '05-21', '12-03'];

const accounts = rows.map((r, i) => {
  const [business_name, trade, city, vehicles, tier_start, event, x = {}] = r;
  const id = `RD-${1001 + i}`;
  let tier_end = tier_start;
  let cancel_date = null;
  let reactivate_date = null;
  let q_end_invoice_status = 'paid';
  let notes = '';
  let signup_date = `prior year ${priorSignups[i % priorSignups.length]}`;
  if (event === 'gone') { cancel_date = x.cancel; tier_end = null; q_end_invoice_status = 'none issued'; notes = 'Cancelled.'; }
  if (event === 'back') { cancel_date = x.cancel; reactivate_date = x.back; notes = 'Cancelled, later reactivated on the same plan.'; }
  if (event === 'grace') { q_end_invoice_status = 'unpaid'; notes = 'Quarter-end invoice unpaid; account in 30-day grace period.'; }
  if (event === 'down') { tier_end = x.tierEnd; notes = `Changed plan from ${tier_start} to ${x.tierEnd} on ${x.on}.`; }
  if (event === 'new') { signup_date = x.signup; notes = 'New customer this quarter.'; }
  return {
    account_id: id, business_name, trade, city, vehicles,
    signup_date, tier_start: event === 'new' ? null : tier_start, tier_end,
    mrr_start: event === 'new' ? 0 : PRICE[tier_start],
    mrr_end: tier_end ? PRICE[tier_end] : 0,
    cancel_date, reactivate_date, q_end_invoice_status, notes,
    _event: event, // stripped before anything reaches a student
  };
});

// Tickets. Summaries give the why; they enter no calculation.
const T = {
  gone: [
    ['Billing', 'Asked how to cancel and whether any data export is included.'],
    ['Feature request', 'Wants route optimisation across multiple crews; told it is not on the roadmap this year.'],
    ['Billing', 'Disputed a price change at renewal.'],
  ],
  back: [
    ['Account', 'Cancelled after switching to a cheaper competitor.'],
    ['Account', 'Asked to restore the account and previous job history.'],
  ],
  grace: [
    ['Billing', 'Card on file declined; customer says a new card is coming.'],
    ['Billing', 'Asked to delay payment until a large job is paid.'],
  ],
  down: [
    ['Billing', 'Asked whether a smaller plan keeps invoicing features.'],
    ['Account', 'Reduced team size for the season; requested plan change.'],
  ],
  none: [
    ['How-to', 'Asked how to add a second technician to a job.'],
    ['Bug', 'Invoice PDF showed the wrong tax line; fixed in a patch.'],
    ['How-to', 'Asked how to import customer list from a spreadsheet.'],
  ],
  new: [['Onboarding', 'Setup call booked; importing existing customers.']],
};
const ticketDates = ['07-03', '07-09', '07-16', '07-23', '07-30', '08-06', '08-13', '08-20', '08-27', '09-03', '09-10', '09-17', '09-24'];
const tickets = [];
let t = 5001;
accounts.forEach((a, i) => {
  const ev = a._event;
  let set = T[ev];
  if (ev === 'none' && i % 2 === 1) return; // only about half of quiet accounts file a ticket
  if (ev === 'none') set = [T.none[i % T.none.length]];
  if (ev === 'gone' || ev === 'down' || ev === 'back' || ev === 'grace') set = set.slice(0, ev === 'gone' ? 3 : 2);
  set.forEach(([category, summary], k) => {
    const opened = ticketDates[(i + k * 3) % ticketDates.length];
    tickets.push({ ticket_id: `T-${t++}`, account_id: a.account_id, opened, closed: opened, category, summary });
  });
});

const pack = {
  company: 'Ridgeway Dispatch',
  period: '1 July to 30 September',
  plans: PRICE,
  startingMrrInScope: accounts.filter(a => a._event !== 'new').reduce((s, a) => s + a.mrr_start, 0),
  accounts,
  tickets,
};
fs.writeFileSync(path.join(__dirname, 'pack.json'), JSON.stringify(pack, null, 2));
console.log(`accounts ${accounts.length}, in scope ${accounts.filter(a => a._event !== 'new').length}, tickets ${tickets.length}, starting MRR $${pack.startingMrrInScope}`);
