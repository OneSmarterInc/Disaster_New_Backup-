#!/usr/bin/env node
// Review access should work whether or not the reviewer already has an account,
// and should hand back something the administrator can actually send.
process.env.PUBLIC_BASE_URL = 'https://platform.test';
const DB = { users:{ u1:{ id:'u1', email:'chuck@t.com', name:'Chuck Rivera', role:'faculty', password_hash:'x' } },
             sims:{ 'rapid-02-relay':{ id:'rapid-02-relay', title:'What Did It Tell Them?', published:false } },
             access:[], tokens:[] };
require.cache[require.resolve(require('path').join(__dirname,'../lib/db.js'))] = { exports: {
  sql: () => (strings, ...v) => {
    const q = strings.join('?').replace(/\s+/g,' ').trim();
    if (q.startsWith('SELECT id, title, published FROM sims')) return Promise.resolve(DB.sims[v[0]]?[DB.sims[v[0]]]:[]);
    if (q.includes('FROM users WHERE email')) { const u=Object.values(DB.users).find(x=>x.email===v[0]); return Promise.resolve(u?[u]:[]); }
    if (q.startsWith('INSERT INTO users')) { const lit=q.match(/'(faculty|student|admin)'/);
      DB.users[v[0]]={id:v[0],email:v[1],name:v[2],role:lit?lit[1]:v[3],password_hash:null}; return Promise.resolve([]); }
    if (q.startsWith('INSERT INTO tokens')) { DB.tokens.push({token:v[0],user:v[1]}); return Promise.resolve([]); }
    if (q.startsWith('INSERT INTO sim_access')) { DB.access.push({user:v[1],sim:v[2],note:v[4]}); return Promise.resolve([]); }
    return Promise.resolve([]);
  }, id: p => p+'_'+Math.random().toString(36).slice(2,6), joinCode:()=>'X' }};
require.cache[require.resolve(require('path').join(__dirname,'../lib/auth.js'))] = { exports: {
  requireRole: async () => ({ id:'adm', role:'admin' }), publicUser: u=>u }};
const h = require(require('path').join(__dirname,'../api/admin.js'));
const call = b => new Promise(res => {
  const r={_c:200,status(c){this._c=c;return this;},json(d){res({status:this._c,body:d});}};
  h({method:'POST',body:b,headers:{}},r);
});
(async () => {
  let r = await call({ action:'grant_sim_access', simId:'rapid-02-relay', email:'chuck@t.com', note:'reviewing' });
  console.log('  existing facilitator:', r.status, '| who', r.body.who, '| needs an invite:', r.body.isNew);
  console.log('    they sign in at:', r.body.signInUrl);

  r = await call({ action:'grant_sim_access', simId:'rapid-02-relay', email:'new@t.com', name:'Priya Narayana', note:'second opinion' });
  console.log('  somebody with no account:', r.status, '| who', r.body.who, '| needs an invite:', r.body.isNew);
  console.log('    invitation:', (r.body.inviteUrl||'').slice(0,46) + '…');
  console.log('    account created as:', DB.users[Object.keys(DB.users).find(k=>DB.users[k].email==='new@t.com')].role);

  r = await call({ action:'grant_sim_access', simId:'rapid-02-relay', email:'' });
  console.log('  no email given:', r.status, r.body.error);

  DB.users.s1 = { id:'s1', email:'ana@t.com', name:'Ana', role:'student', password_hash:'x' };
  r = await call({ action:'grant_sim_access', simId:'rapid-02-relay', email:'ana@t.com' });
  console.log('  a student:', r.status, '|', r.body.message);

  console.log('  grants recorded:', DB.access.length);
})();
