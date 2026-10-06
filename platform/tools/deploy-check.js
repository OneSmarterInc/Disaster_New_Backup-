#!/usr/bin/env node
// Nothing may switch off git deployments. With deploymentEnabled false a push
// never builds, and pressing Redeploy in the dashboard rebuilds whichever commit
// that deployment was already on — so a project can sit on an old build through
// any number of redeploys, and every check of its health reports the same thing.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
let bad = 0;

for (const dir of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!dir.isDirectory() || dir.name.startsWith('.') || dir.name === 'node_modules') continue;
  const f = path.join(ROOT, dir.name, 'vercel.json');
  if (!fs.existsSync(f)) continue;
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { bad++; console.log(`  ${dir.name}/vercel.json is not valid json`); continue; }

  if (cfg.git && cfg.git.deploymentEnabled === false) {
    bad++;
    console.log(`  ${dir.name}/vercel.json switches git deployments off`);
  }
}

if (bad) { console.error('\nA push would never reach these projects.'); process.exit(1); }
console.log('deploy check: no project blocks its own deployments');
