'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'public', 'client.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'app.css'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'public', 'flow.css'), 'utf8');
const launch = fs.readFileSync(path.join(root, 'lib', 'launch.js'), 'utf8');

assert.match(html, /window\.SIM_BASE/);
assert.match(html, /simplus\\d\+/);
assert.ok(html.includes("window.SIM_BASE + '/client.js"));
assert.doesNotMatch(html, /participant-tweaks\.js/, 'participant UI must live in the main client, not an observer shim');
assert.ok(html.includes("window.SIM_BASE + '/flow.css"));
assert.doesNotMatch(html, /rapidsim03\.observation/, 'observation must not be restored from browser storage');

assert.match(js, /id="question"/);
assert.match(js, /id="root"[^>]*minlength="15"/);
assert.match(js, /id="j-\$\{r\.id\}"[^>]*minlength="15"/);
assert.match(js, /meaningful characters/);
assert.match(js, /form\.requestSubmit\(\)/);

// Generic starters are participant-safe but appear only before the student's first question.
assert.match(js, /starters=\(state\.windowIndex===0&&state\.conversation\.length===0\)\?\(brief\.starters\|\|\[\]\):\[\]/);
assert.match(js, /data-starter/);
assert.match(js, /input\.value=starters\[Number\(btn\.dataset\.starter\)\]/, 'clicking a starter must populate rather than submit');
assert.doesNotMatch(js, /starters=brief\.starters\|\|\[\]/, 'starters must not remain visible after the first question');
assert.doesNotMatch(js, /Do providers receive confirmation that a claim arrived/i);
assert.doesNotMatch(js, /receipt log stopped/i);
assert.doesNotMatch(js, /Suggestions update as you ask/);
const interviewStart = js.indexOf('function renderInterview()');
const composerStart = js.indexOf('composer=`<div class="composer">', interviewStart);
const exitInComposer = js.indexOf('<div class="appointment-exit">', composerStart);
const renderCall = js.indexOf(';shell(2,head,content,composer)', composerStart);
assert.ok(interviewStart >= 0 && composerStart > interviewStart && exitInComposer > composerStart && exitInComposer < renderCall,
  'End interview must be rendered directly in the composer');

// Observation is 1x for participants. Speed controls exist only in explicit faculty/testing mode.
assert.match(js, /function isFaculty\(\)\{return brief\?\.faculty===true\}/);
assert.doesNotMatch(js, /urlParam\('faculty'\)/, 'query parameters must not grant faculty controls');
assert.match(js, /speedControls=faculty\?/);
assert.match(js, /if\(faculty\)document\.querySelectorAll\('\[data-observation-speed\]'\)/);
assert.match(js, /if\(!isFaculty\(\)\|\|!\[1,10,20,50\]\.includes\(next\)\)return/);
assert.match(js, /startObservationClock\(\)/);
assert.match(js, /observationStartedAt=Date\.now\(\)/);
assert.doesNotMatch(js, /id="preview-run"/);
assert.doesNotMatch(js, /Restart preview/i);
assert.doesNotMatch(js, /preview-bar/);
assert.match(js, /The batch is starting/);
assert.match(js, /When the batch is done, record what you think a claim takes/i);

// Participant has no instructor debrief/evidence screen.
assert.doesNotMatch(js, /Evidence you reached/);
assert.doesNotMatch(js, /feedback loop available/i);
assert.doesNotMatch(js, /Instructor run ID/i);
assert.doesNotMatch(js, /id="run-again"/);
assert.doesNotMatch(js, /Debrief/);
assert.match(js, /Configured outcome/);

// Remaining requested changes.
assert.match(js, /People/);
assert.doesNotMatch(js, /Interview sources/);
assert.doesNotMatch(js, /Not scheduled/);
assert.match(js, /Three appointments, fifteen minutes each\. No second visits\./);
assert.match(js, /Ruth is in a plan review mid-morning/);
assert.match(js, /Ray does not come off the floor until the second slot/);
assert.match(js, /Down the corridor, a fax machine is going/);
assert.match(js, /order-grid/);
assert.doesNotMatch(js, /Reshuffle members/);
assert.match(js, /Appointment spend ledger/);
assert.match(js, /ledger-spend/);
assert.match(js, /exchange-cost/);
assert.doesNotMatch(js, /STANDING TASK/i);
assert.doesNotMatch(js, /Use ['"]cannot assess['"] only/i);
assert.match(js, /What is actually going on here\?/);
assert.match(js, /Your completed chart records \$\{state\.observationSeconds\} seconds per claim/);
assert.match(js, /could not establish/i);
assert.match(js, /save_chart/);
assert.match(js, /Time per claim — your observation/);
assert.match(js, /As-is you documented/);
assert.match(js, /To-be the vendor configures/);
assert.match(js, /Exact-match rule/);
assert.match(js, /Undocumented judgment carried forward: —/);
assert.doesNotMatch(js, /CANNOT_ASSESS/);

// Catalogue registration is best-effort and retryable rather than a production error source.
assert.match(launch, /announced = null;/);
assert.match(launch, /announce deferred; platform registration timed out/);
assert.match(launch, /console\.warn\('announce deferred/);
assert.doesNotMatch(launch, /console\.error\('announce failed/);

assert.match(css, /\.question-starters/);
assert.match(css, /\.starter/);
assert.match(css, /\.order-grid/);
assert.match(css, /\.appointment-exit/);
assert.match(css, /\.composer-in>\.appointment-exit/);
assert.match(css, /\.editable-chart/);
assert.match(css, /\.compare-charts/);
assert.match(css, /\.observation-entry input\{[^}]*background:var\(--night\)[^}]*color:var\(--bone\)/);
assert.doesNotMatch(css, /pointer-events\s*:\s*none[^}]*textarea/i);
assert.match(css, /caret-color:var\(--amber\)/);
console.log('client contract: passed');
