#!/usr/bin/env node
'use strict';
// Build gate: refuses to ship if any suite fails, content leaks, or deployment config is unsafe.
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const C = require('../data/config');
const vm = require('node:vm');
let fails = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); if (!ok) fails++; };

for (const t of ['calibration', 'content', 'table', 'api', 'integration']) {
  try { execFileSync(process.execPath, [path.join(ROOT, 'test', `${t}.test.js`)], { stdio: 'pipe' }); check(`${t} suite`, true); }
  catch (e) { check(`${t} suite`, false, String(e.stdout || e.message).split('\n').filter(l => l.startsWith('FAIL')).join('; ')); }
}

const RETIRED = ['rapid-03-bench'];
check('Sim id is not a retired id', !RETIRED.includes(C.id), C.id);
check('Sim id is rapidsimplus-02', C.id === 'rapidsimplus-02' && C.number === 102);

const vj = path.join(ROOT, 'vercel.json');
const vercel = fs.existsSync(vj) ? JSON.parse(fs.readFileSync(vj, 'utf8')) : {};
check('vercel.json does not disable git deployments', !(vercel.git && vercel.git.deploymentEnabled === false) && vercel.deploymentEnabled !== false);

// Browser code must use prefix-relative API paths so the sim works under /simplus02.
for (const f of ['index.html', 'console.html']) {
  const src = fs.readFileSync(path.join(ROOT, 'public', f), 'utf8');
  try {
    for (const [, script] of src.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(script, { filename: f });
    check(`${f} scripts parse`, true);
  } catch (e) { check(`${f} scripts parse`, false, e.message); }
  check(`${f} uses relative API paths`, !/fetch\(\s*['"`]\/api/.test(src) && !/['"`]\/api\//.test(src));
  check(`${f} carries no seat floor`, Object.values(require('../data/content').seatBriefs).every(b => !src.includes(b.floor)));
}
try { new vm.Script(fs.readFileSync(path.join(ROOT, 'public/common.js'), 'utf8')); check('common.js parses', true); }
catch (e) { check('common.js parses', false, e.message); }

if (process.env.VERCEL_ENV === 'production' && !process.env.SIM_URL) check('SIM_URL set for production', false, 'set SIM_URL; never derive it from the request host');

const reveal = require('../data/reveal');
if (!reveal.verified) console.log('WARN  Reveal figures not yet verified against the order. Set verified: true in data/reveal.js before publication.');

console.log(fails ? `\nBuild gate: ${fails} FAILED` : '\nBuild gate: pass');
process.exit(fails ? 1 : 0);
