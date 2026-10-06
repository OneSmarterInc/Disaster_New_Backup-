#!/usr/bin/env node
// The catalogue editor must open on the sentences the public page is actually
// showing. An empty form makes an administrator invent copy; a filled one lets
// them correct it.
const { effective, FIELDS } = require(require('path').join(__dirname,'../lib/catalogue.js'));
console.log('  a simulation that sent nothing at all:');
const bare = effective(null);
FIELDS.forEach(f => {
  const v = bare[f.key];
  console.log(`    ${f.label.padEnd(28)} ${v ? '"' + String(v).slice(0,46) + '…"' : '(blank — the simulation must supply it)'}`);
});
console.log();
console.log('  one that described itself, with an administrator rewrite on top:');
const rich = effective({ world:'IT operations', teaches:'From the sim', tangle:'Rewritten by hand', _edited:['tangle'] });
console.log('    setting :', rich.world);
console.log('    teaches :', rich.teaches);
console.log('    hard    :', rich.tangle, '(marked as theirs:', rich._edited.join(', ') + ')');
console.log('    session :', rich.sessionShape.slice(0,40) + '…');
