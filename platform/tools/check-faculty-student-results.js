#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const facultyApi = fs.readFileSync(path.join(root, 'api', 'faculty.js'), 'utf8');
const facultyHtml = fs.readFileSync(path.join(root, 'public', 'faculty.html'), 'utf8');

assert(facultyApi.includes("case 'student_results':"), 'student_results faculty endpoint is missing');
assert(!facultyApi.includes('count(DISTINCT l.sim_id)'), 'student-wise starts still collapse repeated runs by simulation');
assert(!facultyApi.includes('count(DISTINCT c2.sim_id)'), 'student-wise finishes still collapse repeated runs by simulation');
assert(facultyApi.includes('AS started_runs'), 'per-simulation run-start count is missing');
assert(facultyApi.includes('AS finished_runs'), 'per-simulation run-finish count is missing');
assert(facultyApi.includes('AS completion_history'), 'student result history does not preserve repeated completions');
assert(facultyApi.includes('cp.summary, cp.metrics'), 'student results do not include completion summary/metrics');
assert(facultyApi.includes('tr.envelope AS transcript'), 'student results do not include available transcripts');
assert(facultyApi.includes("AND l.as_role = 'student'"), 'faculty/preview launches can leak into student counts');
assert(facultyHtml.split('async function openStudentResults(').length - 1 === 1, 'openStudentResults must be defined exactly once');
assert(facultyApi.includes("c2.course_id IS NULL AND EXISTS"), 'legacy null-course completions are not tied to a real course launch');

for (const marker of [
  '<th class="num">Started</th>',
  '<th class="num">Finished</th>',
  'data-student-results=',
  'function renderStudentResults()',
  "action:'student_results'",
  'Latest result from each simulation · every completed run is retained',
  'Runs started',
  'Runs finished',
  'All ${h.length} completed runs',
  'What came back'
]) {
  assert(facultyHtml.includes(marker), `faculty UI missing marker: ${marker}`);
}

// Parse every inline script so a template/edit cannot ship broken browser JS.
const scripts = [...facultyHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
assert(scripts.length > 0, 'faculty.html contains no inline script');
scripts.forEach((code, i) => new vm.Script(code, { filename: `faculty.html:script-${i + 1}` }));

console.log('Faculty student-wise progress/results checks passed.');
