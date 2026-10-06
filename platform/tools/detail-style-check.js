#!/usr/bin/env node
// every page rendering it loads. Otherwise the markup is right, the content is
// all there, and it looks like a dump of text — which is what the faculty
// console did.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'public');

const renderer = fs.readFileSync(path.join(dir, 'sim-detail.js'), 'utf8');
const emitted = new Set();
[...renderer.matchAll(/class="([a-z0-9 _-]+)"/g)].forEach(m =>
  m[1].split(/\s+/).filter(Boolean).forEach(c => emitted.add(c)));

let bad = 0;
for (const page of ['index.html', 'faculty.html']) {
  const html = fs.readFileSync(path.join(dir, page), 'utf8');
  if (!/simDetailHTML\(/.test(html)) continue;

  // everything this page's styling comes from
  let css = (html.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
  for (const m of html.matchAll(/<link rel="stylesheet" href="\/([\w.-]+)"/g)) {
    const f = path.join(dir, m[1]);
    if (fs.existsSync(f)) css += '\n' + fs.readFileSync(f, 'utf8');
  }

  const missing = [...emitted].filter(c =>
    !new RegExp('\\.' + c.replace(/[-]/g, '\\-') + '\\s*[,{:. >]').test(css));
  if (missing.length) {
    bad += missing.length;
    console.log(`  ${page}: no styling for ${missing.join(', ')}`);
  }
}

if (bad) { console.error('\nThe page would render unstyled.'); process.exit(1); }
console.log('detail styling: every class the renderer emits is styled on every page that uses it');
