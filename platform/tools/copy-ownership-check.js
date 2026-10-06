#!/usr/bin/env node
// A simulation describes itself, but an administrator may rewrite that copy for
// their own audience. Theirs must survive every later redeploy, and clearing a
// field must hand it back.
const assert = require('node:assert/strict');
const DB = { sims:{ 'rapid-01-disaster':{ id:'rapid-01-disaster', title:'Disaster or Breach?', published:false,
  detail:{ world:'IT operations', teaches:'Sequencing under uncertainty', tangle:'From the simulation.' } } } };
require.cache[require.resolve(require('path').join(__dirname,'../lib/db.js'))]={exports:{
  sql: () => (st, ...v) => {
    const q = st.join('?').replace(/\s+/g,' ').trim();
    if (q.startsWith('SELECT detail FROM sims')) return Promise.resolve([DB.sims[v[0]]]);
    if (q.startsWith('SELECT * FROM sims WHERE id')) return Promise.resolve([DB.sims[v[0]]]);
    if (q.startsWith('UPDATE sims SET detail')) { DB.sims[v[1]].detail = JSON.parse(v[0]); return Promise.resolve([]); }
    if (q.startsWith('UPDATE sims SET launch_url')) return Promise.resolve([]);
    if (q.startsWith('UPDATE sims SET minutes')) return Promise.resolve([]);
    for (const field of ['tagline', 'description', 'title']) {
      if (q.startsWith('UPDATE sims SET ' + field)) { DB.sims[v[1]][field] = v[0]; return Promise.resolve([]); }
    }
    return Promise.resolve([]);
  }, id:p=>p, joinCode:()=>'X' }};
require.cache[require.resolve(require('path').join(__dirname,'../lib/auth.js'))]={exports:{
  requireRole:async()=>({id:'a',role:'admin'}), publicUser:u=>u }};
process.env.LAUNCH_SECRET='shared';
const admin = require(require('path').join(__dirname,'../api/admin.js'));
const register = require(require('path').join(__dirname,'../api/register.js'));
const { signBack } = require(require('path').join(__dirname,'../../sim/lib/launch.js'));
const call = (h,b) => new Promise(res => {
  const r={_c:200,status(c){this._c=c;return this;},json(d){res({status:this._c,body:d});},setHeader(){},end(){res({});}};
  h({method:'POST',body:b,headers:{}},r); });

(async () => {
  console.log('  as shipped        :', DB.sims['rapid-01-disaster'].detail.tangle);

  await call(admin, { action:'save_detail', id:'rapid-01-disaster',
    tagline:'Our class activity', description:'Our course description',
    preparation:'Read our class handout first.',
    tangle:'Rewritten by the administrator for a business-school audience.' });
  console.log('  after editing     :', DB.sims['rapid-01-disaster'].detail.tangle);
  console.log('  marked as theirs  :', DB.sims['rapid-01-disaster'].detail._edited.join(', '));

  await call(register, { token: signBack({ kind:'register', sim:'rapid-01-disaster',
    title:'Disaster or Breach?', launchUrl:'https://s1', minutes:20, exp:Date.now()+60000,
    detail:{ world:'IT operations', teaches:'Sequencing under uncertainty', tangle:'From the simulation.', turn:'New from the sim.' } }) });
  console.log('  after a redeploy  :', DB.sims['rapid-01-disaster'].detail.tangle);
  console.log('  and new fields    :', DB.sims['rapid-01-disaster'].detail.turn);
  const shown = require('../lib/catalogue').present(DB.sims['rapid-01-disaster']);
  assert.equal(shown.tagline, 'Our class activity');
  assert.equal(shown.description, 'Our course description');
  assert.equal(shown.detail.preparation, 'Read our class handout first.');
  assert.equal(shown.detail.tangle, 'Rewritten by the administrator for a business-school audience.');

  await call(admin, { action:'save_detail', id:'rapid-01-disaster', tangle:'' });
  console.log('  after clearing it :', DB.sims['rapid-01-disaster'].detail.tangle === undefined ? 'handed back to the simulation' : 'still set');
})();
