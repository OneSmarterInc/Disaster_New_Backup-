// Current defaults are editable; the legacy snapshot is immutable compatibility
// data for sessions and standalone browsers opened before the floor-4 pilot.
const crypto = require('node:crypto');
const DEFAULT_THRESHOLDS = Object.freeze(require('../config/thresholds.json'));
const LEGACY_THRESHOLDS = Object.freeze(require('../config/legacy-thresholds.json'));
const RULE_KEYS = ['budgetPerYear', 'runFloor', 'perLineCap'];
const OUTCOME_KEYS = Object.keys(DEFAULT_THRESHOLDS).filter(k => !RULE_KEYS.includes(k));
const YEARS = 2;
const MAX_WINNING_RUNS = 20;
const MAX_SWEEP_RUNS = 250000;
const cache = new Map();
const fingerprint = t => crypto.createHash('sha256').update(JSON.stringify(t)).digest('hex').slice(0, 20);
const CALIBRATION_ID = fingerprint(DEFAULT_THRESHOLDS);
const isInteger = v => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isSafeInteger(Number(v));

function sanitizeThresholds(input, base = DEFAULT_THRESHOLDS) {
  const out = { ...base };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const key of Object.keys(DEFAULT_THRESHOLDS)) {
    if (Object.prototype.hasOwnProperty.call(input, key) && isInteger(input[key])) out[key] = Number(input[key]);
  }
  return out;
}

function sessionThresholds(session) {
  // Missing new rule fields mean a pre-pilot session, not permission to apply
  // today's defaults to its already-committed decisions. Never mutate storage.
  return sanitizeThresholds(session?.thresholds, LEGACY_THRESHOLDS);
}

function standaloneThresholds(id) {
  // Old open pages do not send an ID. Their original rules remain valid.
  if (!id || id === fingerprint(LEGACY_THRESHOLDS)) return { ...LEGACY_THRESHOLDS };
  if (id === CALIBRATION_ID) return { ...DEFAULT_THRESHOLDS };
  const e = new Error('The calibration has changed. Reopen the simulation before starting a new standalone run.');
  e.status = 409; e.code = 'calibration_changed'; throw e;
}

function publicRules(input = DEFAULT_THRESHOLDS) {
  const t = sanitizeThresholds(input);
  return {
    annualBudget: t.budgetPerYear, runMinimum: t.runFloor, lineMaximum: t.perLineCap,
    position: `You have $${t.budgetPerYear} million to allocate this year across five lines. Spend all $${t.budgetPerYear}M; you cannot borrow from next year. Run has a $${t.runFloor}M minimum. Each other line — Uptime, Capacity, Connect, and Features — has a $${t.perLineCap}M maximum per year.`
  };
}

function legalAllocations(t) {
  const out = [], cap = t.perLineCap, available = t.budgetPerYear - t.runFloor;
  for (let uptime = 0; uptime <= Math.min(cap, available); uptime++)
    for (let capacity = 0; capacity <= Math.min(cap, available - uptime); capacity++)
      for (let connect = 0; connect <= Math.min(cap, available - uptime - capacity); connect++)
        for (let features = 0; features <= Math.min(cap, available - uptime - capacity - connect); features++)
          out.push({ run: t.budgetPerYear - uptime - capacity - connect - features, uptime, capacity, connect, features });
  return out;
}

function analyzeCalibration(input = DEFAULT_THRESHOLDS) {
  const t = sanitizeThresholds(input), key = JSON.stringify(t);
  if (cache.has(key)) return structuredClone(cache.get(key));
  const allocations = legalAllocations(t);
  const totalRuns = allocations.length ** YEARS;
  if (totalRuns > MAX_SWEEP_RUNS) throw new Error('Calibration has too many legal runs to verify safely. Reduce the budget or per-line cap.');
  // Lazy import avoids a module initialization cycle. Use the actual engine,
  // not a second implementation of the outcome arithmetic.
  const S = require('./scenario.js');
  const counts = { year1: { strong: 0, middle: 0, weak: 0 }, heat: { strong: 0, middle: 0, weak: 0 },
    competitor: { strong: 0, middle: 0, weak: 0 }, year3: { strong: 0, data_no_room: 0, pilot: 0, weak: 0 } };
  let winningRuns = 0;
  for (const y1 of allocations) {
    const first = S.evaluateYear1(y1, t).band;
    for (const y2 of allocations) {
      const second = S.evaluateYear2(y1, y2, t), third = S.evaluateYear3(y1, y2, t).band;
      counts.year1[first]++; counts.heat[second.heat.band]++;
      counts.competitor[second.competitor.band]++; counts.year3[third]++;
      if (first === 'strong' && second.heat.band === 'strong' && second.competitor.band === 'strong' && third === 'strong') winningRuns++;
    }
  }
  const discretionary = YEARS * (t.budgetPerYear - t.runFloor);
  const needed = Math.max(t.year1ConnectStrong, t.competitorConnectStrong, t.year3ConnectStrong) + t.heatUptimeStrong + t.year3CapacityStrong;
  const result = { annualAllocations: allocations.length, totalRuns, winningRuns, discretionary, needed, slack: discretionary - needed, counts };
  if (cache.size >= 16) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return structuredClone(result);
}

function validateThresholds(input) {
  const t = sanitizeThresholds(input), errors = [];
  if (input != null && (typeof input !== 'object' || Array.isArray(input))) errors.push('Calibration must be an object.');
  for (const key of Object.keys(DEFAULT_THRESHOLDS)) {
    if (input && Object.prototype.hasOwnProperty.call(input, key) && !isInteger(input[key])) errors.push(`${key} must be a whole number.`);
  }
  if (t.budgetPerYear < 1 || t.budgetPerYear > 30) errors.push('Annual budget must be between 1 and 30.');
  if (t.runFloor < 0 || t.runFloor > t.budgetPerYear) errors.push('Run minimum must be between 0 and the annual budget.');
  if (t.perLineCap < 1 || t.perLineCap > 6) errors.push('Per-line cap must be between 1 and 6.');
  for (const key of OUTCOME_KEYS) if (t[key] < 0 || t[key] > YEARS * t.perLineCap) errors.push(`${key} is outside the reachable per-line range.`);
  if (t.year1ConnectStrong < 2 || t.year1ConnectStrong > t.perLineCap) errors.push('Year 1 strong Connect must leave both middle and strong outcomes reachable within the annual cap.');
  if (t.heatUptimeMiddle < 1 || t.heatUptimeMiddle >= t.heatUptimeStrong) errors.push('Heat-wave middle must start above zero and below the strong threshold.');
  for (const prefix of ['competitor', 'year3']) {
    if (t[`${prefix}ConnectPilotMin`] < 1 || t[`${prefix}ConnectPilotMin`] > t[`${prefix}ConnectPilotMax`]) errors.push(`${prefix} pilot minimum must be positive and cannot exceed its maximum.`);
    if (t[`${prefix}ConnectPilotMax`] !== t[`${prefix}ConnectStrong`] - 1) errors.push(`${prefix} pilot maximum must sit immediately below the strong threshold.`);
  }
  if (t.year3CapacityStrong < 1) errors.push('Year 3 strong Capacity must leave data-without-capacity reachable.');
  let analysis;
  if (!errors.length) {
    try {
      analysis = analyzeCalibration(t);
      if (analysis.slack > 0) errors.push('The budget can cover every top outcome with resources left over. Raise Run or adjust the thresholds.');
      if (analysis.winningRuns < 1 || analysis.winningRuns > MAX_WINNING_RUNS) errors.push(`All-top-outcome runs must be possible but rare (1–${MAX_WINNING_RUNS} legal runs).`);
      for (const [event, bands] of Object.entries(analysis.counts))
        for (const [band, count] of Object.entries(bands)) if (!count) errors.push(`${event}: ${band} is not reachable by a legal run.`);
    } catch (e) { errors.push(e.message); }
  }
  return errors.length ? { ok: false, error: 'invalid_thresholds', errors, thresholds: t }
    : { ok: true, thresholds: t };
}

module.exports = { DEFAULT_THRESHOLDS, LEGACY_THRESHOLDS, OUTCOME_KEYS, CALIBRATION_ID, YEARS, MAX_WINNING_RUNS,
  sanitizeThresholds, sessionThresholds, standaloneThresholds, publicRules, legalAllocations, analyzeCalibration, validateThresholds };
