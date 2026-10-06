const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const F=require('./new-sims-entry-fixture.js');
const path=require('node:path'),root=path.resolve(__dirname,'../..');
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};
const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
let checks=0;function ok(v,msg){assert.ok(v,msg);checks++}
async function page(n,kind='index',url='',saved={}){
 const elements=new Map(),timers=new Map(),timeouts=new Map(),requests=[];let next=0;
 class El{
  constructor(id=''){this.id=id;this.value='';this._html='';this._text='';this.children=[];this.hidden=false;this.classList={toggle(){}}}
  set innerHTML(s){for(const id of this.children)elements.delete(id);this.children=[];this._html=String(s);for(const m of this._html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){const el=new El(m[1]);el.value=(m[0].match(/\bvalue="([^"]*)"/)||[])[1]||'';elements.set(el.id,el);this.children.push(el.id)}}
  get innerHTML(){return this._html||escape(this._text)}
  set textContent(s){this._text=String(s);this._html=''}get textContent(){return this._text}
  querySelectorAll(){return []}querySelector(){return null}focus(){}addEventListener(){}
 }
 const dom={getElementById:id=>elements.get(id)||null,createElement:()=>new El(),querySelectorAll:()=>[],querySelector:()=>null};
 const html=fs.readFileSync(path.join(root,`sim${n}/public/${kind}.html`),'utf8');
 for(const m of html.split('<script>')[0].matchAll(/\bid="([^"]+)"/g))elements.set(m[1],new El(m[1]));
 let target=new URL(url||`http://fixture/sim${n}/${kind}.html`);let redirect=null;
 const location={get pathname(){return target.pathname},get search(){return target.search},get hash(){return target.hash},replace:u=>{redirect=new URL(u,target).href},assign:u=>{redirect=new URL(u,target).href},reload(){}};
 const ss=saved.ss||storage(),ls=saved.ls||storage();
 const ctx=vm.createContext({document:dom,location,history:{replaceState(_,__,u){target=new URL(u,target)}},sessionStorage:ss,localStorage:ls,TextDecoder,Uint8Array,URLSearchParams,Date,AbortSignal,console,scrollTo(){},matchMedia:()=>({matches:false}),performance:{now:()=>0},atob:t=>Buffer.from(t,'base64').toString('binary'),setInterval:f=>{timers.set(++next,f);return next},clearInterval:id=>timers.delete(id),setTimeout:f=>{timeouts.set(++next,f);return next},clearTimeout:id=>timeouts.delete(id)});
 ctx.window={addEventListener(){}};
 // This fixture exercises the sim client after the shared account entry.
 // The actual account decision is covered by tools/test-entry-flow.js.
 ctx.platformLaunch=async()=>({status:'signed_out'});
 ctx.fetch=async(u,opt={})=>{
  const targetURL=new URL(u,target),name=targetURL.pathname.split('/').at(-1);requests.push(targetURL.pathname+targetURL.search);
  const req={method:opt.method||'GET',headers:opt.headers||{},query:Object.fromEntries(targetURL.searchParams),body:opt.body?JSON.parse(opt.body):{}};
  const r=await F.api(n,name,req);return {ok:r.status>=200&&r.status<300,status:r.status,json:async()=>r.body};
 };
 let js=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 if(kind==='index')js=n==='07'?js.replace('// ---- boot ----\n(async()=>{','// ---- boot ----\nglobalThis.ready=(async()=>{'):js.replace(/init\(\);\s*$/, 'globalThis.ready=init();');
 vm.runInContext(js,ctx);if(ctx.ready)await ctx.ready;
 const drain=async()=>{for(let i=0;i<5;i++)await Promise.resolve()};
 return {ctx,ss,ls,elements,requests,dom,body:()=>elements.get('app')?.innerHTML||'',redirect:()=>redirect,run:s=>vm.runInContext(s,ctx),click:async id=>{const el=elements.get(id);assert.ok(el&&el.onclick,`button ${id} exists`);await el.onclick();await drain()},tick:async()=>{for(const fn of [...timers.values()])await fn();await drain()},retry:async()=>{const fns=[...timeouts.values()];timeouts.clear();for(const fn of fns)await fn();await drain()}};
}

(async()=>{
 for(const n of ['07','08','09']){
  const key=n==='07'?'w07':'m'+n;
  const gate=await page(n,'launch',`http://fixture/sim${n}/launch.html?guest=1`);gate.elements.get('code').value='entry-test';await gate.click('open');
  ok(gate.redirect().endsWith('/index.html?guest=1'),`${n}: access code opens student page`);
  let p=await page(n,'index',`http://fixture/sim${n}/index.html?guest=1`,gate);
  ok(!p.body().includes('Session code'),`${n}: direct play needs no session code`);
  if(n==='09'){p.elements.get('sn').value='Solo Student';await p.click('sb')}
  ok(p.run(n==='07'?'S.solo&&currentView()===\'intro\'':n==='09'?'S.session.solo&&!!S.view':'S.solo&&!!S.view'),`${n}: standalone play opens`);
  if(n==='07'){
    ok(p.run('S.soloClosesAt')===null&&p.elements.get('bar').hidden,'07: solo introduction has no timer or navigation');
    ok(p.body().includes('How this works')&&!p.body().includes('What your team put together'),'07: introduction precedes the timed briefing');
    F.advance(120000);await p.tick();
    ok(p.run('currentView()')==='intro'&&p.run('S.soloClosesAt')===null,'07: reading the introduction consumes no decision time');
    await p.click('startClock');
    ok(p.run('S.soloClosesAt-Date.now()===C.settings.decisionMinutes*60000'),'07: student start gives the full decision interval');
    ok(p.run('currentView()')==='briefing'&&!p.elements.get('bar').hidden,'07: student start opens the briefing and navigation');
    p.run("S.choice='buy';S.text='The acquisition gives us an affordable option for a different way of doing business.'");
    await p.run('submitDecision({disabled:false})');await p.run("submitRecognition('no')");
    ok(p.run('S.soloStage')===1,'07: solo recognition opens the first reveal');
    ok(p.elements.get('clock').textContent.includes('1:30'),'07: reveal shows its countdown');
    F.advance(89000);await p.tick();
    ok(p.run('S.soloStage')===1,'07: student reveal preserves the reading interval');
    F.failReveal();F.advance(1000);await p.tick();
    ok(p.run('S.soloStage')===1&&p.body().includes('Unable to load the next part'),'07: failed reveal keeps current content and shows an error');
    ok(p.run('S.soloNextAt>Date.now()'),'07: failed reveal schedules another attempt');
    F.advance(5000);await p.tick();
    ok(p.run('S.soloStage')===2,'07: failed reveal recovers automatically');
    F.advance(90000);await p.tick();
    ok(p.run('S.soloStage')===3&&p.run('S.soloNextAt')===null,'07: solo flow reaches the ending and stops');
  }
  const student=F.tok(n),faculty=F.tok(n,{sub:'teacher-'+n,role:'faculty',mode:'session'});
  if(n==='09'){
    const first=await page(n,'index',`http://fixture/sim09/index.html#lt=${encodeURIComponent(student)}`);
    const oldCode=first.run('S.code');
    const changed=await page(n,'index',`http://fixture/sim09/index.html#lt=${encodeURIComponent(F.tok(n,{course:'another-course'}))}`,first);
    ok(changed.run('S.code')!==oldCode,'09: a different course creates its own solo run');
    ok((await F.fixtures[n].store.getSession(changed.run('S.code'))).courseId==='another-course','09: solo retains its signed course');
  }
  if(n==='07'){
    const solo=await page(n,'index',`http://fixture/sim07/index.html#lt=${encodeURIComponent(student)}`);
    ok(solo.run('currentView()')==='intro'&&solo.run('S.soloClosesAt')===null,'07: signed solo entry also waits for student start');
    await solo.click('startClock');
    solo.run("S.choice='decline';S.text='The losses make the proposed acquisition too uncertain for our business today.'");
    await solo.run('submitDecision({disabled:false})');F.failReveal();await solo.run("submitRecognition('no')");
    ok(solo.run('S.soloStage')===0&&solo.body().includes('Try again now'),'07: first reveal failure is visible and can be retried');
    await solo.click('reveal-retry');
    ok(solo.run('S.soloStage')===1,'07: manual retry recovers the first reveal');

    const denied=await page(n,'index',`http://fixture/sim07/demo#lt=${encodeURIComponent(student)}`);
    ok(!denied.run('S.demo')&&denied.body().includes('Faculty code'),'07: student cannot enter faculty demo');
    denied.elements.get('demo-code').value='entry-test';await denied.click('demo-open');
    ok(!denied.run('S.demo')&&denied.body().includes('Enter a valid faculty code'),'07: student access code cannot enter demo');
    denied.elements.get('demo-code').value='faculty-test';await denied.click('demo-open');
    ok(denied.run('S.demo')&&denied.run('S.soloClosesAt')===null,'07: faculty code opens an untimed demo');
    denied.ss.setItem('w07-faculty-lt',F.tok(n,{role:'faculty',exp:Date.now()-1}));
    const codeRefresh=await page(n,'index','http://fixture/sim07/demo',denied);
    ok(codeRefresh.run('S.demo'),'07: remembered faculty code survives refresh despite an expired account token');

    const preview=await page(n,'index',`http://fixture/sim07/index.html#lt=${encodeURIComponent(faculty)}`);
    ok(preview.body().includes('Demo without timers'),'07: faculty preview exposes demo entry');
    const demo=await page(n,'index','http://fixture/sim07/demo',preview);
    ok(demo.run('S.demo')&&demo.elements.get('clock').textContent.includes('no timers'),'07: verified faculty token opens demo with a clear label');
    F.advance(11*60000);await demo.tick();
    ok(!demo.run('needsLapse()')&&demo.run('decisionOpen()'),'07: demo decision never expires');
    demo.run("S.choice='buy';S.text='The acquisition gives us an affordable option for a different way of doing business.'");
    await demo.run('submitDecision({disabled:false})');await demo.run("submitRecognition('no')");
    ok(demo.run('S.soloStage')===1&&demo.run('S.soloNextAt')===null,'07: demo opens first reveal without starting a waiting timer');
    F.advance(90000);await demo.tick();
    ok(demo.run('S.soloStage')===1,'07: demo stays on the part the faculty is presenting');
    await demo.click('reveal-next');await demo.click('reveal-next');
    ok(demo.run('S.soloStage')===3,'07: faculty can show both remaining parts immediately');
    ok(!demo.requests.some(u=>u.endsWith('/finish')),'07: demo never reports a student completion');
  }
  const router=await page(n,'launch',`http://fixture/sim${n}#lt=${encodeURIComponent(student)}`);
  ok(router.redirect().includes(`/sim${n}/index.html#lt=`),`${n}: signed Play goes directly to student page`);
  const instructor=await page(n,'launch',`http://fixture/sim${n}#lt=${encodeURIComponent(faculty)}`);
  ok(instructor.redirect().includes(`/sim${n}/instructor.html#lt=`),`${n}: faculty Run a session opens console`);

  // A stale platform solo token cannot attach a later direct guest run to it.
  gate.ss.setItem(key+'-lt:solo',student);
  const clean=await page(n,'launch',`http://fixture/sim${n}/launch.html?guest=1`,gate);
  ok(clean.ss.getItem(key+'-lt:solo')===null,`${n}: direct entry clears previous solo account token`);
  const guest=(await F.invoke(n,{action:'create',mode:'individual',facultyCode:'faculty-test'})).body.session.code;
  const jr=await F.api(n,'join',{method:'GET',query:{session:guest},headers:{}});
  ok(jr.redirect===`../index.html?session=${guest}&guest=1`,`${n}: guest invitation stays on this sim`);
  p=await page(n,'index',`http://fixture/sim${n}/index.html?session=${guest}&guest=1`);
  ok(p.body().includes('Join'),`${n}: guest sees join form without access code`);
  p.elements.get(n==='07'?'nm':'jn').value='Class Guest';await p.click(n==='07'?'join':'jb');
  ok(Object.keys(await F.fixtures[n].store.getParticipants(guest)).length===1,`${n}: guest joins faculty room`);
  p=await page(n,'index',`http://fixture/sim${n}/index.html?session=${guest}&guest=1`,p);
  ok(n==='07'?p.run('currentView()')==='intro'&&p.body().includes('Welcome, Class Guest')&&p.elements.get('bar').hidden:p.body().includes("You're in."),`${n}: guest refresh stays in class`);

  const room=(await F.invoke(n,{action:'create',mode:'individual',launchToken:faculty})).body.session.code;
  const plain=await page(n,'index',`http://fixture/sim${n}/index.html?session=${room}`);
  ok(plain.redirect()?.includes('/api/join?session='),`${n}: unsigned platform class goes to account entry`);
  p=await page(n,'index',`http://fixture/sim${n}/index.html?session=${room}#lt=${encodeURIComponent(student)}`);
  ok(Object.keys(await F.fixtures[n].store.getParticipants(room)).includes('platform:student-'+n),`${n}: signed student auto-joins own account`);
  p=await page(n,'index',`http://fixture/sim${n}/index.html?session=${room}`,p);
  ok(!p.redirect()&&(n==='07'?p.run('currentView()')==='intro'&&p.body().includes('Welcome, Test Student'):p.body().includes("You're in.")),`${n}: signed token survives refresh`);
  ok(p.requests.every(x=>x.startsWith(`/sim${n}/api/`)),`${n}: all APIs use platform path prefix`);
  if(n==='07'){
    F.advance(120000);await p.tick();
    ok(p.run('currentView()')==='intro'&&!p.run('closesAt()')&&p.elements.get('bar').hidden,'07: class lobby keeps the introduction untimed');
    ok(!p.elements.has('startClock'),'07: class introduction waits for the instructor rather than starting a solo clock');
  }
  await F.invoke(n,{action:'control',set:'start',code:room,launchToken:faculty});await p.tick();
  if(n==='07'){
    ok(p.run('currentView()')==='briefing'&&p.run('closesAt()>Date.now()')&&!p.elements.get('bar').hidden,'07: instructor start opens the class briefing and timer');
    p.run("S.choice='buy';S.text='The acquisition gives us an affordable option for a different way of doing business.'");
    await p.run('submitDecision({disabled:false})');await p.run("submitRecognition('no')");
    await F.invoke(n,{action:'control',set:'end_decisions',code:room,launchToken:faculty});F.advance(21000);
    for(const stage of [1,2,3])await F.invoke(n,{action:'control',set:'release',stage,code:room,launchToken:faculty});
  }else{
    F.advance(1800000);
    if(n==='09')for(const stage of require(F.fixtures[n].base+'/config/content.js').REVEAL.stages)await F.invoke(n,{action:'control',set:'release',code:room,launchToken:faculty});
  }
  F.fail();await p.tick();await p.retry();await p.tick();await p.retry();
  const reports=F.reports.filter(r=>r.n===n&&r.launch.sub==='student-'+n);
  ok(reports.length===1,`${n}: a failed completion callback is retried and then stops`);
  ok(reports[0].launch.course==='course-'+n,`${n}: completion belongs to correct faculty course`);
  console.log(`Sim ${n}: client flow checks passed`);
 }
 console.log(`${checks} client flow assertions passed (Node VM; no live browser)`);
})().catch(e=>{console.error(e);process.exitCode=1});
