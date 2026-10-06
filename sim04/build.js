#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const config = require('./data/config');
const sheets = require('./data/sheets');
const { META } = require('./lib/meta');
const root = __dirname;
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const pages = ['public/launch.html', 'public/platform-launch.js', 'public/index.html', 'public/student.js',
  'public/instructor.html', 'public/instructor.js', 'public/private-check.html', 'public/private-check.js'];
const word = term => new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');

function studentLeaks(value, ownSheetId) {
  const text = JSON.stringify(value);
  const faults = [];
  for (const [id, line] of Object.entries(sheets.contested)) {
    if (id !== ownSheetId && text.includes(line)) faults.push(`another sheet's contested line (${id})`);
  }
  for (const { department, purpose } of Object.values(sheets.reveal)) {
    if (word(department).test(text)) faults.push(`department ${department}`);
    if (text.includes(purpose)) faults.push(`purpose ${department}`);
  }
  if (/"(?:expectedResults|correct|checkCommit|sheetId|reveal)"\s*:/.test(text)) faults.push('private answer or reveal field');
  return faults;
}

// Words that tell a student the ending before they commit. Checked on the
// student bundle, the projected console and the public catalogue copy.
const SPOILERS = [/disagree/i, /different (?:definitions|answers|numbers|figures)/i, /valid definitions/i,
  /other (?:groups|teams)\W{0,2}\s*(?:defin|number)/i, /before (?:showing|revealing) (?:their|the) definitions/i,
  /definitions are revealed/i];
const STUDENT_ONLY = [/contested/i, /private sheet/i, /only your group/i];
function checkSpoilers(contents = Object.fromEntries(pages.map(p => [p, read(p)])), meta = META) {
  const problems = [];
  const student = ['public/launch.html', 'public/index.html', 'public/student.js'].map(p => contents[p] || '').join('\n');
  const projected = ['public/instructor.html', 'public/instructor.js'].map(p => contents[p] || '').join('\n');
  const catalogue = JSON.stringify({ tagline: meta.tagline, description: meta.description, detail: meta.detail });
  for (const [where, text, rules] of [['student bundle', student, [...SPOILERS, ...STUDENT_ONLY]],
    ['projected console', projected, SPOILERS], ['catalogue copy', catalogue, [...SPOILERS, ...STUDENT_ONLY]]]) {
    for (const rule of rules) if (rule.test(text)) problems.push(`spoiler in ${where}: ${rule}`);
  }
  return problems;
}

function checkSource(contents = Object.fromEntries(pages.map(p => [p, read(p)]))) {
  const problems = [];
  const publicText = ['public/launch.html', 'public/index.html', 'public/student.js'].map(p => contents[p] || '').join('\n');
  for (const [id, line] of Object.entries(sheets.contested)) if (publicText.includes(line)) problems.push(`student bundle contains sheet ${id}`);
  for (const { department, purpose } of Object.values(sheets.reveal)) {
    if (word(department).test(publicText) || publicText.includes(purpose)) problems.push(`student bundle contains ${department} reveal`);
  }
  for (const term of config.forbiddenTerms) if (word(term).test(publicText)) problems.push(`forbidden student term ${term}`);
  for (const p of config.placeholderPatterns) if (new RegExp(p, 'i').test(publicText)) problems.push(`placeholder in student bundle: ${p}`);
  for (const file of pages) {
    const source = contents[file] || '';
    if (!file.endsWith('public/platform-launch.js') && /fetch\s*\(\s*['"`]\/api\//.test(source)) {
      problems.push(`${file} has an unprefixed API URL`);
    }
    if (file.endsWith('.js')) { try { new vm.Script(source, { filename: file }); } catch (e) { problems.push(`${file} does not parse: ${e.message}`); } }
    else for (const [, script] of source.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      try { new vm.Script(script, { filename: file }); } catch (e) { problems.push(`${file} script does not parse: ${e.message}`); }
    }
  }
  return problems;
}

function checkWiring(overrides = {}) {
  const problems = [];
  if (config.retiredIds.includes(META.id) || META.id !== 'rapid-04-whose-number') problems.push('retired or incorrect sim identity');
  const vercel = overrides.vercel || JSON.parse(read('vercel.json'));
  if (vercel.git?.deploymentEnabled === false || vercel.git?.deploymentEnabled?.main !== true) problems.push('main deployment disabled');
  const env = overrides.env ?? read('.env.example');
  if (!/^SIM_URL=https:\/\/[^\s/]+\/sim04$/m.test(env)) problems.push('explicit SIM_URL missing');
  if (process.env.VERCEL && !/^https:\/\/[^/]+\/sim04$/.test(process.env.SIM_URL || '')) problems.push('Vercel SIM_URL must be set explicitly');
  if (/req\.headers\[['"](?:host|x-forwarded-host)['"]\]/.test(overrides.launch ?? read('lib/launch.js'))) problems.push('registration derives address from request host');
  const platform = overrides.platform || JSON.parse(read('../platform/vercel.json'));
  const routes = ['/sim04', '/sim04/', '/sim04/:path*'];
  const simRoutes = routes.map(route => platform.rewrites.find(r => r.source === route));
  const alias = simRoutes[0]?.destination?.replace(/\/launch\.html$/, '').replace(/\/$/, '');
  for (const [index, route] of routes.entries()) {
    const rewrite = simRoutes[index];
    if (!rewrite || !alias || !rewrite.destination.startsWith(alias + '/')) problems.push(`platform route missing: ${route}`);
  }
  if (!(overrides.sessionSims ?? read('../platform/lib/session-sims.js')).includes(META.id)) problems.push('platform session launch id missing');
  if (!(overrides.sessionEntry ?? read('../platform/public/session-entry.js')).includes(META.id)) problems.push('platform student session invite missing');
  if (!(overrides.catalogue || JSON.parse(read('../platform/lib/catalogue-source.json')))[META.id]) problems.push('catalogue detail missing');
  return problems;
}

module.exports = { studentLeaks, checkSource, checkSpoilers, checkWiring };
if (require.main === module) {
  const problems = [...checkSource(), ...checkSpoilers(), ...checkWiring()];
  if (problems.length) { console.error(`Build gate failed (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
  console.log('Build gate passed: student bundle, protected data, routes, and deployment wiring.');
}
