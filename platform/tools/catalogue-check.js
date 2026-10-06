#!/usr/bin/env node
global.RapidSimsIdentity = require('../public/sim-identity.js');
// The catalogue is the front door and is open to everybody. It must render
// signed out, show what each simulation sent about itself, and never mention
// groups — these are played individually.
// what the simulations sent about themselves.
const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'../public/index.html'),'utf8');
const assert=require('node:assert/strict');
const js=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).join('\n');
let LAST='';
function mk(id){const o={id,innerHTML:'',style:{},dataset:{},textContent:'',
  addEventListener(){},setAttribute(){},focus(){},
  querySelectorAll:()=>[],querySelector:()=>mk('x')};return o;}
const app={get innerHTML(){return LAST;},set innerHTML(v){LAST=v;},
  querySelectorAll(sel){const m=sel.match(/\[data-(\w+)\]/);if(!m)return[];
    return [...LAST.matchAll(new RegExp(`data-${m[1]}="([^"]*)"`,'g'))].map(x=>{const e=mk('d');e.dataset[m[1]]=x[1];return e;});},
  querySelector:()=>mk('x')};
global.window={scrollTo(){}};global.location={href:''};
global.document={getElementById:id=>id==='app'?app:mk(id),createElement:()=>mk('t'),addEventListener(){},
  body:{appendChild(){}},querySelector:()=>mk('x'),querySelectorAll:()=>[]};

const SIM = { id:'rapid-01-disaster', number:1, title:'Disaster or Breach?',
  tagline:'Twenty minutes inside an incident nobody can classify yet.',
  description:'Data corruption is spreading across client applications at two in the morning.',
  minutes:20,
  detail:{ world:'IT operations', seat:'VP of Operations', clock:'02:14 to Day 3',
    teaches:'Sequencing under uncertainty',
    tangle:'A failing array and an intruder look identical.',
    turn:'Two people are exposed by opposite explanations.',
    cast:[{name:'Kate Sullivan',role:'Director, Infrastructure',stake:'Specified the array.'}],
    beats:[{at:'Hour 4',what:'Three applications down.'}],
    after:'The debrief reads their commitments back.' } };

let SIGNED_IN = false;
global.fetch = async (p, o) => {
  const b = JSON.parse(o.body);
  if (b.action === 'me') { if (!SIGNED_IN) { const e={ok:false,status:401,json:async()=>({error:'x'})}; return e; }
    return { ok:true, json:async()=>({ user:{ name:'Chuck Rivera', role:'faculty' } }) }; }
  return { ok:true, json: async () => ({ sims:[SIM] }) };
};
const strip = s => s.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
new Function('window','location','document','fetch', js)(global.window, global.location, global.document, global.fetch);

setTimeout(() => {
  console.log('  signed out, the list:');
  console.log('    ' + strip(LAST).slice(0, 300));
  console.log('  mentions groups:', /group/i.test(LAST));
  console.log('  shows what it teaches:', LAST.includes('Sequencing under uncertainty'));
  assert.ok(LAST.includes(SIM.title), 'signed-out users see the catalogue');
  assert.ok(LAST.includes('Sequencing under uncertainty'), 'the teaching description renders');
}, 60);
