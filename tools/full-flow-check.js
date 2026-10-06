#!/usr/bin/env node
// The whole platform-to-simulation chain in one run, against an in-memory
// database: registration, invitation, review access, enrolment, entitlement,
// launch tokens both simulations verify, and completions returning.
//
// Run from the repository root: node tools/full-flow-check.js
// sims, a student enrols, access is released, each sim is launched, each reports
// a completion, and the faculty view shows it. Real handler code, fake database.
const path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.LAUNCH_SECRET = 'shared';
process.env.PUBLIC_BASE_URL = 'https://platform.test';

const DB = { users:{}, tokens:{}, sessions:{}, sims:{}, previews:{}, courses:{},
             course_sims:[], enrolments:{}, launches:[], completions:[], sim_access:[] };
let ID = 0;
const nid = p => p + '_' + (++ID);

// A deliberately small SQL stand-in: match on the distinctive part of each query.
function sql() {
  return (strings, ...v) => {
    const q = strings.join('?').replace(/\s+/g,' ').trim();
    const R = (x) => Promise.resolve(x);

    if (q.startsWith('INSERT INTO users')) {
      // role may be a literal in the statement rather than a parameter
      const lit = q.match(/'(admin|faculty|student)'/);
      const role = lit ? lit[1] : v[3];
      const pw = q.includes('password_hash') ? (lit ? v[3] : v[4]) : null;
      DB.users[v[0]] = { id:v[0], email:v[1], name:v[2], role, password_hash:pw||null,
        institution: lit ? (v[4]||null) : (v[5]||null), disabled:false };
      return R([]); }
    if (q.startsWith('SELECT id, role FROM users WHERE email')) { const u=Object.values(DB.users).find(x=>x.email===v[0]); return R(u?[u]:[]); }
    if (q.includes('FROM users WHERE email') ) { const u=Object.values(DB.users).find(x=>x.email===v[0]); return R(u?[u]:[]); }
    if (q.includes('FROM users WHERE id')) { const u=DB.users[v[0]]; return R(u?[u]:[]); }
    if (q.startsWith('INSERT INTO tokens')) { DB.tokens[v[0]]={token:v[0],user_id:v[1],purpose:v[2],expires_at:v[3],used_at:null}; return R([]); }
    if (q.includes('FROM tokens t JOIN users')) { const t=DB.tokens[v[0]]; if(!t) return R([]); const u=DB.users[t.user_id]; return R([{...t, email:u.email, name:u.name, role:u.role}]); }
    if (q.startsWith('SELECT t.token, t.user_id')) { const t=DB.tokens[v[0]]; return R(t?[t]:[]); }
    if (q.startsWith('UPDATE users SET password_hash')) { DB.users[v[1]].password_hash=v[0]; return R([]); }
    if (q.startsWith('UPDATE tokens SET used_at')) { DB.tokens[v[0]].used_at=new Date(); return R([]); }
    if (q.startsWith('INSERT INTO sessions')) { DB.sessions[v[0]]={id:v[0],user_id:v[1]}; return R([]); }
    if (q.includes('FROM sessions ses')) { const s=DB.sessions[v[0]]; return R(s?[DB.users[s.user_id]]:[]); }

    if (q.startsWith('INSERT INTO sims')) { DB.sims[v[0]]={id:v[0],number:v[1],title:v[2],tagline:v[3],description:v[4],minutes:v[5],launch_url:v[6],published:v[7]}; return R([]); }
    if (q.startsWith('SELECT id FROM sims WHERE number')) return R(Object.values(DB.sims).filter(s=>s.number===v[0]&&s.id!==v[1]));
    if (q.includes('FROM sims si WHERE si.published = true OR EXISTS')) {
      const uid=v[0]; return R(Object.values(DB.sims).filter(s=>s.published||DB.sim_access.some(a=>a.sim_id===s.id&&a.user_id===uid))); }
    if (q.startsWith('SELECT id FROM sims si WHERE si.id =')) {
      const [sid,uid]=v; const s=DB.sims[sid];
      return R(s&&(s.published||DB.sim_access.some(a=>a.sim_id===sid&&a.user_id===uid))?[{id:sid}]:[]); }
    if (q.includes('FROM sims WHERE id')) { const s=DB.sims[v[0]]; return R(s?[s]:[]); }
    if (q.startsWith('INSERT INTO sim_access')) { DB.sim_access.push({id:v[0],user_id:v[1],sim_id:v[2]}); return R([]); }

    if (q.includes('FROM previews WHERE user_id')) return R([]);
    if (q.includes('FROM courses c WHERE c.faculty_id')) return R(Object.values(DB.courses).filter(c=>c.faculty_id===v[0]&&!c.archived).map(c=>({...c,enrolled:0,paid:0,sims:0})));
    if (q.startsWith('INSERT INTO courses')) { DB.courses[v[0]]={id:v[0],faculty_id:v[1],title:v[2],term:v[3],join_code:v[4],archived:false}; return R([]); }
    if (q.startsWith('SELECT id FROM courses WHERE join_code')) return R(Object.values(DB.courses).filter(c=>c.join_code===v[0]));
    if (q.includes('FROM courses WHERE join_code')) return R(Object.values(DB.courses).filter(c=>c.join_code===v[0]&&!c.archived));
    if (q.includes('FROM courses WHERE id') && q.includes('faculty_id')) { const c=DB.courses[v[0]]; return R(c&&c.faculty_id===v[1]?[c]:[]); }
    if (q.startsWith('INSERT INTO course_sims')) { DB.course_sims.push({course_id:v[0],sim_id:v[1],expected_seats:v[2],hard_cap:v[3]}); return R([]); }
    if (q.startsWith('INSERT INTO enrolments')) { DB.enrolments[v[0]]={id:v[0],course_id:v[1],student_id:v[2],paid:false,dropped:false}; return R([]); }
    if (q.startsWith('SELECT id FROM enrolments WHERE course_id')) return R(Object.values(DB.enrolments).filter(e=>e.course_id===v[0]&&e.student_id===v[1]));
    if (q.startsWith('UPDATE enrolments SET paid = true')) {
      // params: paid_by, paid_note, course_id
      const cid = v[v.length-1];
      Object.values(DB.enrolments).filter(e=>e.course_id===cid&&!e.dropped).forEach(e=>{e.paid=true;});
      return R([]); }
    if (q.includes('JOIN course_sims cs ON cs.course_id = c.id AND cs.sim_id')) {
      const sid=v[0], uid=v[1], cid=v[2];
      const rows=Object.values(DB.enrolments).filter(e=>e.student_id===uid
        && (!cid || e.course_id===cid)
        && DB.course_sims.some(cs=>cs.course_id===e.course_id&&cs.sim_id===sid));
      rows.sort((a,b)=>(b.paid?1:0)-(a.paid?1:0));
      return R(rows.slice(0,1).map(e=>({id:e.id,paid:e.paid,dropped:e.dropped,title:'c',course_id:e.course_id}))); }
    if (q.startsWith('INSERT INTO launches')) { DB.launches.push({id:v[0],user_id:v[1],sim_id:v[2],course_id:v[3],as_role:v[4]}); return R([]); }
    if (q.includes('FROM launches WHERE user_id') || q.includes('SELECT 1 FROM launches')) {
      return R(DB.launches.filter(l=>l.user_id===v[0]&&l.sim_id===v[1]).slice(0,1).map(()=>({n:1}))); }
    if (q.startsWith('INSERT INTO completions')) { DB.completions.push({id:v[0],user_id:v[1],sim_id:v[2],course_id:v[3],duration:v[4],summary:v[5],metrics:v[6]}); return R([]); }
    return R([]);
  };
}
require.cache[require.resolve(path.join(ROOT,'platform/lib/db.js'))] = { exports: { sql, id: nid, joinCode: () => 'ABC123' } };

const A = require(path.join(ROOT,'platform/lib/auth.js'));
const P = require(path.join(ROOT,'platform/lib/launch.js'));
const { verifyLaunch } = require(path.join(ROOT,'sim/lib/launch.js'));

const call = (h, body, cookie) => new Promise(res => {
  let setCookie = null;
  const r = { _c:200, status(c){this._c=c;return this;}, json(d){res({status:this._c,body:d,cookie:setCookie});},
    setHeader(k,val){ if(k==='Set-Cookie') setCookie=String(val).split(';')[0]; }, redirect(c,u){res({status:c,url:u});},
    send(html){res({status:this._c,html});} };
  h({ method:'POST', body, headers: cookie?{cookie}:{}, query:body||{} }, r);
});

(async () => {
  const ok = (label, cond, extra) => console.log(`  ${cond?'ok  ':'FAIL'} ${label}${extra?'  —  '+extra:''}`);

  // seed an admin and both sims
  DB.users['adm'] = { id:'adm', email:'a@t.com', name:'Admin', role:'admin', password_hash:A.hashPassword('secret12'), disabled:false };
  DB.sessions['s_adm'] = { id:'s_adm', user_id:'adm' };
  const adminCookie = 'fx_sess=s_adm';

  const admin = require(path.join(ROOT,'platform/api/admin.js'));
  const faculty = require(path.join(ROOT,'platform/api/faculty.js'));
  const student = require(path.join(ROOT,'platform/api/student.js'));
  const launch = require(path.join(ROOT,'platform/api/launch.js'));
  const complete = require(path.join(ROOT,'platform/api/complete.js'));

  await call(admin, { action:'save_sim', id:'rapid-01-disaster', number:1, title:'Disaster or Breach?', launchUrl:'https://sim1.test', minutes:20, published:true }, adminCookie);
  await call(admin, { action:'save_sim', id:'rapid-02-relay', number:2, title:'What Did It Tell Them?', launchUrl:'https://sim2.test', minutes:20, published:false }, adminCookie);
  ok('admin registers both sims', Object.keys(DB.sims).length === 2, 'one published, one draft');

  let r = await call(admin, { action:'invite_faculty', name:'Chuck Rivera', email:'chuck@t.com' }, adminCookie);
  const inviteToken = r.body.inviteUrl.split('t=')[1];
  ok('admin invites a facilitator', r.status===200, r.body.inviteUrl.slice(0,44)+'…');

  const auth = require(path.join(ROOT,'platform/api/auth.js'));
  r = await call(auth, { action:'invite_accept', token: inviteToken, password:'password1' });
  const facCookie = r.cookie;
  const facId = Object.values(DB.users).find(u=>u.email==='chuck@t.com').id;
  ok('facilitator accepts and is signed in', r.status===200 && !!facCookie);

  r = await call(faculty, { action:'overview' }, facCookie);
  if (!r.body.catalogue) { console.log('  overview returned:', JSON.stringify(r.body).slice(0,200)); process.exit(1); }
  ok('draft sim invisible before a grant', r.body.catalogue.length===1, 'sees only RapidSim 01');

  await call(admin, { action:'grant_sim_access', simId:'rapid-02-relay', email:'chuck@t.com', note:'reviewing' }, adminCookie);
  r = await call(faculty, { action:'overview' }, facCookie);
  ok('draft sim visible after the grant', r.body.catalogue.length===2, 'sees both');

  r = await call(faculty, { action:'create_course', title:'Operations Management', term:'Fall 2026' }, facCookie);
  const courseId = r.body.courseId;
  await call(faculty, { action:'add_sim', courseId, simId:'rapid-01-disaster', expectedSeats:24 }, facCookie);
  await call(faculty, { action:'add_sim', courseId, simId:'rapid-02-relay', expectedSeats:24 }, facCookie);
  ok('both sims added to one course', DB.course_sims.length===2);

  r = await call(student, { action:'signup_and_enrol', joinCode:'ABC123', name:'Ana Ruiz', email:'ana@t.com', password:'password1' });
  const stuCookie = r.cookie;
  const stuId = Object.values(DB.users).find(u=>u.email==='ana@t.com').id;
  ok('student enrols through the link', r.status===200 && !!stuCookie);

  r = await call(launch, { sim:'rapid-01-disaster', course:courseId, format:'json' }, stuCookie);
  ok('unreleased student is held, politely', r.status===403, r.body.title);

  await call(faculty, { action:'set_paid', courseId, all:true, paid:true, note:'dept PO 4471' }, facCookie);

  for (const [simId, host] of [['rapid-01-disaster','sim1'], ['rapid-02-relay','sim2']]) {
    r = await call(launch, { sim:simId, course:courseId, format:'json' }, stuCookie);
    if (!r.body.url) { console.log('    launch said:', JSON.stringify(r.body).slice(0,160)); continue; }
    const token = decodeURIComponent((r.body.url||'').split('lt=')[1]||'');
    const seen = verifyLaunch(token);
    ok(`released student launches ${simId}`, r.status===200 && seen && seen.role==='student', seen ? `sim verifies: ${seen.name}` : 'token rejected');

    // the sim finishes and reports back
    const { signBack } = require(path.join(ROOT,'sim/lib/launch.js'));
    const back = signBack({ sub: seen.sub, sim: simId, course: courseId, duration: 1180,
      summary:'Finished all three decisions.', metrics:{ 'Final reading':'Both' }, exp: Date.now()+60000 });
    const c = await call(complete, { token: back });
    ok(`  completion accepted for ${simId}`, c.status===200);
  }

  ok('both completions stored', DB.completions.length===2,
     DB.completions.map(c=>c.sim_id).join(', '));
  ok('completion without a launch is refused',
     (await call(complete, { token: require(path.join(ROOT,'sim/lib/launch.js')).signBack({ sub:'nobody', sim:'rapid-01-disaster', exp:Date.now()+60000 }) })).status===404);
})();
