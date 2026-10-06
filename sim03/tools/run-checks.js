#!/usr/bin/env node
// Every dependency-free check is discovered automatically. Browser integration
// is a separate REQUIRED CI job, not an optional pass hidden inside npm test.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
function run(file) {
  console.log(`\nCHECK ${file}`);
  const result = spawnSync(process.execPath, [path.join(root, file), ...(file === 'build.js' ? ['--static-only'] : [])], { stdio: 'inherit', cwd: root });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status || 1);
}
if (!process.argv.includes('--checks-only')) run('build.js');
const checks = fs.readdirSync(__dirname).filter(name => (name === 'check.js' || name.endsWith('-check.js')) && name !== 'team-runner-browser-check.js').sort();
if (!checks.length) throw new Error('No regression checks discovered.');
for (const name of checks) run(`tools/${name}`);
console.log(`\nPASS: ${checks.length} dependency-free check tools. Browser integration: npm run test:browser (required in CI).`);
