// Real faculty handler and page, disposable SQL/auth adapters; no live records.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const faculty = { id: 'teacher', role: 'faculty', name: 'Test Teacher' };
const courses = [{ id: 'course-a', faculty_id: 'teacher', title: 'A', join_code: 'AAAAA' },
  { id: 'course-b', faculty_id: 'another-teacher', title: 'B', join_code: 'BBBBB' }];
const sims = [
  { id: 'rapid-01-disaster', title: 'Disaster or Breach?', published: true },
  { id: 'rapid-07-bought', title: 'Would You Have Bought It?', published: false },
  { id: 'rapid-08-later', title: 'Eighteen Months Later', published: false },
  { id: 'future-sim', title: 'Future Simulation', published: false },
  { id: 'review-only', title: 'Review Only', published: false }
];
const attached = [{ course_id: 'course-a', sim_id: sims[0].id }];
const grants = new Set();
let checks = 0, failRead = false;
function ok(value, message) { assert.ok(value, message); checks++; }
const visible = (sim, user) => sim.published || grants.has(user + ':' + sim.id);
async function sql(parts, ...v) {
  const q = parts.join('?').replace(/\s+/g, ' ').trim();
  if (q.startsWith('SELECT * FROM courses WHERE')) return courses.filter(c => c.id === v[0] && c.faculty_id === v[1]);
  if (q.startsWith('SELECT c.*,')) return courses.filter(c => c.faculty_id === v[0]).map(c => ({ ...c, sims: attached.length }));
  if (q.startsWith('SELECT cs.*, si.number')) return attached.filter(a => a.course_id === v.at(-1)).map(a => ({ ...a, ...sims.find(s => s.id === a.sim_id) }));
  if (q.startsWith('SELECT e.id AS enrolment_id')) return [];
  if (q.startsWith('SELECT * FROM previews')) return [];
  if (q.startsWith('SELECT * FROM sims si')) {
    assert(q.includes('si.published = true') && q.includes('sim_access'));
    return sims.filter(s => visible(s, v[0])).map(s => ({ ...s }));
  }
  if (q.startsWith('SELECT id FROM sims si')) {
    assert(q.includes('si.published = true') && q.includes('sim_access'));
    return sims.filter(s => s.id === v[0] && visible(s, v[1]));
  }
  if (q.startsWith('INSERT INTO course_sims')) {
    if (!attached.some(a => a.course_id === v[0] && a.sim_id === v[1])) attached.push({ course_id: v[0], sim_id: v[1] });
    return [];
  }
  throw Error('Unexpected SQL: ' + q);
}
const apiModule = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'api/faculty.js'), 'utf8'), {
  module: apiModule, console, require(name) {
    if (name.endsWith('/catalogue.js')) return require('../lib/catalogue.js');
    if (name.endsWith('/db.js')) return { sql: () => sql };
    if (name.endsWith('/transcripts.js')) return { ensureTranscripts: async () => {} };
    if (name.endsWith('/urls.js')) return { baseUrl: () => 'https://platform.test' };
    if (name.endsWith('/auth.js')) return {
      publicUser: u => u,
      requireRole: async (req, res, ...roles) => {
        if (req.user && roles.includes(req.user.role)) return req.user;
        res.status(403).json({ error: 'forbidden' }); return null;
      }
    };
    throw Error(name);
  }
});
async function api(body, user = faculty) {
  const result = { status: 200, headers: {}, body: null };
  const res = { setHeader(k,v) { result.headers[k]=v; }, status(s) { result.status=s; return this; }, json(b) { result.body=b; return this; } };
  await apiModule.exports({ method: 'POST', body, user, headers: {} }, res);
  return result;
}

async function client() {
  const elements = new Map(), requests = [];
  class Element {
    constructor(id = '') { this.id=id; this.value=''; this.style={}; this.children=[]; this.textContent=''; }
    set innerHTML(s) {
      for (const id of this.children) elements.delete(id);
      this.children=[]; this.html=String(s);
      for (const m of this.html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
        const e = new Element(m[1]); elements.set(e.id,e); this.children.push(e.id);
      }
    }
    get innerHTML() { return this.html || ''; }
    setAttribute() {}
    removeAttribute() {}
    querySelectorAll() { return []; }
    querySelector() { return null; }
  }
  const html=fs.readFileSync(path.join(root,'public/faculty.html'),'utf8');
  for (const m of html.matchAll(/\bid="(app|out|who|adminlink)"/g)) elements.set(m[1],new Element(m[1]));
  const ctx=vm.createContext({ console, URLSearchParams, Set, Date, RapidSimsIdentity: require('../public/sim-identity.js'),
    document: { getElementById: id => elements.get(id) || null, querySelectorAll: () => [], addEventListener(){}, removeEventListener(){}, body:{classList:{remove(){}}} },
    location: { pathname:'/faculty.html', search: '?course=course-a' }, setTimeout: () => {},
    window:{addEventListener(){},scrollTo(){},scrollY:0},
    fetch: async (url,opt) => {
      const body=JSON.parse(opt.body); requests.push({ ...body, cache: opt.cache });
      if (failRead && body.action==='course_detail') { failRead=false; throw Error('temporary outage'); }
      const r=url==='/api/auth' ? { status:200,body:{ user:faculty } } : await api(body);
      // Browser fetch serializes data; do not share mutable adapter objects.
      return { ok:r.status<400, status:r.status, json:async()=>JSON.parse(JSON.stringify(r.body)) };
    }
  });
  // Use the real navigation helper with a minimal history adapter. Full history
  // and browser events are exercised by portal-navigation-browser-check.js.
  vm.runInContext(`globalThis.history={state:null,replaceState(state,unused,url){this.state=state;location.search=url.includes('?')?'?'+url.split('?')[1]:'';},pushState(state,unused,url){this.replaceState(state,unused,url);}}`,ctx);
  vm.runInContext(fs.readFileSync(path.join(root,'public/portal-navigation.js'),'utf8'),ctx);
  vm.runInContext('globalThis.PortalNavigation=window.PortalNavigation',ctx);
  // Windows checkouts may use CRLF; normalize before matching the boot function.
  let code=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\r\n?/g, '\n');
  code=code.replace('(async () => {\n  try {\n    const me', 'globalThis.ready=(async () => {\n  try {\n    const me');
  vm.runInContext(code,ctx);
  assert(ctx.ready && typeof ctx.ready.then === 'function', 'Test did not capture portal startup');
  await ctx.ready;
  return { elements,requests,run:s=>vm.runInContext(s,ctx),click:async id=>{
    const e=elements.get(id);assert(e?.onclick,'Missing button '+id);await e.onclick();
    for(let i=0;i<200;i++)await Promise.resolve();
    assert(!vm.runInContext('navigation?.restoring',ctx),'Navigation did not settle');
  },html:()=>elements.get('app').innerHTML };
}

(async()=>{
  const page=await client();
  ok(page.run('F.course.catalogue.length')===1,'initial course contains only the initially published sim');
  ok(page.elements.has('as'),'Add remains available when all old sims are already attached');
  // Administrator publishes both while the faculty course page remains open.
  sims[1].published=true;sims[2].published=true;
  await page.click('as');
  ok(page.html().includes('value="rapid-07-bought"')&&page.html().includes('value="rapid-08-later"'),'opening Add fetches newly published Sim07 and Sim08');
  ok(!page.html().includes('value="rapid-01-disaster"'),'attached sim stays out of dropdown');
  ok(!page.html().includes('value="future-sim"'),'unpublished sim remains hidden');
  ok(page.run('F.data.catalogue.length')===3,'simulation previews receive the same refreshed catalogue');
  sims[3].published=true;await page.click('refresh-sims');
  ok(page.html().includes('value="future-sim"'),'Refresh list picks up future sims without an ID allowlist');
  for(const id of ['rapid-07-bought','rapid-08-later']) {
    page.elements.get('a_sim').value=id;page.elements.get('a_seats').value='24';
    await page.click('a_go');
    ok(attached.some(a=>a.course_id==='course-a'&&a.sim_id===id),id+' attaches successfully through the real handler');
    await page.click('as');
    ok(!page.html().includes('value="'+id+'"'),id+' disappears from available choices once attached');
  }
  failRead=true;await page.click('refresh-sims');
  ok(page.html().includes('Unable to refresh simulations: temporary outage'),'failed refresh explains the error');
  ok(!page.elements.has('a_sim'),'failed refresh does not present a stale list as current');
  await page.click('as');ok(page.elements.has('a_sim'),'refresh works after a transient failure');
  ok(page.requests.every(r=>r.cache==='no-store'),'faculty requests explicitly bypass browser cache');
  const r=await api({action:'course_detail',courseId:'course-a'});
  ok(r.headers['Cache-Control'].includes('no-store'),'faculty response is not cacheable');
  ok((await api({action:'add_sim',courseId:'course-a',simId:'review-only'})).status===404,'draft cannot be attached without permission');
  grants.add('teacher:review-only');
  ok((await api({action:'add_sim',courseId:'course-a',simId:'review-only'})).status===200,'granted draft remains assignable to its reviewer');
  ok((await api({action:'add_sim',courseId:'course-b',simId:'rapid-07-bought'})).status===404,'faculty cannot change another faculty course');
  ok((await api({action:'course_detail',courseId:'course-a'},{id:'pupil',role:'student'})).status===403,'student cannot read faculty course data');
  console.log('Course catalogue checks passed: '+checks+' assertions');
})().catch(e=>{console.error(e);process.exitCode=1});
