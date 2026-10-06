#!/usr/bin/env node
// App links and invitations follow the request's address. Direct sim entry
// deliberately redirects to the canonical account host: its sign-in cookie
// cannot be read on a separate sim's Vercel origin.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SKIP = new Set(['.git', 'node_modules', 'docs', 'test', 'tests']);
// what a deployment address looks like
const HOSTS = /https?:\/\/[a-z0-9-]+\.(vercel\.app|flexee\.org)/gi;
const ENTRY_PAGE = /^(?:(sim|sim-02|sim-plus-01|sim0[3-9]|sim10)\/public\/(index|launch)|simplus02\/public\/(index|console))\.html$/;
const ACCOUNT_REDIRECT = /\blocation\.replace\(\s*(['"])https:\/\/rapidsims\.flexee\.org\/open\.html\?\1\s*\+\s*entry\.toString\(\)\s*\)/g;

function scan(root = ROOT) {
  const found = [];
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(js|html)$/.test(e.name)) continue;
      if (/\.env|README|OPERATIONS/.test(e.name)) continue;
      const rel = path.relative(root, p).split(path.sep).join('/');
      if (rel.startsWith('platform/tools/')) continue;         // examples in checks
      if (/\.(test|spec)\.js$/.test(e.name)) continue;
      if (rel.split('/').includes('tools') && /(^test-|-(check|fixture)\.js$)/.test(e.name)) continue;
      const s = fs.readFileSync(p, 'utf8');
      s.split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*|<!--|#)/.test(line)) return;           // a comment may cite one
        if (/placeholder=|\.env|example/i.test(line)) return;
        // Exempt only this exact redirect on a sim entry page. Other URLs on
        // the same line, including invitations, must still be caught.
        const appLine = ENTRY_PAGE.test(rel) ? line.replace(ACCOUNT_REDIRECT, '') : line;
        const hits = appLine.match(HOSTS);
        if (hits) found.push(`${rel}:${i + 1}  ${hits.join(', ')}`);
      });
    }
  }
  walk(root);
  return found;
}

if (require.main === module) {
  const found = scan();
  if (found.length) {
    found.forEach(f => console.log('  ' + f));
    console.error(`\n${found.length} hard-coded address${found.length === 1 ? '' : 'es'}. Links should follow the request.`);
    process.exitCode = 1;
  } else {
    console.log('address check: app links follow the request; direct entry uses the canonical account host');
  }
}
module.exports = { scan };
