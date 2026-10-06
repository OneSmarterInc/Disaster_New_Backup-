#!/usr/bin/env node
// Somebody sent here by the platform has already proved who they are. Asking
// for a facilitator code as well would demand something the platform never gave
// them — but a student token must still not open the console.
process.env.LAUNCH_SECRET = 'shared';
process.env.FACULTY_CODES = 'Chuck Rivera:chuck-2026';
const P = require(require('path').join(__dirname,'../../platform/lib/launch.js'));

const src = require('fs').readFileSync(require('path').join(__dirname,'../api/session.js'),'utf8');
// pull whoIsFaculty out and run it directly
const { verifyLaunch } = require(require('path').join(__dirname,'../lib/launch.js'));
const body = src.slice(src.indexOf('function facultyRoster'), src.indexOf('// A session belongs'));
const fn = new Function('verifyLaunch', 'process', body + '\n; return { whoIsFaculty };')(verifyLaunch, process);

const facTok = P.launchToken({ userId:'u1', name:'Chuck Rivera', role:'faculty', simId:'rapid-01' });
const stuTok = P.launchToken({ userId:'u2', name:'Ana Ruiz', role:'student', simId:'rapid-01' });

const t = (label, req, b, expect) => {
  const who = fn.whoIsFaculty(req, b);
  const got = who ? who.name : null;
  const ok = expect === null ? got === null : got === expect;
  console.log(`  ${ok?'ok  ':'FAIL'} ${label.padEnd(46)} ${got === null ? 'refused' : 'accepted as ' + got}`);
};
t('faculty arriving with a launch token', { headers:{ 'x-launch-token': facTok } }, {}, 'Chuck Rivera');
t('student token does not open the console', { headers:{ 'x-launch-token': stuTok } }, {}, null);
t('forged token refused', { headers:{ 'x-launch-token': facTok.slice(0,-3)+'zzz' } }, {}, null);
t('the facilitator code still works', { headers:{} }, { facultyCode:'chuck-2026' }, 'Chuck Rivera');
t('a wrong code is refused', { headers:{} }, { facultyCode:'nope' }, null);
t('nothing at all is refused', { headers:{} }, {}, null);

process.exit(0);
