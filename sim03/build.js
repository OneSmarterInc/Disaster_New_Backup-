#!/usr/bin/env node
// RapidSim 03 ships committed source HTML. This build step is assertion-only:
// it never rewrites source files. It refuses deployment if student-facing
// ambiguity leaks, path-prefixing breaks, browser JavaScript does not parse,
// access gating regresses, or scenario/session contracts fail.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const S = require('./lib/scenario.js');

const read = (name) => fs.readFileSync(path.join(__dirname, 'public', name), 'utf8');
const index = read('index.html');
const instructor = read('instructor.html');
const launcher = read('launch.html');
const workspace = read('faculty-workspace.js');
const configApi = fs.readFileSync(path.join(__dirname, 'api', 'config.js'), 'utf8');

function refuse(message) {
  console.error('REFUSING:', message);
  process.exit(1);
}

const leaked = S.OUTCOME_KEYS.filter(k => index.includes(k));
if (leaked.length) refuse('outcome threshold names reached the student bundle: ' + leaked.join(', '));

for (const narrative of [
  'Report produced in a day.',
  'Four days down in the hottest week.',
  'Match it. You know which units are healthy',
  'Nothing to predict from.'
]) {
  if (index.includes(narrative)) refuse('future outcome copy reached the student bundle: ' + narrative);
}

if (index.includes('<h3>The wall</h3>')) {
  refuse('student bundle explains the allocation wall before the debrief');
}
for (const marker of ['${esc(o.band)}', '${esc(o.heat.band)}', '${esc(o.competitor.band)}']) {
  if (index.includes(marker)) refuse('grade-like outcome band label reached the student UI: ' + marker);
}

for (const marker of [
  'Continue to the second event',
  'Your outcome',
  'Print / save PDF',
  'nav({backOk:false})',
  'backOk:year===1',
  'function friendlyError(code,status)',
  'briefing packet before starting',
  'data-open-briefing',
  'Open briefing packet',
  "document.querySelectorAll('[data-open-briefing]')",
  "sessionStorage.getItem('m03-access')"
]) {
  if (!index.includes(marker)) refuse('required student conformance marker missing: ' + marker);
}

for (const raw of ['strategic_view_locked','year1_locked','year2_locked']) {
  if (!index.includes(raw)) refuse('friendly error mapping missing for: ' + raw);
}

if (!instructor.includes('Anonymous run ${i+1}')) {
  refuse('projector-friendly opening sentence cards are missing');
}
if (!instructor.includes("Heat wave middle starts at ≥")) {
  refuse('instructor calibration label does not describe the middle-band lower bound');
}

for (const [name, source] of [['student', index], ['instructor', instructor]]) {
  if (/fetch\s*\(\s*['"]\/api\//.test(source)) refuse(`${name} client contains an unprefixed /api fetch`);
  if (!source.includes("location.pathname.match(/^\\/sim-?\\d+/)")) {
    refuse(`${name} client is missing the simulation path-prefix detector`);
  }
}
if (!launcher.includes("location.pathname.match(/^\\/sim-?\\d+/)")) {
  refuse('launch router is missing the simulation path-prefix detector');
}
for (const marker of ['Access code','x-access-code',"sessionStorage.setItem('m03-access'","sessionStorage.removeItem('m03-access')",'/api/config']) {
  if (!launcher.includes(marker)) refuse('standalone access-code gate missing marker: ' + marker);
}
if (launcher.includes('if(remembered)verify()')) {
  refuse('access gate auto-submits remembered codes and can create a refresh loop');
}
if (launcher.includes('#code=')) {
  refuse('standalone access code must stay in sessionStorage rather than the URL fragment');
}
if (!configApi.includes('checkAccess(req, res)')) {
  refuse('public config bootstrap is not protected by the shared access guard');
}
if (index.includes("location.replace(BASE+'/')")) {
  refuse('student access failure automatically redirects to the gate and can loop');
}
if (!index.includes('Enter access code')) {
  refuse('student access failure does not offer a stable manual return to the gate');
}
if (!index.includes("location.assign(BASE+'/launch.html')")) {
  refuse('student access button does not target the explicit launch gate');
}

for (const marker of ['runSessionEntry','Run a facilitated session',"platform+'/api/launch?'","mode:'session'","LAUNCH.role==='faculty'"]) if (!index.includes(marker)) refuse('faculty session-entry marker missing: ' + marker);
for (const marker of [
  'Join a facilitated session', 'Waiting for team assignment', 'function safeToRerender()', 'Team mode · read-only',
  "if(S.session)await saveRun({reflection1:S.reflection1,reflection2:S.reflection2,done:true})",
  "C.buyers?.authored===false", "const committed=!!(S.viewCommitted||S.teamRun?.strategicView||S.year1Outcome)"
]) if (!index.includes(marker)) refuse('team/conformance student marker missing: ' + marker);
if (index.includes('id=\"teamName\"')) refuse('student team-name input returned; team allocation must stay instructor-managed');
for (const marker of ['m03-faculty-lt','Faculty authorization received from RapidSims.','async function renewFaculty()','captureDraft()','facultyRecovery']) if (!instructor.includes(marker)) refuse('faculty authorization persistence marker missing: ' + marker);
if (!launcher.includes("sessionStorage.setItem('m03-faculty-lt',token)")) refuse('launch router does not persist faculty authorization');
if (!index.includes("sessionStorage.setItem('m03-faculty-lt',LAUNCH_TOKEN)")) refuse('faculty play surface does not persist faculty authorization');
for (const marker of ['Resume session code', 'function startPresent()', 'dotcount', 'the annual cap is the wall'])
  if (!instructor.includes(marker)) refuse('instructor entry/debrief marker missing: ' + marker);
for (const marker of ['Auto split teams', 'Unassigned students', 'Team lead', 'All team results', 'Start session',
  'Advanced settings and instructor notes', 'Approved · not opened yet'])
  if (!workspace.includes(marker)) refuse('faculty workspace marker missing: ' + marker);
if (index.includes('Valuation pending authored rule')) refuse('unauthored buyer placeholder reached the student bundle');
if (index.includes('authored calibration does not yet define')) refuse('Year 3 calibration scaffolding reached the student bundle');
for (const marker of ['Briefing & exhibits','Your outcome','Overall result','Three-year consequence timeline','The portfolio that produced this','Your original view','Year 2 allocation','Cumulative portfolio','Three buyers','buyer-interest'])
  if (!index.includes(marker)) refuse('briefing/outcome-results marker missing: ' + marker);
for (const marker of ['Forty-one years old, profitable, and nobody thinks it is in trouble.','Four people, one budget.','Take the seat','One of the five lines has nobody speaking for it'])
  if (!index.includes(marker)) refuse('increment-1 story marker missing: ' + marker);
if (!index.includes('function overallOutcomeText()')) refuse('deterministic overall outcome synthesis missing');
for (const forbidden of ['Score:','Grade:','Rank:']) if (index.includes(forbidden)) refuse('grade-like final result leaked: ' + forbidden);
for (const marker of ['Exhibit 1 — Where the revenue comes from','Exhibit 6 — What the machines already know'])
  if (!S.publicConfig().briefing?.exhibits?.some(x => x.title === marker)) refuse('briefing data missing: ' + marker);
if (S.publicConfig().buyers?.authored !== true) refuse('buyer content is not marked authored');
if (!index.includes('data_no_room')) refuse('student final result does not recognize data_no_room');
for (const marker of ['function closingLessonHTML()','What this run was teaching you','In your run','d.yourRun','run-complete','closingLesson=done.closingLesson']) if (!index.includes(marker)) refuse('closing lesson marker missing: ' + marker);
const finishSource = fs.readFileSync(path.join(__dirname, 'api', 'finish.js'), 'utf8');
if (!finishSource.includes('buildClosingLesson(y1, y2, outcomes, lessonThresholds)')) refuse('server-authored dynamic closing lesson missing');
if (index.includes('Your largest cumulative commitment was')) refuse('run-specific closing prose leaked into student bundle before completion');
for (const marker of ['30 MIN','allocationConfirmation','usefulOpeningView','year3-stage','timeline-pair','may read it aloud in the debrief','buyer-room-link']) if (!index.includes(marker)) refuse('Increment 2 student marker missing: ' + marker);
if (S.META.minutes !== 30) refuse('Increment 2 catalogue duration is not 30 minutes');
if (index.includes('That imbalance was intentional')) refuse('simulation-design language leaked into the debrief');
if (index.includes('calibrationGap') || index.includes('unresolved_calibration')) refuse('resolved Year 3 calibration scaffolding remains in the student UI');
if (!instructor.includes('Data without room to run it')) refuse('instructor Year 3 distribution is missing data_no_room label');
if (!instructor.includes('Corven high / Ridge Hollow low')) refuse('instructor buyer debate finder is missing');
for (const marker of ['MAX $${C.lineMaximum}M / YEAR','The business model','function year2BreakdownHTML(','Year 1 + Year 2 split','advocate-reminder','may read it aloud in the debrief'])
  if (!index.includes(marker)) refuse('Increment 2 visibility follow-up marker missing: ' + marker);
for (const marker of ['Year 2 stops being quiet.','The CEO asks whether Midland can predict a failure before the truck rolls.','The decisions are over. Explain what you would defend or change.'])
  if (!index.includes(marker)) refuse('situation heading missing: ' + marker);
for (const old of ['Two events resolve in sequence.','You do not get another move.','Return to what you believed before the consequences.'])
  if (index.includes(old)) refuse('old moralizing/software heading remains: ' + old);

function checkScripts(name, source) {
  const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  if (!scripts.length) throw new Error(`${name}: no inline script found`);
  scripts.forEach((code, i) => new vm.Script(code, { filename: `${name}:script-${i + 1}` }));
}
try {
  checkScripts('index.html', index);
  checkScripts('instructor.html', instructor);
  checkScripts('launch.html', launcher);
  new vm.Script(workspace, { filename: 'faculty-workspace.js' });
} catch (e) {
  refuse('browser JavaScript does not parse: ' + e.message);
}

if (!process.argv.includes('--static-only')) {
  execFileSync(process.execPath, [path.join(__dirname, 'tools', 'run-checks.js'), '--checks-only'], { stdio: 'inherit' });
}
console.log('RapidSim 03 build guards passed.');
