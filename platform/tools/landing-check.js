#!/usr/bin/env node
// A facilitator arrives either to play a simulation or to run a class with it.
// Landing them in the wrong one wastes the twenty minutes they set aside.
process.env.LAUNCH_SECRET='shared';
const P = require(require('path').join(__dirname,'../lib/launch.js'));
const { verifyLaunch } = require(require('path').join(__dirname,'../../sim/lib/launch.js'));
const cases = [
  ['preview, to play',        { role:'faculty_preview', mode:'play' },    'the simulation'],
  ['a course, to play',       { role:'faculty', mode:'play' },            'the simulation'],
  ['a course, to run a class',{ role:'faculty', mode:'session' },         'the session console'],
  ['a student',               { role:'student', mode:'play' },            'the simulation'],
  ['a student cannot force it',{ role:'student', mode:'session' },        'the simulation']
];
let bad = 0;
for (const [label, o, expect] of cases) {
  const t = P.launchToken(Object.assign({ userId:'u', name:'Chuck', simId:'s' }, o));
  const p = verifyLaunch(t);
  const goesToConsole = (p.role === 'faculty' || p.role === 'faculty_preview') && p.mode === 'session';
  const got = goesToConsole ? 'the session console' : 'the simulation';
  const ok = got === expect;
  if (!ok) bad++;
  console.log(`  ${ok?'ok  ':'FAIL'} ${label.padEnd(28)} → ${got}`);
}
console.log(bad ? `\n${bad} wrong.` : '\nlanding: correct in every case');
process.exit(bad ? 1 : 0);