#!/usr/bin/env node
global.RapidSimsIdentity = require('../public/sim-identity.js');
// A facilitator can look at what a simulation is before deciding anything about
// it — the same page a colleague sees on the public catalogue, opened over the
// console so they keep their place. The eye belongs wherever a simulation is
// listed, and the panel must carry the whole page rather than a summary.
// the public catalogue shows.
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname,'../public/faculty.html'),'utf8');
const js = html.slice(html.indexOf('<script>')+8, html.lastIndexOf('</script>'));
global.window = global;
eval(fs.readFileSync(require('path').join(__dirname,'../public/sim-detail.js'),'utf8'));

let LAST='', BODY='', SHEET=null;
function mk(id){const o={id,innerHTML:'',style:{},dataset:{},value:'',textContent:'',disabled:false,className:'',
 focus(){},select(){},setAttribute(){},setSelectionRange(){},remove(){SHEET=null;},classList:{toggle(){},add(){},remove(){}},
 querySelectorAll:()=>[],querySelector:()=>mk('x'),closest:()=>mk('x')};return o;}
const app={get innerHTML(){return LAST;},set innerHTML(v){LAST=v;},
  querySelectorAll(sel){const m=sel.match(/\[data-(\w+)\]/);if(!m)return[];
    return [...(LAST+BODY).matchAll(new RegExp(`data-${m[1]}="([^"]*)"`,'g'))].map(x=>{const e=mk('d');e.dataset[m[1]]=x[1];return e;});},
  querySelector:()=>mk('x')};
const bodyEl={get innerHTML(){return BODY;},set innerHTML(v){BODY=v;},querySelectorAll:()=>[],querySelector:()=>mk('x')};
global.location={href:''};
global.document={getElementById:id=>id==='app'?app:(id==='body'?bodyEl:(SHEET&&id==='lookSheet'?SHEET:mk(id))),
  createElement:()=>{ SHEET=mk('lookSheet'); return SHEET; },
  body:{...mk('body'),appendChild(){}}, addEventListener(){}, removeEventListener(){},
  querySelector:()=>mk('x'),querySelectorAll:()=>[]};
global.fetch=async()=>({ok:true,json:async()=>({})});global.navigator={clipboard:{writeText(){}}};
global.confirm=()=>true;global.setTimeout=()=>0;global.prompt=()=>null;

const CAT=[{ id:'rapid-01-disaster', number:1, title:'Disaster or Breach?', minutes:20,
  tagline:'Twenty minutes in a room where nobody knows what is wrong yet.',
  description:'It is two in the morning and customer systems are breaking.',
  detail:{ world:'IT operations', seat:'VP of Operations', clock:'02:14 to Day 3', teaches:'What to do first',
    tangle:'Both possible causes look identical.', turn:'Two people are blamed by opposite answers.',
    roomIntro:'Four people.', momentsIntro:'The clock does not wait.', after:'You find out what happened.',
    discussion:'Every answer goes up side by side.', tryIt:'Seven days free.', sessionShape:'Five minutes to get everyone in.',
    cast:[{name:'Kate Sullivan',role:'Director, Infrastructure',stake:'Specified the array.'}],
    beats:[{at:'Hour 4',what:'Three systems down.'}] }}];

const M=new Function('window','location','document','fetch','navigator','confirm','setTimeout','prompt','simDetailHTML',
  js.replace(/\(async \(\) => \{[\s\S]*?\}\)\(\);\s*$/,'')+'\n; return { F, render, drawLook };'
)(global.window,global.location,global.document,global.fetch,global.navigator,global.confirm,global.setTimeout,global.prompt,global.simDetailHTML);

M.F.data={courses:[],catalogue:CAT,previews:[]};
M.F.simsOverview=[{ id:'rapid-01-disaster', number:1, title:'Disaster or Breach?', tagline:'t', courses:1, started:2, finished:1 }];
M.F.tab='sim'; M.render();
console.log('  eye on the simulations table :', /data-look="rapid-01-disaster"/.test(LAST+BODY) ? 'yes' : 'MISSING');

M.F.course={ course:{id:'c1',title:'Ops',term:'Fall',join_code:'ABC'},
  sims:[{ sim_id:'rapid-01-disaster', number:1, title:'Disaster or Breach?', started:2, finished:1 }],
  roster:[], catalogue:CAT, enrolUrl:'https://p/join' };
M.F.view='course'; M.render();
console.log('  eye inside a course          :', /data-look="rapid-01-disaster"/.test(LAST+BODY) ? 'yes' : 'MISSING');

M.F.looking='rapid-01-disaster'; M.drawLook();
const s = SHEET ? SHEET.innerHTML : '';
console.log('  the panel opens              :', s ? 'yes' : 'MISSING');
console.log('  shows what makes it hard     :', /Both possible causes look identical/.test(s) ? 'yes' : 'no');
console.log('  shows the room               :', /Kate Sullivan/.test(s) ? 'yes' : 'no');
console.log('  shows the three moments      :', /Hour 4/.test(s) ? 'yes' : 'no');
console.log('  hides the preview request    :', /Request a preview/.test(s) ? 'NO — should be hidden' : 'yes');
console.log('  has a way out                :', /id="lookClose"/.test(s) ? 'yes' : 'MISSING');

const missing = [];
if (!/data-look="rapid-01-disaster"/.test(LAST+BODY)) missing.push('the eye');
if (!SHEET || !/Kate Sullivan/.test(SHEET.innerHTML)) missing.push('the room');
if (missing.length) { console.error('\n'+'missing: '+missing.join(', ')); process.exit(1); }
