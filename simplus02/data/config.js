'use strict';
// Who Pays for the Wire? — RapidSim+ 02. All calibration lives here.
module.exports = {
  id: 'rapidsimplus-02',
  number: 102,
  dials: {
    top:       { label: 'Minimum take-or-pay (%)', short: 'Take-or-pay (%)', min: 50, max: 95, step: 5,   filed: 85 },
    term:      { label: 'Contract term (years)', short: 'Term (years)',   min: 5,  max: 15, step: 1,   filed: 12 },
    exit:      { label: 'Exit fee (years of minimum charges)', short: 'Exit fee (years)', min: 0, max: 5, step: 0.5, filed: 3 },
    coll:      { label: 'Collateral (months of minimum charges)', short: 'Collateral (months)', min: 0, max: 36, step: 6, filed: 24 },
    threshold: { label: 'Size threshold (MW)', short: 'Threshold (MW)',     min: 10, max: 100, step: 5,  filed: 25 },
  },
  // Dials that lock and are imposed together. Any open dial in a group imposes the whole group.
  settlementGroups: {
    money: ['top', 'term', 'exit', 'coll'],
    threshold: ['threshold'],
  },
  // Phase lengths in minutes. The instructor may extend negotiation once.
  timing: { briefing: 10, openings: 10, negotiation: 45, extension: 10, staleMinutes: 10 },
  fallback: {
    top: [90, 95], term: [14, 15], exit: [4, 5], coll: [30, 36], threshold: [10, 20],
    freezeMonthsPerOpenDial: [3, 4],
  },
  system: {
    buildCost: 1.2e9,
    buildCapacityMW: 6000,
    chargePerMWYear: 20000,
    horizonYears: 15,
    requestsMW: 30000,
    subscriptionK: 2.36,              // subscribed = requests * exp(-k * stringency)
    stringencyWeights: { top: 0.4, term: 0.2, exit: 0.2, coll: 0.2 },
    strandedSplit: { shareholders: 0.2, industrial: 0.3, residential: 0.5 },
    strandedRecoveryMonths: 60,
    freezeCarryingPerMonth: 8e6,
    freezeSplit: { shareholders: 0.5, residential: 0.4, industrial: 0.1 },
    households: 1.3e6,
    industrialAnnualBill: 9e8,
  },
  scenarios: {
    arrives: { arrival: 0.9, exitShare: 0,    exitYear: 3, defaultShare: 0,   defaultYear: 2 },
    misses:  { arrival: 0.35, exitShare: 0.25, exitYear: 3, defaultShare: 0.1, defaultYear: 2 },
  },
  seats: {
    utility:  { minBackingShare: 0.7, maxShareholderCost: 6e7, growthLossPerFreezeMonth: 3e6 },
    developer:{ campusMW: 300, covenantCap: 6.5e7, monthsToEnergise: 22, tenantDeadlineMonths: 30,
                tenantLossPenalty: 2e8, freezeCostPerMonth: 5e6 },
    manufacturers: { largestMemberPlantMW: 45, maxRateRise: 0.03, capturePenalty: 5e7,
                     expansionCostPerFreezeMonth: 2e6 },
    advocate: { maxMonthlyBillRise: 2 },
  },
};
