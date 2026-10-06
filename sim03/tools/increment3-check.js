const assert=require('assert');
const fs=require('fs');
const path=require('path');
const S=require('../lib/scenario.js');
const {buildClosingLesson}=require('../lib/closingLesson.js');
const cfg=S.publicConfig();
const packet=JSON.stringify(cfg.briefing);
for(const forbidden of ['Tuesday','eighty minutes','semester','your team runs Midland']) assert.equal(packet.toLowerCase().includes(forbidden.toLowerCase()),false,forbidden);
for(const name of ['Dale Brenner','Renata Oyelaran','Tom Vasquez','Sam Achterberg']) assert.ok(packet.includes(name),name);
assert.ok(packet.includes('thirty minutes')&&packet.includes('two annual $9 million allocations')&&packet.includes('third year'));
assert.ok(packet.includes('Nineteen percent of our visits find nothing wrong')&&packet.includes('$290'));
assert.equal(cfg.meta.minutes,30);
assert.ok(cfg.position.includes('Run has a $4M minimum')&&cfg.position.includes('$3M maximum per year'));
assert.equal(cfg.reflectionPrompts[0],'Which of Dale, Renata, Tom, or Sam did you overrule most?');
assert.ok(cfg.reflectionFollowups[0].includes('After seeing Year 3'));
const y1={run:3,uptime:2,capacity:2,connect:0,features:2};
const y1o=S.evaluateYear1(y1);
assert.equal(y1o.band,'weak');assert.ok(y1o.allocationNotes.some(x=>x.includes('Connect was $0M')));assert.ok(y1o.allocationNotes.some(x=>x.includes('$6.1M Run bill')));
const heatA={run:3,uptime:3,capacity:0,connect:3,features:0},heatB={run:3,uptime:3,capacity:0,connect:3,features:0};
const heat=S.evaluateYear2(heatA,heatB).heat;assert.equal(heat.band,'strong');assert.ok(heat.allocationNotes.some(x=>x.includes('Cumulative Uptime was $6M')&&x.includes('$3M sat above that line')));
for(const band of ['strong','data_no_room','pilot','weak']){
  const copy={strong:S.evaluateYear3({run:3,uptime:1,capacity:1,connect:3,features:1},{run:3,uptime:2,capacity:1,connect:2,features:1}),data_no_room:S.evaluateYear3({run:3,uptime:3,capacity:0,connect:3,features:0},{run:3,uptime:0,capacity:0,connect:3,features:3}),pilot:S.evaluateYear3({run:3,uptime:2,capacity:1,connect:2,features:1},{run:3,uptime:1,capacity:1,connect:1,features:3}),weak:S.evaluateYear3({run:3,uptime:2,capacity:1,connect:1,features:2},{run:3,uptime:2,capacity:1,connect:1,features:2})}[band];
  assert.ok(copy.narrative.includes('Tom:')&&copy.narrative.includes('Sam:'),band);
}
const weakComp=S.evaluateYear2({run:3,uptime:0,capacity:3,connect:0,features:3},{run:3,uptime:1,capacity:3,connect:1,features:1}).competitor.narrative;
assert.equal(weakComp.includes('market question arrived after the architecture decision'),false);assert.equal(weakComp.includes('we decided this before we knew'),false);
const buyers=S.evaluateBuyers({run:3,uptime:2,capacity:1,connect:1,features:2},{run:3,uptime:2,capacity:1,connect:1,features:2});
assert.ok(buyers.carrolton.roomLink.includes('No one in the room'));assert.ok(S.evaluateBuyers({run:3,uptime:2,capacity:1,connect:2,features:1},{run:3,uptime:2,capacity:1,connect:2,features:1}).ridge_hollow.reason.includes('After closing'));
assert.equal(new Set(Object.values(['strong','middle','weak'].reduce((o,b)=>(o[b]=S.evaluateYear1(b==='strong'?{run:3,uptime:1,capacity:1,connect:2,features:2}:b==='middle'?{run:3,uptime:2,capacity:1,connect:1,features:2}:{run:3,uptime:2,capacity:2,connect:0,features:2}).year2Intro,o),{}))).size,3);
const html=fs.readFileSync(path.join(__dirname,'..','public','index.html'),'utf8');
for(const marker of ['Pre-session briefing','What happens in the simulation','No one in the room speaks for this line.','year2-history','No Year 3 allocation','reflection-followup','align-self:start','The decisions are over. Explain what you would defend or change.']) assert.ok(html.includes(marker),marker);
for(const forbidden of ['What happens Tuesday','briefing packet your instructor posted before class','The architecture underneath it is the one built over the previous two years.']) assert.equal(html.includes(forbidden),false,forbidden);
const y1fn=html.slice(html.indexOf('function renderYear1Outcome'),html.indexOf('function renderYear2Events'));
assert.ok(y1fn.indexOf('<div class="outcome">')<y1fn.indexOf("runningHTML(S.year1"));
const y2fn=html.slice(html.indexOf('function renderYear2Events'),html.indexOf('function renderYear3'));
assert.ok(y2fn.indexOf('<div class="events"')<y2fn.indexOf("runningHTML(cum"));
assert.equal(html.includes('<div class="constraint">${esc(l.description'),false);
assert.equal(html.includes('<div class="alloc-rule">'),false);
const lesson=buildClosingLesson({run:3,uptime:3,capacity:3,connect:0,features:0},{run:3,uptime:3,capacity:3,connect:0,features:0},S.evaluateAll({run:3,uptime:3,capacity:3,connect:0,features:0},{run:3,uptime:3,capacity:3,connect:0,features:0}),S.DEFAULT_THRESHOLDS);
assert.equal((lesson.yourRun.join(' ').match(/Closest counterfactual:/g)||[]).length,1);assert.ok(lesson.yourRun.some(x=>x.includes('Renata')&&x.includes('Sam')));
// Execute the actual rendering functions with the current public config, without
// a DOM dependency. This catches copy hidden on the wrong screen and ordering
// regressions even when all the expected strings still exist in the source.
const vm=require('node:vm');
let rendered='';
const storage={getItem:()=>null,setItem(){},removeItem(){}};
const context=vm.createContext({
  console, URLSearchParams, document:{getElementById:()=>null,querySelectorAll:()=>[],addEventListener(){}},
  location:{pathname:'/sim03/',search:'',hash:''},history:{replaceState(){}},
  localStorage:storage,sessionStorage:storage,
  capture:value=>{rendered=value;}
});
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .filter(m=>!m[0].includes('id="account-entry-redirect"'))
  .map(m=>m[1]).join('\n').replace(/\binit\(\);\s*$/,'');
vm.runInContext(scripts,context);
vm.runInContext(`C=${JSON.stringify(cfg)}; shell=capture; wireNav=()=>{};`,context);
function display(code){vm.runInContext(code,context);return rendered;}
function inOrder(text,needles,label){
  let previous=-1;
  for(const needle of needles){
    const index=text.indexOf(needle);
    assert.ok(index>=0,`${label}: missing ${needle}`);
    assert.ok(index>previous,`${label}: wrong order for ${needle}`);
    previous=index;
  }
}
const brief=display('renderBrief()');
inOrder(brief,['Midland sells and services','The main office system','class="brief-profit"','Selling equipment brings in most of the revenue','You are about to take over technology'], 'Brief story');
const position=display('renderPosition()');
assert.ok(position.includes('Run has a $4M minimum'));
assert.ok(position.includes('$3M maximum per year')&&position.includes('cannot borrow from next year'));
const capacityRow=position.split('data-line="capacity"')[1]?.split('data-line="connect"')[0]||'';
assert.ok(capacityRow.includes('No one in the room speaks for this line.'),'Position Capacity row must name its deliberate absence');
const allocator=display('renderAllocation(1)');
assert.ok(allocator.includes('No one in the room speaks for this line.'),'Allocator uses the same neutral absence');
const a={run:3,uptime:2,capacity:1,connect:2,features:1};
const b={run:3,uptime:1,capacity:1,connect:2,features:2};
vm.runInContext(`S.year1=${JSON.stringify(a)};S.year2=${JSON.stringify(b)};S.year1Outcome=${JSON.stringify(S.evaluateYear1(a))};S.year2Outcome=${JSON.stringify(S.evaluateYear2(a,b))};`,context);
const year1Screen=display('renderYear1Outcome()');
inOrder(year1Screen,['A renewal is six weeks away','class="outcome"','Year 1 portfolio','class="running"'],'Year 1 outcome');
for(const event of [0,1]){
  const events=display(`S.year2Event=${event};renderYear2Events()`);
  inOrder(events,['First the weather turns','class="events"','class="outcome"','Cumulative portfolio','class="running"'],`Year 2 event ${event}`);
  assert.equal((events.match(/class="outcome"/g)||[]).length,event+1);
  if(event===1) assert.ok(events.lastIndexOf('class="outcome"')<events.indexOf('Cumulative portfolio'));
}
// Run is a minimum, not a new ceiling: preserve the accepted validation rules.
assert.equal(S.validateAllocation({run:4,uptime:2,capacity:1,connect:1,features:1}).ok,true);
console.log('RapidSim 03 Increment 3 checks passed (including rendered Brief, Position, Capacity, and both event orders).');
