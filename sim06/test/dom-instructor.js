// DOM smoke test for the instructor page. Needs jsdom: npm i --no-save jsdom@24
const {session,call,fs,path,assert,SIM,addClock}=require('./dom-common.js');
const {JSDOM}=require('jsdom');
(async()=>{
  const html=fs.readFileSync(path.join(SIM,'public/instructor.html'),'utf8').replace(/@import url\([^)]*\);/,'');
  const dom=new JSDOM(html,{url:'https://x.test/instructor.html',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
    w.confirm=()=>true;
    w.fetch=async(u,o={})=>{const hd={};Object.entries(o.headers||{}).forEach(([k,v])=>hd[k.toLowerCase()]=v);const r=await call(session,'POST',JSON.parse(o.body),hd);return {ok:r.status<400,status:r.status,json:async()=>r.body}};
  }});
  const w=dom.window,$=s=>w.document.querySelector(s),text=()=>w.document.getElementById('app').textContent,wait=ms=>new Promise(r=>setTimeout(r,ms));
  await wait(200);
  assert.ok($('#create').disabled,'create disabled until a mode is chosen');
  $('[data-m="individual"]').click();await wait(50);
  w.document.getElementById('fc').value='f';$('#create').click();await wait(300);
  const code=$('.code').textContent;assert.ok(/^[A-Z2-9]{5}$/.test(code),'code shown');
  $('#pres').click();await wait(50);assert.ok($('.join-big'),'join code projection');$('#exit').click();await wait(50);
  await call(session,'POST',{action:'join',code,name:'Ana'},{});
  $('#start').click();await wait(300);
  addClock(100000);await wait(2200);
  assert.ok(text().includes('Decisions by report'),'projector live');
  assert.ok(!text().includes('Debrief, in this order'),'no debrief during play');
  addClock(600000);await wait(2200);
  assert.ok(text().includes('Debrief, in this order')&&text().includes('Disagreement'),'debrief after clock');
  assert.ok(!text().includes('Ana'),'no names on the console');
  console.log('instructor DOM smoke passed');process.exit(0);
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
