// DOM smoke test for the student page. Needs jsdom: npm i --no-save jsdom@24
const {session,config,call,fs,path,assert,SIM,addClock}=require('./dom-common.js');
const {JSDOM}=require('jsdom');
(async()=>{
  const code=(await call(session,'POST',{action:'create',mode:'individual',facultyCode:'f'},{})).body.session.code;
  const html=fs.readFileSync(path.join(SIM,'public/index.html'),'utf8').replace(/@import url\([^)]*\);/,'');
  const dom=new JSDOM(html,{url:`https://x.test/index.html?session=${code}&guest=1`,runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
    w.sessionStorage.setItem('m06-access','open');
    w.fetch=async(u,o={})=>{const h=u.includes('/api/session')?session:config;const hd={};Object.entries(o.headers||{}).forEach(([k,v])=>hd[k.toLowerCase()]=v);
      const r=await call(h,o.method||'GET',o.body?JSON.parse(o.body):{},hd);return {ok:r.status<400,status:r.status,json:async()=>r.body}};
  }});
  const w=dom.window,$=s=>w.document.querySelector(s),text=()=>w.document.getElementById('app').textContent;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  await wait(300);
  assert.ok(text().includes('Join your class session'),'entry shown');
  w.document.getElementById('nm').value='Ana';$('#go').click();await wait(300);
  assert.ok(text().includes('What is going on'),'walkthrough screen 1');
  for(let i=0;i<3;i++){$('#next').click();await wait(50)}
  assert.ok(text().includes('Before the clock starts'),'walkthrough screen 4');
  $('#next').click();await wait(300);
  assert.ok(text().includes('Waiting for your instructor'),'lobby after walkthrough');
  $('[data-doc="northline"]').click();await wait(100);
  assert.ok(w.document.getElementById('modal').textContent.includes('Meridian Transit Networks'),'document opens');
  assert.ok(!w.document.querySelector('#modal mark'),'no highlight before reveal');
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));await wait(100);
  assert.strictEqual(w.document.getElementById('modal').innerHTML,'','escape closes');
  await call(session,'POST',{action:'control',code,set:'start',facultyCode:'f'},{});
  addClock(100000);await wait(1700);
  assert.ok(text().includes('Report 3 of 12'),'reports shown: '+text().slice(0,120));
  $('[data-c="stay"]').click();await wait(50);
  $('#ok').click();await wait(100);
  assert.ok(w.document.getElementById('me').textContent.includes('Write one line'),'reason required');
  w.document.getElementById('why').value='Meridian in both';$('#ok').click();await wait(1800);
  assert.ok(text().includes('committed to staying on Northline at report 3'),'decision shown');
  addClock(600000);await wait(1800);
  assert.ok(text().includes('What was underneath'),'reveal shown');
  assert.ok(text().includes('Your reason: Meridian in both'),'reason in reveal');
  $('[data-rdoc="clearpath"]').click();await wait(100);
  assert.ok(w.document.querySelector('#modal mark').textContent.includes('Meridian'),'highlight after reveal');
  const svg=w.document.querySelector('svg');assert.ok(svg&&svg.querySelectorAll('rect').length===5,'map drawn');
  await call(session,'POST',{action:'control',code,set:'close',facultyCode:'f'},{});
  const pid=w.localStorage.getItem('m06-pid-'+code);
  const resumed=new JSDOM(html,{url:`https://x.test/index.html?session=${code}&guest=1`,runScripts:'dangerously',pretendToBeVisual:true,beforeParse(rw){
    rw.sessionStorage.setItem('m06-access','open');
    rw.localStorage.setItem('m06-pid-'+code,pid);
    rw.localStorage.setItem('m06-wt-'+code,'1');
    rw.fetch=async(u,o={})=>{const h=u.includes('/api/session')?session:config;const hd={};Object.entries(o.headers||{}).forEach(([k,v])=>hd[k.toLowerCase()]=v);
      const query=Object.fromEntries(new URL(u,'https://x.test').searchParams);
      const r=await call(h,o.method||'GET',o.body?JSON.parse(o.body):query,hd);return {ok:r.status<400,status:r.status,json:async()=>r.body}};
  }});
  await wait(300);
  assert.ok(resumed.window.document.getElementById('app').textContent.includes('What was underneath'),'returning student can reload the explanation after the room closes');
  resumed.window.close();
  console.log('DOM smoke passed');w.close();process.exit(0);
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
