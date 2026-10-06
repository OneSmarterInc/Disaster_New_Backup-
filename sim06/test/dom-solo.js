// DOM smoke test for a private standalone run. Needs jsdom: npm i --no-save jsdom@24
const {session,config,call,fs,path,assert,SIM,addClock,getClock}=require('./dom-common.js');
const {JSDOM}=require('jsdom');
(async()=>{
  const html=fs.readFileSync(path.join(SIM,'public/index.html'),'utf8').replace(/@import url\([^)]*\);/,'');
  const dom=new JSDOM(html,{url:'https://x.test/index.html?guest=1',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
    w.sessionStorage.setItem('m06-access','open');
    w.Date.now=()=>getClock();
    w.fetch=async(u,o={})=>{const h=u.includes('/api/session')?session:config;const hd={};Object.entries(o.headers||{}).forEach(([k,v])=>hd[k.toLowerCase()]=v);
      const r=await call(h,o.method||'GET',o.body?JSON.parse(o.body):{},hd);return {ok:r.status<400,status:r.status,json:async()=>r.body}};
  }});
  const w=dom.window,$=s=>w.document.querySelector(s),text=()=>w.document.getElementById('app').textContent,wait=ms=>new Promise(r=>setTimeout(r,ms));
  await wait(300);
  assert.ok(text().includes('Play on your own'),'solo entry: '+text().slice(0,80));
  w.document.getElementById('nm').value='Solo';$('#go').click();await wait(300);
  assert.ok(text().includes('What is going on'),'walkthrough 1');
  $('#next').click();await wait(50);
  assert.ok(text().includes('When you press Start simulation'),'solo wording on screen 2');
  assert.ok(!text().includes('Everyone in the room'),'no room line for solo');
  $('#skip').click();await wait(300);
  $('#begin').click();await wait(300);
  addClock(50000);await wait(1700);
  assert.ok(text().includes('Report 2 of 12'),'solo reports arriving');
  $('[data-c="stay"]').click();await wait(50);
  w.document.getElementById('why').value='Still considering the reports';
  addClock(600000);await wait(1800);
  assert.strictEqual(w.document.getElementById('modal').innerHTML,'','expired clock closes the reason dialog');
  assert.ok(text().includes('What was underneath'),'explanation opens without submitting an expired draft');
  assert.ok(text().includes('You made no decision'),'expired draft is not recorded as a decision');
  console.log('solo DOM smoke passed');process.exit(0);
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
