#!/usr/bin/env node
global.RapidSimsIdentity = require('../public/sim-identity.js');
// Renders every view of the faculty console against a recording DOM and checks
// each button that appears receives a handler.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../public/faculty.html'), 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

const REG = new Map(); let LAST = '', BODY = '';
function mk(id){ const o={id,innerHTML:'',style:{},dataset:{},value:'',textContent:'',disabled:false,checked:false,
  select(){},focus(){},setSelectionRange(){},classList:{toggle(){},add(){},remove(){}},
  querySelectorAll:()=>[],querySelector:()=>mk('x'),closest:()=>mk('x'),parentElement:null};
  Object.defineProperty(o,'onclick',{set(v){REG.set(id,!!v);},get(){return null;},configurable:true});
  Object.defineProperty(o,'onchange',{set(v){REG.set(id,!!v);},get(){return null;},configurable:true});
  Object.defineProperty(o,'oninput',{set(v){REG.set(id,!!v);},get(){return null;},configurable:true});
  return o; }
const app = { get innerHTML(){return LAST;}, set innerHTML(v){LAST=v;},
  querySelectorAll(sel){ const m=sel.match(/\[data-(\w+)\]/); if(!m) return [];
    const src = LAST + BODY;
    return [...src.matchAll(new RegExp(`data-${m[1]}="([^"]*)"`,'g'))].map(x=>{
      const e=mk('d-'+m[1]); e.dataset[m[1]]=x[1]; e.dataset.now='0'; e.dataset.cur=''; return e; }); },
  querySelector:()=>mk('x') };
const bodyEl = { get innerHTML(){return BODY;}, set innerHTML(v){BODY=v;}, querySelectorAll:()=>[], querySelector:()=>mk('x') };

global.window={}; global.location={href:'',reload(){}};
global.document={ getElementById:id=>id==='app'?app:(id==='body'?bodyEl:mk(id)), createElement:()=>mk('t'),
  body:{appendChild(){}}, querySelector:()=>mk('x'), querySelectorAll:()=>[] };
global.fetch=async()=>({ok:true,json:async()=>({})}); global.navigator={clipboard:{writeText(){}}};
global.confirm=()=>true; global.setTimeout=()=>0; global.prompt=()=>null;

const M = new Function('window','location','document','fetch','navigator','confirm','setTimeout','prompt',
  js.replace(/\(async \(\) => \{[\s\S]*?\}\)\(\);\s*$/,'') + '\n; return { F, render };'
)(global.window,global.location,global.document,global.fetch,global.navigator,global.confirm,global.setTimeout,global.prompt);

const CAT = [
  { id:'rapid-01-disaster', number:1, title:'Disaster or Breach?', tagline:'t', minutes:20 },
  { id:'rapid-02-relay', number:2, title:'What Did It Tell Them?', tagline:'t', minutes:20 }
];
M.F.me = { role:'faculty', name:'Chuck' };
M.F.data = { courses:[{ id:'c1', title:'Operations Management', term:'Fall 2026', join_code:'ABC123', enrolled:24, paid:24, sims:2 }],
  catalogue:CAT, previews:[{ sim_id:'rapid-02-relay', expires_at:new Date(Date.now()+5*864e5) }] };
M.F.simsOverview = [{ id:'rapid-01-disaster', number:1, title:'Disaster or Breach?', tagline:'t', courses:1, enrolled:24, released:24, started:22, finished:20 }];

let FAILED = 0;
function check(label){
  if (!LAST.includes('id="body"')) BODY = '';
  const ids = [...new Set([...(LAST+BODY).matchAll(/<button[^>]*id="([\w-]+)"/g)].map(m=>m[1]))];
  const bad = ids.filter(i => !REG.get(i));
  if (bad.length) FAILED++;
  console.log(`  ${bad.length?'FAIL':'ok  '} ${label}${bad.length?'  no handler: '+bad.join(', '):''}`);
}

REG.clear(); M.F.tab='crs'; M.render(); check('home — courses');
REG.clear(); M.F.newCourse=true; M.render(); check('home — creating a course');
REG.clear(); M.F.newCourse=false; M.F.tab='sim'; M.render(); check('home — simulations');
REG.clear(); M.F.tab='crs';
M.F.course = { course:{ id:'c1', title:'Operations Management', term:'Fall 2026', join_code:'ABC123' },
  sims:[{ sim_id:'rapid-01-disaster', number:1, title:'Disaster or Breach?', expected_seats:24, started:22, finished:20 }],
  roster:[{ enrolment_id:'e1', name:'Ana Ruiz', email:'a@t.com', paid:false, dropped:false, created_at:new Date(), launches:0 },
          { enrolment_id:'e2', name:'Ben Osei', email:'b@t.com', paid:true, dropped:false, created_at:new Date(), launches:2 }],
  catalogue:CAT, enrolUrl:'https://p/join.html?c=ABC123' };
M.F.view='course'; M.render(); check('a course');
REG.clear(); M.F.editCourse=true; M.render(); check('a course — renaming');
REG.clear(); M.F.editCourse=false; M.F.addSim=true; M.render(); check('a course — adding a simulation');
REG.clear(); M.F.addSim=false; M.F.view='played';
M.F.progress = { sim:{ id:'rapid-01-disaster', title:'Disaster or Breach?' }, course:{ id:'c1', title:'Operations Management' },
  rows:[{ name:'Ana Ruiz', email:'a@t.com', paid:true, dropped:false, starts:1, completed_at:new Date(), duration_seconds:1140, metrics:{ 'Final reading':'Both' } }] };
M.render(); check('who has played');

console.log(FAILED ? `\n${FAILED} view(s) with an unwired button.` : '\nfaculty views: every button wired');
process.exit(FAILED ? 1 : 0);
