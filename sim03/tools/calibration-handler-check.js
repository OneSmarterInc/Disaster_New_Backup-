#!/usr/bin/env node
const assert = require('node:assert/strict');
const store = require('../lib/store');
const S = require('../lib/scenario');
const session = require('../api/session'), outcome = require('../api/outcome'), finish = require('../api/finish');
const originalStore = { ...store }, env = { ...process.env };
const sessions = new Map(), participants = new Map(), runs = new Map();
const copy = x => x == null ? x : structuredClone(x);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let checks = 0, beforeCAS = null;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
store.configured = () => true;
store.getSession = async c => copy(sessions.get(c));
store.putSession = async (c, x) => sessions.set(c, copy(x));
store.getParticipants = async c => copy(participants.get(c) || {});
store.getRuns = async c => copy(runs.get(c) || {});
store.setRun = async (c, id, x) => runs.set(c, { ...(runs.get(c) || {}), [id]: copy(x) });
require('./roster-fixture').installRosterTransactions(store, sessions, participants);
const cas = store.compareAndSetSession;
store.compareAndSetSession = async (...args) => {
  if (beforeCAS) { const hook = beforeCAS; beforeCAS = null; await hook(); }
  return cas(...args);
};
store.compareAndSetRun = async (c, id, previous, next, sess, roster) => {
  if (!same(sessions.get(c), sess) || !same(participants.get(c) || {}, roster) ||
      !same((runs.get(c) || {})[id] || null, previous)) return false;
  runs.set(c, { ...(runs.get(c) || {}), [id]: copy(next) }); return true;
};
const faculty = { facultyCode: 'test-faculty' };
async function call(body, handler = session, headers = {}) {
  const r = { statusCode: 200, status(n) { this.statusCode=n; return this; }, json(x) { this.data=x; return this; }, end() {}, setHeader() {} };
  await handler({ method: 'POST', headers, body }, r); return { status: r.statusCode, body: r.data };
}
const old = { run:3, uptime:2, capacity:1, connect:2, features:1 };
const current = { run:4, uptime:2, capacity:1, connect:2, features:0 };
(async () => { try {
  process.env.FACULTY_CODE = 'test-faculty'; process.env.ACCESS_CODE='test-student';
  delete process.env.FACULTY_CODES; delete process.env.LAUNCH_SECRET; delete process.env.PLATFORM_URL;
  let r = await call({ action:'create', mode:'individual', ...faculty }); eq(r.status,200);
  const code=r.body.session.code; eq(r.body.session.thresholds.runFloor,4);
  r=await call({action:'join',code,participantId:'student',name:'Student'}); eq(r.status,200);
  eq(r.body.session.allocationRules.runMinimum,4); eq(r.body.session.thresholds,undefined,'private thresholds never enter participant state');
  const custom={budgetPerYear:10,runFloor:5};
  r=await call({action:'calibrate',code,thresholds:custom,...faculty}); eq(r.status,200);
  eq(r.body.session.thresholds.year3ConnectStrong,5,'partial edits preserve outcome thresholds');
  r=await call({action:'state',code,participantId:'student'}); eq(r.body.session.allocationRules.annualBudget,10); eq(r.body.session.allocationRules.runMinimum,5);
  const snapshot=copy(sessions.get(code));
  r=await call({action:'calibrate',code,thresholds:{runFloor:3},...faculty}); eq(r.status,400); eq(sessions.get(code),snapshot,'invalid edits do not alter storage');
  r=await call({action:'control',code,set:'start',...faculty}); eq(r.status,200);
  r=await call({action:'calibrate',code,thresholds:S.DEFAULT_THRESHOLDS,...faculty}); eq(r.status,409);
  r=await call({action:'submit',code,participantId:'student',strategicView:'Connect the service business.'}); eq(r.status,200);
  r=await call({action:'submit',code,participantId:'student',year1:current}); eq(r.status,400,'validation uses the saved $10M session, not global $9M defaults');
  const customA={...current,run:5};
  r=await call({action:'submit',code,participantId:'student',year1:customA}); eq(r.status,200);
  eq(r.body.run.year1,customA);
  // A start that wins before calibration's CAS must lock the edit and keep state running.
  r=await call({action:'create',mode:'individual',...faculty}); const raceCode=r.body.session.code;
  beforeCAS=async()=>{eq((await call({action:'control',code:raceCode,set:'start',...faculty})).status,200);};
  r=await call({action:'calibrate',code:raceCode,thresholds:custom,...faculty}); eq(r.status,409); eq(sessions.get(raceCode).state,'running'); eq(sessions.get(raceCode).thresholds.runFloor,4);
  // A calibration winning first is kept by a retried start, not overwritten.
  r=await call({action:'create',mode:'individual',...faculty}); const reverse=r.body.session.code;
  beforeCAS=async()=>{eq((await call({action:'calibrate',code:reverse,thresholds:custom,...faculty})).status,200);};
  r=await call({action:'control',code:reverse,set:'start',...faculty}); eq(r.status,200); eq(sessions.get(reverse).thresholds.runFloor,5);
  // Simulate a session persisted before these three rule fields existed.
  sessions.set('OLDER',{code:'OLDER',owner:'Facilitator',mode:'individual',state:'running',paused:false,thresholds:{year1ConnectStrong:2}});
  participants.set('OLDER',{legacy:{id:'legacy',name:'Legacy'}});
  r=await call({action:'submit',code:'OLDER',participantId:'legacy',strategicView:'Preserve my old decisions.'}); eq(r.status,200);
  r=await call({action:'submit',code:'OLDER',participantId:'legacy',year1:old}); eq(r.status,200,'old allocations remain legal after deployment');
  r=await call({action:'state',code:'OLDER',participantId:'legacy'}); eq(r.body.session.allocationRules.runMinimum,3); eq(r.body.run.year1,old);
  const headers={'x-access-code':'test-student'};
  for (const endpoint of [outcome,finish]) {
    const body={stage:'all',year1:old,year2:old};
    eq((await call(body,endpoint,headers)).status,200,'old standalone browser may complete');
    eq((await call({...body,calibrationId:S.CALIBRATION_ID},endpoint,headers)).status,400,'new standalone browser enforces floor 4');
    eq((await call({...body,year1:current,year2:current,calibrationId:S.CALIBRATION_ID},endpoint,headers)).status,200);
    r=await call({...body,calibrationId:'unknown'},endpoint,headers); eq(r.status,409); eq(r.body.error,'calibration_changed');
  }
  console.log(`Calibration handler checks passed (${checks} assertions: saved rules, legacy compatibility, private thresholds, invalid edits, start/edit races and both standalone endpoints).`);
} finally { Object.assign(store,originalStore); for(const k of ['FACULTY_CODE','ACCESS_CODE','FACULTY_CODES','LAUNCH_SECRET','PLATFORM_URL']) {if(env[k]===undefined) delete process.env[k];else process.env[k]=env[k];} }
})().catch(e=>{console.error(e);process.exitCode=1;});
