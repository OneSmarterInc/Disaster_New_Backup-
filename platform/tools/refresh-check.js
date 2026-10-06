#!/usr/bin/env node
// Checking every known simulation: which are ready, which are misconfigured in
// a way that will fail in front of a class, and which have stopped answering.
// attention, and which have stopped answering.
process.env.LAUNCH_SECRET='shared';
const crypto=require('crypto');
const ours = crypto.createHash('sha256').update('shared').digest('hex').slice(0,8);
const DB={ sims:[{id:'rapid-01-disaster',title:'Disaster or Breach?',launch_url:'https://s1'},
                 {id:'rapid-02-relay',title:'What Did It Tell Them?',launch_url:'https://s2'},
                 {id:'rapid-03-recall',title:'Whose Defect Is It?',launch_url:'https://s3'}] };
require.cache[require.resolve(require('path').join(__dirname,'../lib/db.js'))]={exports:{
  sql:()=>()=>Promise.resolve(DB.sims), id:p=>p, joinCode:()=>'X' }};
require.cache[require.resolve(require('path').join(__dirname,'../lib/auth.js'))]={exports:{
  requireRole:async()=>({id:'a',role:'admin'}), publicUser:u=>u }};
const FEATURES=['launch-token','launch-mode','console-token','self-register','completion-report'];
const HEALTH={
  // current, and agreeing with the platform
  'https://s1/api/health':{ sim:'rapid-01-disaster',characters:'configured',launchSecret:'configured',
    launchSecretFingerprint:ours,sessions:'configured',platformUrl:'https://p',
    features:FEATURES, build:'abc1234 on main', registersAs:'https://p/sim01' },
  // misconfigured every way at once, and on a different build
  'https://s2/api/health':{ sim:'rapid-02-relay',characters:'configured',launchSecret:'configured',
    launchSecretFingerprint:'deadbeef',sessions:'MISSING',platformUrl:'MISSING (completions will not be reported)',
    features:FEATURES, build:'0000000 on main', registersAs:'https://p/sim02' }
};
process.env.VERCEL_GIT_COMMIT_SHA='abc1234567';
global.fetch=async(u)=>{ if(!HEALTH[u]) throw new Error('nope');
  return { ok:true, json:async()=>HEALTH[u] }; };
const h=require(require('path').join(__dirname,'../api/admin.js'));
new Promise(res=>{ const r={_c:200,status(c){this._c=c;return this;},json(d){res(d);}};
  h({method:'POST',body:{action:'refresh_sims'},headers:{}},r); })
.then(d=>d.results.forEach(r=>console.log(`  ${r.state.padEnd(16)} ${r.title.padEnd(26)} ${r.detail||''}`)));
