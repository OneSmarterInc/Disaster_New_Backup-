#!/usr/bin/env node
// An administrator gives one person early sight of an unpublished simulation.
// A link is made, their email is already in it, they choose a password, and they
// see that simulation until it is taken away. Nothing else changes for anyone.
// sets a password, signs in, sees exactly that simulation and nothing else,
// and loses it the moment access is revoked.
process.env.LAUNCH_SECRET='shared'; process.env.PUBLIC_BASE_URL='https://platform.test';
const DB = { users:{ adm:{ id:'adm', email:'a@t.com', name:'Vikram', role:'admin', password_hash:'x' } },
  sessions:{ s_adm:{ id:'s_adm', user_id:'adm' } }, tokens:{}, sims:{}, access:[], previews:{} };
let ID = 0; const nid = p => p+'_'+(++ID);

function sql(){ return (st, ...v) => {
  const q = st.join('?').replace(/\s+/g,' ').trim(); const R = x => Promise.resolve(x);
  if (q.includes('FROM sessions ses')) { const s=DB.sessions[v[0]]; return R(s?[DB.users[s.user_id]]:[]); }
  if (q.startsWith('INSERT INTO sessions')) { DB.sessions[v[0]]={id:v[0],user_id:v[1]}; return R([]); }
  if (q.includes('FROM users WHERE email')) { const u=Object.values(DB.users).find(x=>x.email===v[0]); return R(u?[u]:[]); }
  if (q.includes('FROM users WHERE id')) { const u=DB.users[v[0]]; return R(u?[u]:[]); }
  if (q.startsWith('INSERT INTO users')) { const lit=q.match(/'(faculty|student|admin)'/);
    DB.users[v[0]]={id:v[0],email:v[1],name:v[2],role:lit?lit[1]:v[3],password_hash:null,disabled:false}; return R([]); }
  if (q.startsWith('UPDATE users SET password_hash')) { DB.users[v[1]].password_hash=v[0]; return R([]); }
  if (q.startsWith('UPDATE users SET name')) { DB.users[v[1]].name=v[0]; return R([]); }
  if (q.startsWith('INSERT INTO tokens')) { DB.tokens[v[0]]={token:v[0],user_id:v[1],purpose:v[2],expires_at:v[3],used_at:null}; return R([]); }
  if (q.includes('FROM tokens t JOIN users')) { const t=DB.tokens[v[0]]; if(!t) return R([]);
    const u=DB.users[t.user_id]; return R([Object.assign({},t,{email:u.email,name:u.name,role:u.role})]); }
  if (q.startsWith('SELECT t.token, t.user_id')) { const t=DB.tokens[v[0]]; return R(t?[t]:[]); }
  if (q.startsWith('UPDATE tokens SET used_at')) { DB.tokens[v[0]].used_at=new Date(); return R([]); }
  if (q.startsWith('SELECT id, title, published FROM sims')) return R(DB.sims[v[0]]?[DB.sims[v[0]]]:[]);
  if (q.startsWith('INSERT INTO sim_access')) { DB.access.push({id:v[0],user_id:v[1],sim_id:v[2],note:v[4]}); return R([]); }
  if (q.startsWith('DELETE FROM sim_access WHERE id')) { DB.access=DB.access.filter(a=>a.id!==v[0]); return R([]); }
  if (q.startsWith('SELECT * FROM sims si WHERE si.published = true OR EXISTS')) {
    const uid=v[0]; return R(Object.values(DB.sims).filter(s=>s.published||DB.access.some(a=>a.sim_id===s.id&&a.user_id===uid))); }
  if (q.includes('FROM courses c WHERE c.faculty_id')) return R([]);
  if (q.includes('FROM previews WHERE user_id')) return R([]);
  return R([]);
}; }
require.cache[require.resolve(require('path').join(__dirname,'../lib/db.js'))]={exports:{ sql, id:nid, joinCode:()=>'X' }};
const A = require(require('path').join(__dirname,'../lib/auth.js'));
const admin = require(require('path').join(__dirname,'../api/admin.js'));
const auth = require(require('path').join(__dirname,'../api/auth.js'));
const faculty = require(require('path').join(__dirname,'../api/faculty.js'));

const call = (h, b, cookie) => new Promise(res => {
  let sc=null;
  const r={_c:200,status(c){this._c=c;return this;},json(d){res({status:this._c,body:d,cookie:sc});},
    setHeader(k,v){ if(k==='Set-Cookie') sc=String(v).split(';')[0]; }};
  h({method:'POST',body:b,headers:cookie?{cookie}:{},query:b||{}},r);
});

(async () => {
  DB.sims['rapid-02-relay']={ id:'rapid-02-relay', title:'What Did It Tell Them?', published:false, created_at:1 };
  DB.sims['rapid-01-disaster']={ id:'rapid-01-disaster', title:'Disaster or Breach?', published:true, created_at:0 };
  const AC='fx_sess=s_adm';

  console.log('1. Admin gives access by email');
  let r = await call(admin, { action:'grant_sim_access', simId:'rapid-02-relay',
    email:'reviewer@university.edu', name:'Priya Narayana', note:'reviewing before we ship' }, AC);
  console.log('   →', r.status, '| account created for', r.body.who, '| link made:', !!r.body.inviteUrl);
  const token = r.body.inviteUrl.split('t=')[1];

  console.log('2. The reviewer opens the link');
  r = await call(auth, { action:'invite_check', token });
  console.log('   → email shown, prefilled and locked:', r.body.email, '| name:', r.body.name);

  console.log('3. They set a password');
  r = await call(auth, { action:'invite_accept', token, password:'chooses-one' });
  const RC = r.cookie;
  console.log('   → signed in immediately as', r.body.user.role, '| session:', !!RC);

  console.log('4. What they can see');
  r = await call(faculty, { action:'overview' }, RC);
  console.log('   →', r.body.catalogue.map(x => x.title).join('  +  '));

  console.log('5. Somebody else, not granted, sees only what is published');
  DB.users.other={ id:'other', email:'o@t.com', name:'Other', role:'faculty', password_hash:'x' };
  DB.sessions.s_other={ id:'s_other', user_id:'other' };
  r = await call(faculty, { action:'overview' }, 'fx_sess=s_other');
  console.log('   →', r.body.catalogue.map(x => x.title).join('  +  '));

  console.log('6. Admin revokes it');
  const grantId = DB.access[0].id;
  await call(admin, { action:'revoke_sim_access', grantId }, AC);
  r = await call(faculty, { action:'overview' }, RC);
  console.log('   → the reviewer now sees:', r.body.catalogue.map(x => x.title).join('  +  ') || 'nothing beyond published');

  console.log('7. The link cannot be used twice');
  r = await call(auth, { action:'invite_check', token });
  console.log('   →', r.status, r.body.error);
})();
