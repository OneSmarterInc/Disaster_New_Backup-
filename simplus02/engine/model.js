'use strict';
const C = require('../data/config');

function norm(d, v) { const x = C.dials[d]; return (v - x.min) / (x.max - x.min); }

function subscribedMW(p) {
  const w = C.system.stringencyWeights;
  const s = w.top * norm('top', p.top) + w.term * norm('term', p.term) +
            w.exit * norm('exit', p.exit) + w.coll * norm('coll', p.coll);
  return C.system.requestsMW * Math.exp(-C.system.subscriptionK * s);
}

// Revenue recovered toward the build from data centres, one scenario.
function recovered(p, sc) {
  const S = C.system, mw = Math.min(subscribedMW(p), S.buildCapacityMW);
  const top = p.top / 100, c = S.chargePerMWYear;
  let active = 1, total = 0;
  for (let y = 1; y <= S.horizonYears; y++) {
    if (y === sc.defaultYear && sc.defaultShare) {
      total += sc.defaultShare * mw * top * c * (p.coll / 12);
      active -= sc.defaultShare;
    }
    if (y === sc.exitYear && sc.exitShare) {
      total += sc.exitShare * mw * top * c * p.exit;
      active -= sc.exitShare;
    }
    const billed = y <= p.term ? Math.max(sc.arrival, top) : sc.arrival;
    total += active * mw * billed * c;
  }
  return Math.min(total, S.buildCost);
}

function outcome(p, sc, freezeMonths = 0) {
  const S = C.system;
  const stranded = S.buildCost - recovered(p, sc);
  const freeze = freezeMonths * S.freezeCarryingPerMonth;
  const res = stranded * S.strandedSplit.residential + freeze * S.freezeSplit.residential;
  const ind = stranded * S.strandedSplit.industrial + freeze * S.freezeSplit.industrial;
  const sh  = stranded * S.strandedSplit.shareholders + freeze * S.freezeSplit.shareholders;
  return {
    subscribedMW: subscribedMW(p), stranded, freezeMonths,
    householdMonthly: res / (S.households * S.strandedRecoveryMonths),
    industrialRateRise: (ind / (S.strandedRecoveryMonths / 12)) / S.industrialAnnualBill,
    shareholderCost: sh, residentialCost: res, industrialCost: ind,
  };
}

function metrics(p, freezeMonths = 0) {
  const S = C.system, seats = C.seats;
  const mw = Math.min(subscribedMW(p), S.buildCapacityMW);
  const arr = outcome(p, C.scenarios.arrives, freezeMonths);
  const mis = outcome(p, C.scenarios.misses, freezeMonths);
  const d = seats.developer, top = p.top / 100;
  const obligation = d.campusMW * S.chargePerMWYear * top * (p.term + p.exit + p.coll / 12);
  return {
    arrives: arr, misses: mis,
    utilityBacking: mw * top * S.chargePerMWYear * p.term / S.buildCost,
    developerObligation: obligation,
    energiseMonth: d.monthsToEnergise + freezeMonths,
    captured: p.threshold <= seats.manufacturers.largestMemberPlantMW,
  };
}

function floors(p, freezeMonths = 0) {
  const m = metrics(p, freezeMonths), s = C.seats;
  return {
    utility: m.utilityBacking >= s.utility.minBackingShare &&
             m.misses.shareholderCost <= s.utility.maxShareholderCost,
    developer: m.developerObligation <= s.developer.covenantCap &&
               m.energiseMonth <= s.developer.tenantDeadlineMonths,
    manufacturers: !m.captured &&
               Math.max(m.arrives.industrialRateRise, m.misses.industrialRateRise) <= s.manufacturers.maxRateRise,
    advocate: m.misses.householdMonthly <= s.advocate.maxMonthlyBillRise,
  };
}

function payoffs(p, freezeMonths = 0) {
  const m = metrics(p, freezeMonths), s = C.seats;
  const avg = k => (m.arrives[k] + m.misses[k]) / 2;
  const d = s.developer;
  const devFreeze = m.energiseMonth > d.tenantDeadlineMonths ? d.tenantLossPenalty : freezeMonths * d.freezeCostPerMonth;
  return {
    utility: -avg('shareholderCost') - freezeMonths * s.utility.growthLossPerFreezeMonth,
    developer: -m.developerObligation - devFreeze,
    manufacturers: -avg('industrialCost') - (m.captured ? s.manufacturers.capturePenalty : 0)
                   - freezeMonths * s.manufacturers.expansionCostPerFreezeMonth,
    advocate: -avg('residentialCost'),
  };
}

function values(d) {
  const x = C.dials[d], out = [];
  for (let v = x.min; v <= x.max + 1e-9; v += x.step) out.push(Math.round(v * 100) / 100);
  return out;
}

function* grid() {
  for (const top of values('top')) for (const term of values('term'))
  for (const exit of values('exit')) for (const coll of values('coll'))
  for (const threshold of values('threshold')) yield { top, term, exit, coll, threshold };
}

// Expand open dials to every dial in their settlement group.
function imposedDials(open) {
  const out = new Set();
  for (const d of open) {
    const g = Object.values(C.settlementGroups).find(g => g.includes(d));
    for (const x of g) out.add(x);
  }
  return [...out];
}

// Expected payoffs when `open` dials go to the Commission. Freeze counts every imposed dial.
function expectedWithOpen(p, openDials) {
  const open = imposedDials(openDials);
  const F = C.fallback, [f0, f1] = F.freezeMonthsPerOpenDial;
  let combos = [[]];
  for (const d of open) {
    const next = [];
    for (const c of combos) for (const v of F[d]) next.push([...c, [d, v]]);
    combos = next;
  }
  const acc = { utility: 0, developer: 0, manufacturers: 0, advocate: 0 };
  let n = 0;
  for (const c of combos) for (const perDial of [f0, f1]) {
    const q = { ...p }; for (const [d, v] of c) q[d] = v;
    const po = payoffs(q, perDial * open.length);
    for (const k in acc) acc[k] += po[k]; n++;
  }
  for (const k in acc) acc[k] /= n;
  return acc;
}

module.exports = { imposedDials, subscribedMW, outcome, metrics, floors, payoffs, grid, values, expectedWithOpen };
