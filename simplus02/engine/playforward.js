'use strict';
// Plays final terms forward under both scenarios and writes one line per named person.
const C = require('../data/config');
const M = require('./model');

const money = x => x >= 1e9 ? `$${(x / 1e9).toFixed(2)} billion` : `$${Math.round(x / 1e6)} million`;

function personLines(m, sc, terms) {
  const o = m[sc], s = C.seats, d = s.developer;
  const shiftCut = o.industrialRateRise > s.manufacturers.maxRateRise;
  const recoveredShare = 1 - o.stranded / C.system.buildCost;
  return {
    advocate: `The Hammonds' bill rises by $${o.householdMonthly.toFixed(2)} a month for five years, to $${(142 + o.householdMonthly).toFixed(2)}.`,
    manufacturers: [
      `Industrial rates rise ${(o.industrialRateRise * 100).toFixed(1)}%.`,
      m.captured ? `At a ${terms.threshold} MW threshold, Linda's 38 MW plant falls inside the tariff.` : `Linda's plant stays outside the tariff.`,
      shiftCut ? `The third shift is cut.` : `All three shifts keep running.`,
    ].join(' '),
    developer: [
      m.energiseMonth <= d.tenantDeadlineMonths
        ? `Marcus's campus energises in month ${m.energiseMonth}, inside the tenant deadline.`
        : `Marcus's campus energises in month ${m.energiseMonth}. The tenant has already walked.`,
      m.developerObligation <= d.covenantCap
        ? `Halvorsen's obligation of ${money(m.developerObligation)} is inside the lender's cap.`
        : `Halvorsen's obligation of ${money(m.developerObligation)} breaks the lender's ${money(d.covenantCap)} cap.`,
    ].join(' '),
    utility: `Data centres pay for ${Math.round(recoveredShare * 100)}% of the build Dana Okafor signed off. ${o.stranded > 0 ? `${money(o.stranded)} is stranded and spread across shareholders and customers.` : 'Nothing is stranded.'}`,
  };
}

function playForward(result) {
  const m = M.metrics(result.terms, result.freezeMonths);
  return {
    terms: result.terms, imposed: result.imposed, freezeMonths: result.freezeMonths,
    subscribedMW: Math.round(M.subscribedMW(result.terms)),
    arrives: personLines(m, 'arrives', result.terms),
    misses: personLines(m, 'misses', result.terms),
  };
}

module.exports = { playForward };
