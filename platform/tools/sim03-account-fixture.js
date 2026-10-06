// Disposable test adapters. Real handlers, password hashing, cookies, token
// signing and HTML are used. No production database or session store is touched.
const path = require('node:path');
const Module = require('node:module');
const original = Module._load;
Module._load = function(name, ...args) {
  if (name === '@neondatabase/serverless') return { neon: () => { throw new Error('unexpected real DB'); } };
  return original.call(this, name, ...args);
};
const db = require('../lib/db.js');
Module._load = original;
let sequence = 0;
const users = new Map(), cookies = new Map(), participants = new Map(), sessions = new Map(), runs = new Map();
const courses = new Map([['course-a', { id:'course-a', title:'Test course', join_code:'COURSE', faculty_id:'teacher', archived:false }]]);
const enrolments = [], launches = [];
const sim = { id:'rapid-03-midland', launch_url:'https://midland.test/sim03', published:true };
const query = async (strings, ...v) => {
  const q = strings.join('?').replace(/\s+/g, ' ').trim();
  if (q.startsWith('SELECT u.* FROM sessions ses')) {
    const c = cookies.get(v[0]), user = c && users.get(c.user_id);
    return c && c.expires_at > new Date() && user && !user.disabled ? [user] : [];
  }
  if (q.startsWith('INSERT INTO sessions ')) { cookies.set(v[0], {user_id:v[1], expires_at:v[2]}); return []; }
  if (q.startsWith('DELETE FROM sessions WHERE id')) { cookies.delete(v[0]); return []; }
  if (q.startsWith('UPDATE users SET last_seen_at')) return [];
  if (q.startsWith('SELECT * FROM users WHERE email')) return [...users.values()].filter(u => u.email === v[0] && !u.disabled);
  if (q.startsWith('SELECT * FROM users WHERE id')) return users.has(v[0]) ? [users.get(v[0])] : [];
  if (q.startsWith('INSERT INTO users ')) { users.set(v[0], {id:v[0], email:v[1], name:v[2], role:'student', password_hash:v[3]}); return []; }
  if (q.startsWith('UPDATE users SET password_hash')) { Object.assign(users.get(v[2]), {password_hash:v[0], name:v[1]}); return []; }
  if (q.startsWith('SELECT c.title, c.term, c.join_code')) {
    const c = q.includes('WHERE c.id =') ? courses.get(v[0]) : [...courses.values()].find(c => c.join_code === v[0]);
    return c && !c.archived && (!q.includes('cs.sim_id =') || v[1] === sim.id) ? [{...c, faculty_name:'Teacher'}] : [];
  }
  if (q.startsWith('SELECT * FROM courses WHERE join_code')) return [...courses.values()].filter(c => c.join_code === v[0] && !c.archived);
  if (q.startsWith('SELECT id FROM enrolments')) return enrolments.filter(e => e.course_id === v[0] && e.student_id === v[1]);
  if (q.startsWith('INSERT INTO enrolments ')) { enrolments.push({id:v[0], course_id:v[1], student_id:v[2], paid:false, dropped:false}); return []; }
  if (q.startsWith('UPDATE enrolments SET dropped')) { enrolments.find(e => e.id === v[0]).dropped=false; return []; }
  if (q.startsWith('SELECT id, role, disabled FROM users WHERE id')) return users.has(v[0]) ? [users.get(v[0])] : [];
  if (q.startsWith('SELECT id, faculty_id, archived FROM courses WHERE id')) return courses.has(v[0]) ? [courses.get(v[0])] : [];
  if (q.startsWith('SELECT 1 FROM course_sims WHERE')) return courses.has(v[0]) && v[1] === sim.id && !sim.detached ? [{one:1}] : [];
  if (q.startsWith('SELECT u.id AS student_id, u.name, e.paid FROM enrolments')) {
    return enrolments.filter(e => e.course_id === v[0] && !e.dropped).flatMap(e => {
      const u=users.get(e.student_id);
      return u && !u.disabled && u.role === 'student' ? [{student_id:u.id,name:u.name,paid:e.paid}] : [];
    });
  }
  // Real faculty course and release handlers, backed only by disposable data.
  if (q.startsWith('SELECT c.*, (SELECT count(*) FROM enrolments')) return [...courses.values()]
    .filter(c=>c.faculty_id===v[0]&&!c.archived).map(c=>({...c,
      enrolled:enrolments.filter(e=>e.course_id===c.id&&!e.dropped).length,
      paid:enrolments.filter(e=>e.course_id===c.id&&!e.dropped&&e.paid).length,sims:1}));
  if (q.startsWith('SELECT * FROM sims si')) return [sim];
  if (q.startsWith('SELECT * FROM previews WHERE')) return [];
  if (q.startsWith('SELECT * FROM courses WHERE id')) return [...courses.values()].filter(c=>c.id===v[0]&&c.faculty_id===v[1]);
  if (q.startsWith('SELECT cs.*, si.number')) return [{sim_id:sim.id,number:3,title:'Midland Equipment',started:0,finished:0,started_runs:0,finished_runs:0}];
  if (q.startsWith('SELECT e.id AS enrolment_id')) return enrolments.filter(e=>e.course_id===v[0]).map(e=>({
    ...e,enrolment_id:e.id,student_id:e.student_id,name:users.get(e.student_id).name,
    email:users.get(e.student_id).email,started:0,finished:0}));
  if (q.startsWith('UPDATE enrolments SET paid = true')) {
    for(const e of enrolments) if(e.course_id===v[2]&&(v[3]?v[3].includes(e.id):!e.dropped&&!e.paid)) {
      e.paid=true;e.paid_by=v[0];e.paid_note=v[1];
    }
    return [];
  }
  if (q.startsWith('SELECT * FROM sims WHERE id')) return v[0] === sim.id ? [sim] : [];
  if (q.startsWith('SELECT c.id, c.title FROM course_sims cs')) {
    return v[0] === sim.id && !sim.detached ? [...courses.values()]
      .filter(c => c.faculty_id === v[1] && !c.archived).map(c => ({id:c.id,title:c.title})) : [];
  }
  if (q.startsWith('SELECT 1 FROM course_sims cs')) {
    const c = q.includes('cs.course_id =') ? courses.get(v[0]) : courses.get('course-a');
    const teacher = v.at(-1), simulation = q.includes('cs.course_id =') ? v[1] : v[0];
    return c && c.faculty_id === teacher && simulation === sim.id ? [{one:1}] : [];
  }
  if (q.startsWith('SELECT e.id, e.paid, e.dropped, c.title')) {
    return v[0] === sim.id ? enrolments.filter(e => e.student_id === v[1] && (v.length < 3 || e.course_id === v[2]))
      .sort((a,b) => Number(b.paid)-Number(a.paid)).slice(0,1).map(e => ({...e, title:courses.get(e.course_id).title})) : [];
  }
  if (q.startsWith('SELECT c.title FROM enrolments')) return enrolments.filter(e => e.student_id === v[0] && !e.dropped && (v.length < 2 || e.course_id === v[1])).map(e => ({title:courses.get(e.course_id).title}));
  if (q.startsWith('INSERT INTO launches ')) { launches.push({id:v[0], user:v[1], sim:v[2], course:v[3], role:v[4]}); return []; }
  throw new Error('Unhandled fixture SQL: ' + q);
};
db.sql = () => query;
db.id = prefix => `${prefix}_fixture_${++sequence}`;
const auth = require('../lib/auth.js');
function seed(id, email, role='student', paid=true, name=id) {
  const user = {id, email, role, name, password_hash:auth.hashPassword('password123')};
  users.set(id,user);
  if (role === 'student') enrolments.push({id:'enr-'+id, student_id:id, course_id:'course-a', paid, dropped:false});
  return user;
}
seed('teacher','teacher@example.test','faculty');
seed('alice','alice@example.test','student',true,'Alex Student');
seed('bob','bob@example.test','student',true,'Alex Student');
seed('pending','pending@example.test','student',false,'Pending Student');
const store = require('../../sim03/lib/store.js');
store.configured = () => true;
store.putSession = async (code,value) => { sessions.set(code,structuredClone(value)); };
store.getSession = async code => structuredClone(sessions.get(code) || null);
store.getParticipants = async code => structuredClone(participants.get(code) || {});
store.addParticipant = store.setParticipant = async (code,id,value) => { const p=participants.get(code)||{};p[id]=structuredClone(value);participants.set(code,p); };
require('../../sim03/tools/roster-fixture.js').installRosterTransactions(store, sessions, participants);
store.getRuns = async code => structuredClone(runs.get(code) || {});
store.setRun = async (code,id,next) => {const all=runs.get(code)||{};all[id]=structuredClone(next);runs.set(code,all);};
store.compareAndSetRun = async (code,id,previous,next,session,roster) => {
  const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
  const all=runs.get(code)||{};
  if(!same(all[id],previous)||!same(sessions.get(code),session)||!same(participants.get(code)||{},roster))return false;
  await store.setRun(code,id,next);return true;
};
const handlers = {
  'session-enrolments':require('../api/session-enrolments.js'),
  faculty:require('../api/faculty.js'),
  auth:require('../api/auth.js'), student:require('../api/student.js'), launch:require('../api/launch.js'),
  join:require('../../sim03/api/join.js'), session:require('../../sim03/api/session.js'),
  platform:require('../../sim03/api/platform.js'),
  config:require('../../sim03/api/config.js'), outcome:require('../../sim03/api/outcome.js'), finish:require('../../sim03/api/finish.js')
};
async function call(name, body={}, {headers={}, query={}, method='POST'}={}) {
  const res = { statusCode:200, headers:{}, payload:null, url:null,
    status(n){this.statusCode=n;return this;}, setHeader(k,v){this.headers[k.toLowerCase()]=v;},
    json(x){this.payload=x;return this;}, send(x){this.payload=x;return this;}, end(){return this;},
    redirect(n,url){this.statusCode=n;this.url=url;return this;} };
  if (typeof handlers[name] !== 'function') throw new Error('Unhandled fixture API: ' + name);
  await handlers[name]({method,headers,body,query},res);
  return res;
}
const cookie = res => res.headers['set-cookie'].split(';')[0];
async function signin(email) { const r=await call('auth',{action:'signin',email,password:'password123'});if(r.statusCode!==200)throw new Error('fixture sign in failed');return cookie(r); }
async function createClass() {
  const c = await signin('teacher@example.test');
  const launch = await call('launch',{}, {method:'GET',headers:{cookie:c},query:{sim:sim.id,course:'course-a',mode:'session',format:'json'}});
  const token = new URLSearchParams(new URL(launch.payload.url).hash.slice(1)).get('lt');
  const created = await call('session',{action:'create',mode:'team',name:'Account test'}, {headers:{'x-launch-token':token}});
  if(created.statusCode!==200)throw new Error('create failed');
  return {code:created.payload.session.code, token};
}
process.env.LAUNCH_SECRET = 'local-fixture-secret-never-production';
process.env.ACCESS_CODE = 'standalone-secret-not-shared';
module.exports = {call,signin,cookie,createClass,handlers,users,cookies,courses,enrolments,sessions,participants,runs,sim,seed,auth,launches};

// The sim-to-platform roster bridge uses the real read-only handler with the
// same test SQL adapter. No production network or student records are used.
const nativeFetch = global.fetch;
global.fetch = async (url, options) => {
  if (String(url).endsWith('/api/session-enrolments')) {
    const r = await call('session-enrolments', JSON.parse(options.body), {headers:options.headers});
    return new Response(JSON.stringify(r.payload), {status:r.statusCode,headers:{'content-type':'application/json'}});
  }
  return nativeFetch(url, options);
};
