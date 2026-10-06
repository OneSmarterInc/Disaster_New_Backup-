'use strict';
const T = require('../engine/table');
const { playForward } = require('../engine/playforward');
const C = require('../data/config');
let fails = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); if (!ok) fails++; };
const throws = f => { try { f(); return false; } catch (e) { return e.code === 'REJECTED' || /table needs/.test(e.message); } };
const signAll = (st, dials) => { for (const d of dials) for (const s of T.SEATS) T.sign(st, s, d); };

// Seating
const p30 = T.planTables(30);
check('30 students: 7 tables', p30.length === 7);
check('30 students: everyone seated', p30.reduce((a, t) => a + Object.values(t).reduce((x, y) => x + y, 0), 0) === 30);
check('30 students: two seats doubled', p30.flatMap(t => Object.values(t)).filter(v => v === 2).length === 2);
check('Fewer than four rejected', throws(() => T.planTables(3)));
const p9 = T.planTables(9);
check('9 students: 2 tables, all seated', p9.length === 2 && p9.flatMap(t => Object.values(t)).reduce((a, b) => a + b) === 9);

// Opening state
let st = T.createTable('A1');
check('Sheet opens at filed proposal', Object.entries(C.dials).every(([d, x]) => st.dials[d] === x.filed));

// Moves and validation
T.move(st, 'developer', 'top', 70);
check('Move logged', st.log.at(-1).action === 'move' && st.log.at(-1).from === 85 && st.log.at(-1).to === 70);
check('Off-step value rejected', throws(() => T.move(st, 'developer', 'top', 72)));
check('Out-of-range value rejected', throws(() => T.move(st, 'developer', 'term', 20)));
check('Unknown seat rejected', throws(() => T.move(st, 'regulator', 'top', 70)));

// Signatures and group lock
signAll(st, ['top', 'term', 'exit']);
for (const s of ['utility', 'developer', 'manufacturers']) T.sign(st, s, 'coll');
check('Money group not locked at 15 of 16 signatures', !st.locked.money);
T.sign(st, 'advocate', 'coll');
check('Money group locks at 16 of 16', st.locked.money);
check('Lock logged', st.log.some(e => e.action === 'lock' && e.group === 'money'));
check('Locked dial cannot move', throws(() => T.move(st, 'utility', 'term', 10)));
check('Threshold still independent', !st.locked.threshold);

// Moving clears only that dial's signatures
T.sign(st, 'utility', 'threshold'); T.sign(st, 'advocate', 'threshold');
T.move(st, 'manufacturers', 'threshold', 50);
check('Move clears that dial’s signatures', st.signatures.threshold.length === 0);

// Unlock clears the group
T.unlock(st, 'advocate', 'money');
check('Unlock clears the group', !st.locked.money && ['top', 'term', 'exit', 'coll'].every(d => st.signatures[d].length === 0));

// Deadline: partial settlement
st = T.createTable('B2');
T.move(st, 'manufacturers', 'threshold', 50); signAll(st, ['threshold']);
T.sign(st, 'utility', 'top'); // money group left open
T.closeTable(st);
check('Closed sheet rejects moves', throws(() => T.move(st, 'utility', 'top', 60)));
check('Threshold settled stands', st.result.terms.threshold === 50 && st.result.settled.includes('threshold'));
check('Open money group imposed whole', ['top', 'term', 'exit', 'coll'].every(d => st.result.imposed.includes(d)));
check('Imposed values inside published ranges', ['top', 'term', 'exit', 'coll'].every(d => st.result.terms[d] >= C.fallback[d][0] && st.result.terms[d] <= C.fallback[d][1]));
check('Freeze 3–4 months per imposed dial', st.result.freezeMonths >= 12 && st.result.freezeMonths <= 16, `${st.result.freezeMonths} months`);

// Reproducible draw
const again = T.createTable('B2'); T.move(again, 'manufacturers', 'threshold', 50); signAll(again, ['threshold']); T.closeTable(again);
check('Same seed, same draw', JSON.stringify(again.result) === JSON.stringify(st.result));

// Full settlement: no freeze, nothing imposed
const ok = T.createTable('C3');
for (const [d, v] of Object.entries({ top: 80, term: 10, exit: 1, coll: 12, threshold: 50 })) T.move(ok, 'utility', d, v);
signAll(ok, T.DIALS); T.closeTable(ok);
check('Full settlement imposes nothing', ok.result.imposed.length === 0 && ok.result.freezeMonths === 0);

// Play-forward
const pf = playForward(ok.result);
const people = ['advocate', 'manufacturers', 'developer', 'utility'];
check('Both scenarios have a line for every person', ['arrives', 'misses'].every(sc => people.every(k => typeof pf[sc][k] === 'string' && pf[sc][k].length > 20)));
check('No NaN or undefined in outcome text', !/NaN|undefined/.test(JSON.stringify(pf)));
const pfBad = playForward(st.result);
check('Imposed money group costs Marcus his tenant', /walked/.test(pfBad.misses.developer));
console.log('\nSample (settled, demand misses):\n ' + Object.values(pf.misses).join('\n '));

console.log(fails ? `\n${fails} FAILED` : '\nAll table tests pass');
process.exit(fails ? 1 : 0);
