#!/usr/bin/env node
// Registering a simulation should not require anyone to remember an id. The
// platform asks the deployment, and refuses to be quiet about a deployment that
// will reject the students we send it.
// quiet about a deployment that will reject our students.
process.env.LAUNCH_SECRET = 'shared';
const crypto = require('crypto');
const ours = crypto.createHash('sha256').update('shared').digest('hex').slice(0,8);

const DB = { sims: [{ id:'rapid-01-disaster', number:1, title:'Disaster or Breach?' }] };
require.cache[require.resolve(require('path').join(__dirname,'../lib/db.js'))] = { exports: {
  sql: () => (strings, ...v) => {
    const q = strings.join('?').replace(/\s+/g,' ');
    if (q.includes('WHERE id =')) return Promise.resolve(DB.sims.filter(s=>s.id===v[0]));
    if (q.includes('number IS NOT NULL')) return Promise.resolve(DB.sims.filter(s=>s.number));
    return Promise.resolve([]);
  }, id: p=>p+'_1', joinCode:()=>'X' }};
require.cache[require.resolve(require('path').join(__dirname,'../lib/auth.js'))] = { exports: {
  requireRole: async () => ({ id:'a', role:'admin' }), publicUser: u=>u }};

let HEALTH = {};
global.fetch = async () => ({ ok:true, status:200, json: async () => HEALTH });
const h = require(require('path').join(__dirname,'../api/admin.js'));
const call = b => new Promise(res => {
  const r={_c:200,status(c){this._c=c;return this;},json(d){res({status:this._c,body:d});}};
  h({method:'POST',body:b,headers:{}},r);
});

(async () => {
  HEALTH = { sim:'rapid-02-relay', characters:'configured', accessCode:'configured',
    sessions:'configured', launchSecret:'configured', launchSecretFingerprint: ours,
    platformUrl:'https://platform.test' };
  let r = await call({ action:'probe_sim', launchUrl:'https://sim2.test/' });
  console.log('  healthy new sim   :', r.status, '| id', r.body.id, '| suggests number', r.body.suggestedNumber,
              '| problems', r.body.problems.length);

  r = await call({ action:'probe_sim', launchUrl:'https://sim1.test' });
  HEALTH.sim = 'rapid-01-disaster';
  r = await call({ action:'probe_sim', launchUrl:'https://sim1.test' });
  console.log('  already known     :', r.status, '| existing', !!r.body.existing, '| keeps number', r.body.suggestedNumber);

  HEALTH = { sim:'rapid-03-x', characters:'MISSING', sessions:'MISSING',
    launchSecret:'configured', launchSecretFingerprint:'deadbeef', platformUrl:'MISSING (completions will not be reported)' };
  r = await call({ action:'probe_sim', launchUrl:'https://sim3.test' });
  console.log('  badly configured  :', r.status, '| problems:');
  r.body.problems.forEach(p => console.log('      ·', p));

  global.fetch = async () => { throw new Error('nope'); };
  r = await call({ action:'probe_sim', launchUrl:'https://nothing.test' });
  console.log('  unreachable       :', r.status, '|', r.body.message);

  r = await call({ action:'probe_sim', launchUrl:'not a url' });
  console.log('  not a url         :', r.status, '|', r.body.message);
})();
