'use strict';
// Build gate for content: no placeholders, no seat brief carries another seat's floor.
const { publicBrief, seatBriefs, staffNotices, walkthrough } = require('../data/content');
let fails = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); if (!ok) fails++; };
// All string values in an object, joined; checks run on the words, not the JSON.
const strings = o => typeof o === 'string' ? [o] : Object.values(o).flatMap(strings);
const text = o => strings(o).join('\n');
const placeholder = /\bTODO\b|\bTBD\b|lorem|\[[^\]]*\]|\bXXX\b|\bundefined\b|\bNaN\b/;

check('No placeholders in public brief', !placeholder.test(text(publicBrief)));
for (const [k, b] of Object.entries(seatBriefs)) check(`No placeholders in ${k} brief`, !placeholder.test(text(b)));
check('No placeholders in staff notices', !placeholder.test(text(staffNotices)));
check('Four public walkthrough screens without placeholders or private floors', walkthrough.length === 4 && !placeholder.test(text(walkthrough)) && Object.values(seatBriefs).every(b => !text(walkthrough).includes(b.floor)));

// Floors must not leak: no brief contains another seat's floor sentence or its distinctive figure.
for (const [k, b] of Object.entries(seatBriefs)) {
  for (const [o, ob] of Object.entries(seatBriefs)) {
    if (o === k) continue;
    check(`${k} brief does not carry ${o}'s floor`, !text(b).includes(ob.floor));
  }
}
check('Public brief carries no seat floor', Object.values(seatBriefs).every(b => !text(publicBrief).includes(b.floor)));
check('No brief or walkthrough names a real utility, state, course or day', !/\bAEP\b|\bOhio\b|\bPUCO\b|\bMIS\b|semester|Monday|Tuesday|Wednesday|Thursday|Friday|[Uu]niversity/.test(text(publicBrief) + text(seatBriefs) + text(staffNotices) + text(walkthrough)));

console.log(fails ? `\n${fails} FAILED` : '\nAll content checks pass');
process.exit(fails ? 1 : 0);
