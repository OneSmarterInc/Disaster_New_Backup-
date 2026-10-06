#!/usr/bin/env node
// A load that failed and a list that is genuinely empty must not look the same.
// Showing "nothing here" when the truth is "could not ask" is how somebody
// concludes their students have disappeared, and there is no way back from it
// on screen.
//
// So: if a loader records a failure, the view must read that flag, and any retry
// button it wires must actually be rendered.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public');
let bad = 0;

for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.html'))) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8');

  // flags a loader sets on failure
  const flags = new Set([...s.matchAll(/(?:D|F)\.(\w*[Ff]ailed)\s*=\s*e\.message/g)].map(m => m[1]));
  for (const flag of flags) {
    // is it ever read where something is drawn?
    const reads = [...s.matchAll(new RegExp('(?:D|F)\\.' + flag + '\\b', 'g'))].length;
    // set, cleared on success, cleared by retry — three writes; anything read
    // by the view is more than that
    if (reads < 4) {
      bad++;
      console.log(`  ${f}: ${flag} is recorded but never shown — a failure looks like an empty list`);
    }
  }

  // retry buttons that are wired but never rendered
  const wired = new Set([...s.matchAll(/getElementById\('(\w*retry\w*)'\)/g)].map(m => m[1]));
  for (const id of wired) {
    if (!new RegExp('id="' + id + '"').test(s)) {
      bad++;
      console.log(`  ${f}: a handler waits for #${id}, which nothing renders`);
    }
  }
}

if (bad) { console.error(`\n${bad} place${bad === 1 ? '' : 's'} where a failure would pass for emptiness.`); process.exit(1); }
console.log('failure state check: every recorded failure is shown, every retry exists');
