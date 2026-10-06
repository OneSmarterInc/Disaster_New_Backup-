#!/usr/bin/env node
global.RapidSimsIdentity = require('../public/sim-identity.js');
// The student page in every state a student can be in: not enrolled, waiting,
// released, part way through, and finished. Each must read as a sentence rather
// than a status code.
const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'../public/student.html'),'utf8');
const js=html.slice(html.indexOf('<script>')+8, html.lastIndexOf('</script>'));
let LASTHTML='';
function mk(id){const o={id,innerHTML:'',style:{},dataset:{},value:'',textContent:'',disabled:false,
 select(){},focus(){},classList:{toggle(){},add(){},remove(){}},querySelectorAll:()=>[],querySelector:()=>mk('x')};
 return o;}
const app={get innerHTML(){return LASTHTML;},set innerHTML(v){LASTHTML=v;},querySelectorAll:()=>[],querySelector:()=>mk('x')};
global.window={};global.location={href:''};
global.document={getElementById:id=>id==='app'?app:mk(id),createElement:()=>mk('t'),body:{appendChild(){}},
 querySelector:()=>mk('x'),querySelectorAll:()=>[]};
global.navigator={clipboard:{writeText(){}}};global.setInterval=()=>0;global.setTimeout=()=>0;

let RESP = {};
global.fetch = async (p, o) => {
  const b = JSON.parse(o.body);
  return { ok:true, json: async () => (b.action === 'me' ? { user:{ name:'Ana Ruiz', role:'student' } } : RESP) };
};
const M = new Function('window','location','document','fetch','navigator','setInterval','setTimeout',
  js.replace(/\(async \(\) => \{[\s\S]*?\}\)\(\);\s*$/,'') + '\n; return { draw };'
)(global.window,global.location,global.document,global.fetch,global.navigator,global.setInterval,global.setTimeout);

const strip = s => s.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const show = (label, n) => { console.log('\n=== ' + label + ' ===\n  ' + strip(LASTHTML).slice(0, n||420)); };

(async () => {
  RESP = { courses:[], sims:[] };
  await M.draw(); show('not in any course', 260);

  RESP = { courses:[{ id:'c1', title:'Operations Management', term:'Fall 2026', paid:false, faculty_name:'Chuck Rivera' }],
    sims:[{ course_id:'c1', id:'rapid-01', number:1, title:'Disaster or Breach?',
      description:'Data corruption is spreading across client applications at two in the morning.',
      minutes:20, played:0 }] };
  await M.draw(); show('enrolled, waiting');

  RESP.courses[0].paid = true;
  await M.draw(); show('released, not started');

  RESP.sims[0].played = 1;
  await M.draw(); show('started but not finished', 300);

  RESP.sims[0].completed_at = new Date();
  RESP.sims[0].duration_seconds = 1140;
  RESP.sims[0].metrics = { 'Final reading':'Both', 'Sequencing':'Kept options open', 'Coverage admission':'Hour 4 (privately)' };
  await M.draw(); show('finished', 560);
})();

process.on('exit', () => process.exitCode = 0);
