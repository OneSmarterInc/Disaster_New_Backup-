'use strict';
// Student-facing text for Who Pays for the Wire? Numbers are read from config so text and engine never drift.
const C = require('./config');
const S = C.system, seats = C.seats, F = C.fallback;
const $m = x => `$${(x / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })} million`;
const $b = x => `$${(x / 1e9).toLocaleString('en-US', { maximumFractionDigits: 1 })} billion`;

const publicBrief = {
  title: 'Who Pays for the Wire?',
  paragraphs: [
    `Crestline Power is a regulated electric utility. Four years ago, data centres used about 100 MW of its system. Today they use about 600 MW, and requests to connect new ones total more than ${S.requestsMW.toLocaleString('en-US')} MW, which is more than Crestline's entire peak load.`,
    `Crestline has frozen new data-centre connections and asked the state Commission to approve new terms for very large customers. It has already begun a ${$b(S.buildCost)} transmission build to serve the requested load.`,
    `If a customer's load never arrives, the wire built for it still has to be paid for. This proceeding decides who pays: the data centres, Crestline's shareholders, industrial customers or households.`,
    `Four parties sit at the table. You represent one of them. You will negotiate five terms. Any term you cannot all sign by the deadline will be set by the Commission, and the Commission has told you, in general terms, what it will impose.`,
  ],
  commissionFallback: [
    `Minimum take-or-pay: ${F.top[0]}–${F.top[1]}% of subscribed capacity.`,
    `Contract term: ${F.term[0]}–${F.term[1]} years.`,
    `Exit fee: ${F.exit[0]}–${F.exit[1]} years of minimum charges.`,
    `Collateral: ${F.coll[0]}–${F.coll[1]} months of minimum charges.`,
    `Size threshold: ${F.threshold[0]}–${F.threshold[1]} MW.`,
    `Take-or-pay, term, exit fee and collateral are decided together. If any one of them is unsigned, the Commission sets all four.`,
    `Each term the Commission sets extends the connection freeze by ${F.freezeMonthsPerOpenDial[0]}–${F.freezeMonthsPerOpenDial[1]} months. The freeze costs about ${$m(S.freezeCarryingPerMonth)} a month, shared by Crestline's shareholders and every customer's bill.`,
  ],
};

const seatBriefs = {
  utility: {
    seat: 'Crestline Power',
    person: 'Dana Okafor',
    role: 'Planning engineer',
    story: `Dana signed off the ${$b(S.buildCost)} transmission build. If data centres sign contracts and then walk away, the wire sits there, and Dana is the one who has to explain to the Commission why it was built.`,
    constraint: `The build is committed. There is no other tariff through which Crestline can recover it.`,
    floor: `Contracted minimum payments from data centres must back at least ${Math.round(seats.utility.minBackingShare * 100)}% of the build, and the cost to shareholders if demand misses must stay under ${$m(seats.utility.maxShareholderCost)}.`,
    tension: `Terms that are too harsh will scare data centres off. A build backed by too few contracts is stranded anyway.`,
  },
  developer: {
    seat: 'Halvorsen Digital',
    person: 'Marcus Reyes',
    role: 'Project lead, 300 MW campus',
    story: `Marcus has an anchor tenant signed for the campus. The tenant walks if the site is not energised within ${seats.developer.tenantDeadlineMonths} months. Construction takes ${seats.developer.monthsToEnergise} months once connections reopen.`,
    constraint: `The tenant deadline cannot move.`,
    floor: `Halvorsen's total contingent obligation under the tariff must stay under the lender's covenant cap of ${$m(seats.developer.covenantCap)}.`,
    tension: `Every month of freeze eats into the time before the tenant deadline.`,
  },
  manufacturers: {
    seat: 'Industrial Energy Users',
    person: 'Linda Petrakis',
    role: 'Plant manager, 38 MW plant',
    story: `Linda runs a plant that works three shifts and employs 140 people. If industrial power costs rise too far, the third shift goes.`,
    constraint: `Three member plants, including Linda's, draw between 30 and ${seats.manufacturers.largestMemberPlantMW} MW.`,
    floor: `Industrial rates may rise no more than ${Math.round(seats.manufacturers.maxRateRise * 100)}% whether or not demand arrives, and no member plant may fall inside the tariff.`,
    tension: `You want data centres to carry their own risk, without the rules catching your members' plants too.`,
  },
  advocate: {
    seat: 'Office of the Consumer Advocate',
    person: 'Walt and Joyce Hammond',
    role: 'Retired, fixed income, $142 monthly bill',
    story: `The Hammonds cannot absorb a large increase. They did not ask for any of this load.`,
    constraint: `Your office represents residential customers only, by law.`,
    floor: `If demand misses, residential bills may rise by no more than $${seats.advocate.maxMonthlyBillRise} a month.`,
    tension: `Terms so harsh that data centres never subscribe leave the build stranded, and households pay for it anyway.`,
  },
};

const staffNotices = [
  { id: 'fallback', label: 'Reminder: fallback', text: `Commission staff remind the parties of the published fallback. Each term left unsigned extends the freeze by ${F.freezeMonthsPerOpenDial[0]}–${F.freezeMonthsPerOpenDial[1]} months.` },
  { id: 'closest', label: 'Question: closest term', text: `Commission staff ask: which group of terms is closest to agreement? Staff suggest locking it first.` },
  { id: 'onesentence', label: 'Question: one sentence each', text: `Commission staff ask each party to state, in one sentence, what it needs on one term of its choosing.` },
  { id: 'tenminutes', label: 'Notice: ten minutes', text: `Commission staff note that ten minutes remain. Terms left unsigned will be set by the Commission.` },
];

// Public orientation only. Private seat constraints arrive in the timed briefing.
const walkthrough = [
  { heading: 'What this proceeding decides', paragraphs: [
    'New data centres want electricity, and Crestline Power must build the wires to deliver it. Nobody knows how much of the promised demand will arrive. Your table must decide who carries that risk.',
    'Four parties share one table: the utility, a data-centre developer, industrial energy users, and a consumer advocate. You will receive your party’s private brief after the instructor starts the briefing.',
  ] },
  { heading: 'How the term sheet works', paragraphs: [
    'The sheet has five terms: minimum payment, contract length, exit fee, collateral, and the size threshold. During negotiation, any seat can change an open term. A change clears the signatures on that term.',
    'Each seat signs for itself. The four money terms lock together only when all four seats have signed every one of them. The size threshold locks separately. A seat can unlock a group to reopen it for discussion.',
  ] },
  { heading: 'What the deadline does', paragraphs: [
    'This walkthrough has no timer. Once everyone has finished and the room is seated, your instructor starts the timed briefing, opening statements, and negotiation.',
    'At the negotiation deadline, signed and locked groups stand. The Commission imposes every term in an unlocked group, and each imposed term adds three to four months to the connection freeze. Your instructor can add ten minutes once, or close the sheet early.',
  ] },
  { heading: 'What you see afterwards', paragraphs: [
    'You will see the terms your table ends with, which ones the Commission imposed, and how long the connection freeze continues.',
    'Then you will see what happens to all four parties in two possible futures: if the forecast demand arrives, and if it does not. During the debrief, your instructor can compare tables and reveal the real proceeding behind this simulation.',
  ] },
];

module.exports = { publicBrief, seatBriefs, staffNotices, walkthrough };
