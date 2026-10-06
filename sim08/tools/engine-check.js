#!/usr/bin/env node
// Walks every six-question spend (8,008 of them) against every vendor and every
// plan, and asserts the agreed rules hold for all of them.
const assert = require('node:assert/strict');
const C = require('../config/content.js');
const E = require('../lib/engine.js');

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

function* choose(arr, k, start = 0, pick = []) {
  if (pick.length === k) { yield pick.slice(); return; }
  for (let i = start; i <= arr.length - (k - pick.length); i++) { pick.push(arr[i]); yield* choose(arr, k, i + 1, pick); pick.pop(); }
}
const ids = C.QUESTIONS.map(q => q.id);
const diligence = C.QUESTIONS.filter(q => q.group === 'diligence').map(q => q.id);
const plans = [...E.PLAN_KEYS, null];
const seen = { kestrel: new Set(), tailwind: new Set(), pawtime: new Set() };
let spends = 0;

for (const spend of choose(ids, C.QUESTION_BUDGET)) {
  spends++;
  const allDiligence = spend.every(id => diligence.includes(id));
  for (const vendor of E.VENDOR_KEYS) {
    const r = E.routesFor(vendor, spend);
    const f = E.found(vendor, spend);
    eq(f, r.direct.length >= 1 || r.partial.length >= 2, `found rule for ${vendor} ${spend}`);
    if (allDiligence) ok(!f, `diligence-only spend found ${vendor}'s risk: ${spend}`);
    for (const plan of plans) {
      const out = E.report({ vendor, boardChose: false, questionIds: spend, plan });
      const m = E.planMatches(vendor, plan);
      eq(out.tier, f && m ? 'adopted' : m ? 'lucky' : f ? 'knew' : 'shadow', 'tier grid');
      seen[vendor].add(out.tier);
      ok(out.text.includes(C.REPORTS[vendor][out.tier].text), 'report text is the authored cell');
      eq(out.text.includes(C.REPORT_NOTES.parallel), plan === 'parallel' && out.tier !== 'adopted', 'parallel note only for the decoy');
      eq(out.text.includes(C.REPORT_NOTES.noPlan), plan === null, 'no-plan note only when nothing was funded');
      for (const w of Object.values(C.DEBRIEF.tierLabels)) ok(!out.text.includes(w), 'no tier label in a report');
      ok(!/\bscore|\brank/i.test(out.text), 'no scoring language in a report');
    }
  }
}
eq(spends, 8008, 'every six-of-sixteen spend walked');
for (const v of E.VENDOR_KEYS) eq([...seen[v]].sort(), ['adopted', 'knew', 'lucky', 'shadow'], `${v} reaches all four outcomes`);

// Same vendor, different landings: the debrief's disagreement.
const a = E.report({ vendor: 'tailwind', boardChose: false, questionIds: ['q11', 'q01', 'q02', 'q03', 'q04', 'q06'], plan: 'owner' });
const b = E.report({ vendor: 'tailwind', boardChose: false, questionIds: ['q01', 'q02', 'q03', 'q04', 'q06', 'q08'], plan: 'parallel' });
eq([a.tier, b.tier], ['adopted', 'shadow'], 'same vendor, opposite landings');
eq(E.disagreement([{ vendor: 'tailwind', tier: 'adopted', label: 'Team A' }, { vendor: 'tailwind', tier: 'shadow', label: 'Team B' }, { vendor: 'kestrel', tier: 'knew', label: 'Team C' }]).a, 'Team A', 'disagreement pair found');
eq(E.disagreement([{ vendor: 'tailwind', tier: 'knew', label: 'A' }, { vendor: 'kestrel', tier: 'knew', label: 'B' }]), null, 'no pair when nobody shares a vendor');

// Votes.
eq(E.decideVendor(['kestrel', 'kestrel', 'tailwind']), { vendor: 'kestrel', boardChose: false, counts: { kestrel: 2, tailwind: 1 } }, 'majority');
eq(E.decideVendor(['kestrel', 'tailwind']).vendor, 'tailwind', 'tie goes to the cheaper tied vendor');
eq(E.decideVendor(['kestrel', 'tailwind']).boardChose, true, 'tie is the board choosing');
eq(E.decideVendor([]).vendor, 'pawtime', 'no votes: board picks the cheapest');
eq(E.decidePlan(['cover', 'owner']).plan, null, 'plan tie funds nothing');
eq(E.decidePlan(['owner', 'owner', 'cover']).plan, 'owner', 'plan majority');
ok(E.report({ vendor: 'pawtime', boardChose: true, questionIds: [], plan: null }).text.startsWith(C.REPORT_NOTES.boardChose), 'board note leads the report');

// Clock.
const c = C.CLOCK;
eq(E.phaseAt(0).phase, 'briefing', 'starts in briefing');
eq(E.phaseAt(c.briefingSeconds).phase, 'demos', 'demos after briefing');
eq(E.phaseAt(c.briefingSeconds + c.demoSeconds).phase, 'questions', 'questions after demos');
eq(E.phaseAt(E.phaseStart('commit')).phase, 'commit', 'commit after questions');
eq(E.phaseAt(E.phaseStart('plan') + c.planSeconds).phase, 'report', 'report after plan');
eq(E.phaseAt(1e9).phase, 'report', 'report never closes on its own');
eq(E.phaseStart('report'), 1020, 'seventeen minutes on the clock');

console.log(`PASS engine-check: ${n} assertions over ${spends} spends x 3 vendors x ${plans.length} plans`);
