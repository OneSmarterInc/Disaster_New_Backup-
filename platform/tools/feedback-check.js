#!/usr/bin/env node
// Every action button must tell the user something happened.
//
// A handler that calls the API and then silently re-renders is
// indistinguishable from a broken button. Syntax, boot and wiring checks all
// pass on a button that says nothing, which is how this kept reaching the
// person using it.
const fs = require('fs');
const path = require('path');

// Pull out a handler body by matching braces rather than guessing where it ends.
function handlerBodies(js) {
  const out = [];
  const re = /onclick\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g;
  let m;
  while ((m = re.exec(js))) {
    let depth = 1, i = m.index + m[0].length;
    const start = i;
    while (i < js.length && depth > 0) {
      const c = js[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '`') { i++; while (i < js.length && js[i] !== '`') { if (js[i] === '\\') i++; i++; } }
      else if (c === "'" || c === '"') { const q = c; i++; while (i < js.length && js[i] !== q) { if (js[i] === '\\') i++; i++; } }
      i++;
    }
    out.push({ body: js.slice(start, i - 1), at: m.index });
  }
  return out;
}

const dir = path.join(__dirname, '..', 'public');
let bad = 0;

for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(dir, file), 'utf8');
  const i = html.indexOf('<script>');
  if (i < 0) continue;
  const js = html.slice(i + 8, html.lastIndexOf('</script>'));

  const silent = [];
  for (const h of handlerBodies(js)) {
    if (!/await api\(/.test(h.body)) continue;                 // navigation, not an action
    const acknowledges = /acting\(|flash\(|\.textContent\s*=|location\.href|location\.reload/.test(h.body);
    if (!acknowledges) {
      const first = h.body.split('\n').map(s => s.trim()).filter(Boolean)[0] || '';
      silent.push(first.slice(0, 72));
    }
  }
  if (silent.length) {
    bad += silent.length;
    console.log(`  ${file}`);
    silent.forEach(l => console.log(`      silent: ${l}…`));
  }
}
if (bad) {
  console.error(`\n${bad} action${bad === 1 ? '' : 's'} give the user nothing back.`);
  process.exit(1);
}
console.log('feedback check: every action acknowledges itself');
