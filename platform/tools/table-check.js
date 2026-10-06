#!/usr/bin/env node
// A row with fewer cells than its header has columns shifts everything left and
// is invisible until you look at the rendered page.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'public');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
let bad = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8');
  // pair each thead with the rows that follow it, up to the next table
  const tables = s.split('<table>').slice(1);
  tables.forEach((t, i) => {
    const head = t.match(/<thead><tr>([\s\S]*?)<\/tr><\/thead>/);
    if (!head) return;
    const cols = (head[1].match(/<th/g) || []).length;
    const body = t.slice(t.indexOf('<tbody>'), t.indexOf('</tbody>'));
    // rows that are not colspan panels
    const rows = body.split('<tr').slice(1)
      .filter(r => !r.includes('colspan'));
    rows.forEach(r => {
      const cells = (r.match(/<td/g) || []).length;
      if (cells && cells !== cols) {
        bad++;
        console.log(`  ${f} table ${i + 1}: header has ${cols} columns, a row has ${cells}`);
      }
    });
  });
}
if (bad) { console.error(`\n${bad} row/header mismatch${bad === 1 ? '' : 'es'}.`); process.exit(1); }
console.log('column check: every row matches its header');

// A table that is not inside a scroll container will widen its card and push
// the page sideways — content disappears off the left edge, which is what
// happened when the action column was told never to wrap.
{
  let loose = 0;
  for (const f of files) {
    const s = fs.readFileSync(path.join(dir, f), 'utf8');
    const tables = (s.match(/<table>/g) || []).length;
    const wrapped = (s.match(/<div class="tablewrap"><table>/g) || []).length;
    if (tables !== wrapped) {
      loose += tables - wrapped;
      console.log(`  ${f}: ${tables - wrapped} table(s) not inside a .tablewrap`);
    }
  }
  if (loose) { console.error(`\n${loose} table(s) can overflow their card.`); process.exit(1); }
  console.log('overflow check: every table is contained');
}
