#!/usr/bin/env node
// Every dependency-free check in tools/ is discovered and run.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const run = (file) => {
  console.log(`\nCHECK ${file}`);
  const r = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
};
run(path.join(__dirname, '..', 'build.js'));
const checks = fs.readdirSync(__dirname).filter(f => f.endsWith('-check.js')).sort();
if (!checks.length) throw new Error('No checks discovered.');
for (const f of checks) {
  console.log(`\nCHECK ${f}`);
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}
console.log(`\nPASS: ${checks.length} check tools.`);
