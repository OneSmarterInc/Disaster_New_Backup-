// Build gate, data and engine half. Exits non-zero on any failure.
const assert = require('assert');
const config = require('../data/config');
const sheets = require('../data/sheets');
const E = require('../engine/retention');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log(`  ok   ${name}`); }
  catch (e) { fail++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

console.log('Results');
const results = {};
for (const id of sheets.ids) {
  results[id] = E.compute(id).value;
  check(`sheet ${id} = ${config.expectedResults[id]}`, () => assert.strictEqual(results[id], config.expectedResults[id]));
}

console.log('Spread');
check('all five results distinct', () => assert.strictEqual(new Set(Object.values(results)).size, 5));
check(`spread >= ${config.minSpreadPoints} points`, () => {
  const v = Object.values(results);
  assert.ok(Math.max(...v) - Math.min(...v) >= config.minSpreadPoints);
});
check('first three in assignment order include top and bottom', () => {
  const first3 = config.assignmentOrder.slice(0, 3).map(id => results[id]);
  const v = Object.values(results);
  assert.ok(first3.includes(Math.max(...v)) && first3.includes(Math.min(...v)));
});

console.log('One line apart');
for (const a of sheets.ids) for (const b of sheets.ids) if (a < b) {
  check(`${a} vs ${b} differ in exactly one line`, () => {
    const la = sheets.sheetLines(a), lb = sheets.sheetLines(b);
    assert.strictEqual(la.length, lb.length);
    assert.strictEqual(la.filter((l, i) => l !== lb[i]).length, 1);
  });
}

console.log('Student payload leaks');
const secrets = [
  ...Object.values(sheets.reveal).flatMap(r => [r.department, r.purpose]),
  ...Object.values(config.expectedResults).map(v => v.toFixed(1) + '%'),
  '_event',
];
for (const id of sheets.ids) {
  const text = JSON.stringify(E.studentPayload(id));
  check(`payload ${id} carries only its own contested line`, () => {
    for (const other of sheets.ids) {
      const has = text.includes(sheets.contested[other]);
      assert.strictEqual(has, other === id, `contested line ${other} ${has ? 'present' : 'missing'}`);
    }
  });
  check(`payload ${id} has no department, purpose, result or event tag`, () => {
    for (const s of secrets) assert.ok(!text.includes(s), `leaked: "${s}"`);
  });
}

console.log('Materials');
const material = JSON.stringify(E.studentPayload('A')) + JSON.stringify(sheets);
check('no forbidden terms', () => {
  for (const t of config.forbiddenTerms) {
    assert.ok(!new RegExp(`\\b${t}\\b`, 'i').test(material), `found "${t}"`);
  }
});
check('no placeholders', () => {
  for (const p of config.placeholderPatterns) assert.ok(!new RegExp(p, 'i').test(material), `found /${p}/`);
});
check('sim id not retired', () => assert.ok(!config.retiredIds.includes(config.simId)));

console.log('Assignment and error check');
check('3 teams -> A, E, D', () => assert.deepStrictEqual(E.assignSheets(3), ['A', 'E', 'D']));
check('7 teams cycle -> ... A, E', () => assert.deepStrictEqual(E.assignSheets(7).slice(5), ['A', 'E']));
check('0 teams refused, 1 team allowed', () => { assert.throws(() => E.assignSheets(0)); assert.deepStrictEqual(E.assignSheets(1), ['A']); });
check('exact commit ok', () => assert.strictEqual(E.checkCommit('E', 69.6).status, 'ok'));
check('within tolerance ok', () => assert.strictEqual(E.checkCommit('E', 69.5).status, 'ok'));
check('outside tolerance flagged', () => assert.strictEqual(E.checkCommit('D', 77.5).status, 'mismatch'));
check('no number handled', () => assert.strictEqual(E.checkCommit('A', null).status, 'none'));

console.log('Derivations');
for (const id of sheets.ids) {
  check(`derivation ${id} ends in its result`, () => {
    const d = E.derivation(id);
    assert.ok(d[d.length - 1].endsWith(`${config.expectedResults[id].toFixed(1)}%.`));
  });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
