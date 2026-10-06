#!/usr/bin/env node
global.RapidSimsIdentity = require('../public/sim-identity.js');
// Renders every view of the admin console against a recording DOM and checks
// each button that appears receives a handler. Syntax and boot checks pass on a
// button that does nothing, which is how that fault kept shipping.
const fs = require('fs');
const html=fs.readFileSync(require('path').join(__dirname, '../public/admin.html'),'utf8');
const js=html.slice(html.indexOf('<script>')+8, html.lastIndexOf('</script>'));
const REG=new Map(); let LAST='', BODY='';
function mk(id){const o={id,innerHTML:'',style:{},dataset:{},value:'',textContent:'',disabled:false,checked:false,
 select(){},focus(){},setSelectionRange(){},insertAdjacentHTML(){},classList:{toggle(){},add(){},remove(){}},
 querySelectorAll:()=>[],querySelector:()=>mk('x'),parentElement:null,closest:()=>mk('x')};
 Object.defineProperty(o,'onclick',{set(v){REG.set(id,!!v);},get(){return null;},configurable:true});
 Object.defineProperty(o,'oninput',{set(v){REG.set(id,!!v);},get(){return null;},configurable:true});
 return o;}
const app={get innerHTML(){return LAST;},set innerHTML(v){LAST=v;},
 querySelectorAll(sel){const m=sel.match(/\[data-(\w+)\]/);if(!m)return[];
  const src=LAST+BODY;
  return [...src.matchAll(new RegExp(`data-${m[1]}="([^"]*)"`,'g'))].map(x=>{const e=mk('d-'+m[1]);e.dataset[m[1]]=x[1];e.dataset.now='0';e.dataset.acc='1';return e;});},
 querySelector:()=>mk('x')};
const bodyEl={get innerHTML(){return BODY;},set innerHTML(v){BODY=v;},querySelectorAll:()=>[],querySelector:()=>mk('x')};
global.window={};global.location={href:'',reload(){}};
global.document={getElementById:id=>id==='app'?app:(id==='body'?bodyEl:mk(id)),createElement:()=>mk('t'),
 body:{appendChild(){}},querySelector:()=>mk('x'),querySelectorAll:()=>[]};
global.fetch=async()=>({ok:true,json:async()=>({})});global.navigator={clipboard:{writeText(){}}};
global.confirm=()=>true;global.setTimeout=()=>0;
const M=new Function('window','location','document','fetch','navigator','confirm','setTimeout',
 js.replace(/\(async \(\) => \{[\s\S]*?\}\)\(\);\s*$/,'')+'\n; return { D, render };'
)(global.window,global.location,global.document,global.fetch,global.navigator,global.confirm,global.setTimeout);

M.D.data={faculty:[{id:'f1',name:'Akshay Agrawal',email:'a@t.com',institution:'OneSmarter',accepted:true,disabled:false,
   courses:2,students:2,paid_students:1,launches:6,course_titles:'SIM2, Test Course',sim_titles:'Disaster or Breach?',last_seen_at:new Date()},
  {id:'f2',name:'Chuck Rivera',email:'c@t.com',accepted:false,disabled:false,courses:0,students:0,paid_students:0,launches:0}],
 sims:[{id:'rapid-01-disaster',number:1,title:'Disaster or Breach?',tagline:'t',minutes:20,launch_url:'https://s1',published:true},
   {id:'rapid-02-relay',number:2,title:'What Did It Tell Them?',tagline:'t',minutes:20,launch_url:'https://s2',published:false}],
 totals:{students:2,courses:2,paid_seats:1,launches:7}};
M.D.grants=[{id:'g1',sim_id:'rapid-02-relay',name:'Chuck Rivera',email:'c@t.com',note:'reviewing'}];
M.D.students=[{id:'s1',name:'Ana Ruiz',email:'ana@t.com',courses:1,with_access:1,launches:4,finished:2,created_at:new Date(),course_titles:'Test Course',faculty_names:'Akshay Agrawal',sim_titles:'Disaster or Breach?'}];
M.D.allCourses=[{id:'c1',title:'Test Course',term:'Fall 2026',join_code:'4UFJ52',archived:false,faculty_name:'Akshay Agrawal',enrolled:2,paid:1,launches:6,sim_titles:'Disaster or Breach?'}];

let FAILED = 0;
function check(label){
  // detail and error views replace the whole page, so anything left in the tab
  // body is stale and would be counted twice
  if (!LAST.includes('id="body"')) BODY = '';
  const ids=[...new Set([...(LAST+BODY).matchAll(/<button[^>]*id="([\w-]+)"/g)].map(m=>m[1]))];
  const bad=ids.filter(i=>!REG.get(i));
  if (bad.length) FAILED++;
  console.log(`  ${bad.length?'FAIL':'ok  '} ${label}${bad.length?'  no handler: '+bad.join(', '):''}`);
}
['fac','stu','crs','cat'].forEach(t=>{ REG.clear(); M.D.tab=t; M.render(); check('tab '+t); });
REG.clear(); M.D.tab='fac'; M.D.invite=true; M.render(); check('invite open');
REG.clear(); M.D.invite=false; M.D.personEdit='f1'; M.render(); check('editing a facilitator');
REG.clear(); M.D.personEdit=null; M.D.link={for:'f1',url:'https://x',note:'n'}; M.render(); check('reset link shown');
REG.clear(); M.D.link=null; M.D.tab='cat'; M.D.simEdit='rapid-02-relay'; M.render(); check('editing a sim');
REG.clear(); M.D.simEdit=null; M.D.reviewersFor='rapid-02-relay'; M.render(); check('reviewers open');
REG.clear(); M.D.reviewersFor=null; M.D.maint=true; M.render(); check('maintenance open');
REG.clear(); M.D.maint=false; M.D.detail={person:{id:'f1',name:'Akshay Agrawal',email:'a@t.com',accepted:true,disabled:false},
 courses:[{id:'c1',title:'Test Course',term:'Fall 2026',join_code:'4UFJ52'}],
 students:[{course_id:'c1',name:'Ana Ruiz',email:'ana@t.com',paid:true,dropped:false,launches:4,paid_note:'dept PO 4471'}],
 courseSims:[{course_id:'c1',title:'Disaster or Breach?'}]}; M.render(); check('facilitator detail');
REG.clear(); M.D.detail=null; M.D.data=null; M.D.err='column "number" does not exist'; M.render(); check('schema behind');

process.exit(FAILED ? 1 : 0);
