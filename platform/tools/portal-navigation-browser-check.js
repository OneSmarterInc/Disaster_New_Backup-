#!/usr/bin/env node
// Real portal pages and browser history; disposable API fixtures, no live writes.
// Run with Playwright installed: node tools/portal-navigation-browser-check.js
// Optional: CHROMIUM_PATH=/path/to/chromium
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const publicDir = path.resolve(__dirname, '../public');
const simId = 'rapid-01-disaster';
const sim = { id:simId, sim_id:simId, number:1,title:'Disaster or Breach?',tagline:'A test case',description:'Test scenario',minutes:20,published:true,launch_url:'/sim01/',expected_seats:12 };
const course = {id:'c1',faculty_id:'f1',title:'Operations Management',term:'Fall 2026',join_code:'ABC123',enrolled:12,paid:12,sims:1,archived:false,faculty_name:'Test Teacher'};
const teacher = {id:'f1',name:'Test Teacher',email:'teacher@example.test',accepted:true,disabled:false,courses:1,students:12,paid_students:12,launches:12};
const students = Array.from({length:12},(_,i)=>({id:'s'+(i+1),student_id:'s'+(i+1),enrolment_id:'e'+(i+1),course_id:'c1',name:'Student '+(i+1),email:`student${i+1}@example.test`,paid:true,dropped:false,courses:1,with_access:1,launches:1,starts:1,completions:1,finished:1,completed_at:'2026-10-01T12:00:00Z',metrics:{score:80}}));
let role='faculty', signedIn=true, failAction='', delayCourse='', changed=0, requestLog=[];
const user = () => ({id:role==='faculty'?'f1':role==='student'?'s1':'a1',role,name:'Test User',email:'user@example.test'});
const readActions = new Set(['me','overview','faculty_detail','sim_access_list','all_students','all_courses','catalogue_fields','course_detail','sims_overview','sim_progress','student_results','catalogue','course_lookup','invite_check','reset_check']);
function reply(url,b) {
  const action=b.action; requestLog.push(action);
  if(action===failAction)return {status:503,body:{error:'temporary_failure'}};
  if(action==='me')return {body:{user:signedIn?user():null}};
  if(action==='signin'){signedIn=true;return {body:{user:user()}};}
  if(action==='signout'){signedIn=false;return {body:{ok:true}};}
  if(action==='catalogue')return {body:{sims:[sim]}};
  if(action==='course_lookup')return {body:{course}};
  if(!signedIn)return {status:401,body:{error:'not_signed_in'}};
  if(b.courseId==='missing'||b.facultyId==='missing')return {status:404,body:{error:'no_such_course'}};
  const courses=[course,{...course,id:'c2',title:'Second Course'}];
  const studentData={courses:[course],sims:[{...sim,course_id:'c1',played:1,completed_at:'2026-10-01T12:00:00Z',metrics:{score:80+changed}}]};
  if(url==='/api/student'){
    if(action==='overview')return {body:studentData};
    if(action==='course_lookup')return {body:{course}};
  }
  if(url==='/api/admin'){
    if(action==='overview')return {body:{faculty:[teacher],sims:[sim,{...sim,id:'rapid-02-relay',published:false}],totals:{students:12,courses:1,paid_seats:12,launches:12}}};
    if(action==='sim_access_list')return {body:{grants:[]}};
    if(action==='faculty_detail')return {body:{person:teacher,courses:[course],students,courseSims:[{...sim,course_id:'c1'}]}};
    if(action==='all_students')return {body:{students}};
    if(action==='all_courses')return {body:{courses}};
    if(action==='catalogue_fields')return {body:{fields:[{key:'tagline',label:'Tagline'}]}};
  }
  if(url==='/api/faculty'){
    if(action==='overview')return {body:{courses,catalogue:[sim,{...sim,id:'rapid-02-relay',title:'Second simulation'}],previews:[]}};
    if(action==='sims_overview')return {body:{sims:[{...sim,courses:1,enrolled:12,released:12,started:12,finished:12}]}};
    if(action==='course_detail')return {body:{course:courses.find(c=>c.id===b.courseId)||course,sims:[sim],roster:students,catalogue:[sim,{...sim,id:'rapid-02-relay',title:'Second simulation'}],enrolUrl:'/join.html?c=ABC123'}};
    if(action==='sim_progress')return {body:{course,sim,rows:students}};
    if(action==='student_results')return {body:{course,student:students.find(s=>s.id===b.studentId)||students[0],rows:[{...sim,starts:1,completions:1,metrics:{score:80}}]}};
  }
  if(action==='update_profile')return {body:{user:{...user(),name:b.name}}};
  return {body:{ok:true}};
}
(async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  let name=pathname==='/'?'index.html':pathname.slice(1);
  if(!path.extname(name))name+='.html';
  const file=path.resolve(publicDir,name);
  if(!file.startsWith(publicDir+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 const context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(6000);const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin!==base)return route.abort();
  if(!url.pathname.startsWith('/api/'))return route.continue();
  const b=req.postDataJSON()||{};
  const result=reply(url.pathname,b);
  if(b.courseId===delayCourse && b.action==='course_detail')await new Promise(r=>setTimeout(r,300));
  return route.fulfill({status:result.status||200,contentType:'application/json',body:JSON.stringify(result.body)});
 });
 let checks=0;
 async function settled(){await page.waitForFunction(()=>!document.getElementById('app')?.hasAttribute('aria-busy') && !document.querySelector('#app [role="status"]'));}
 async function goto(url){await page.goto(base+url);await settled();}
 async function check(label,fn){await fn();assert.deepEqual(errors,[],label+' browser errors');checks++;console.log('ok '+label);}
 async function refresh(selector){requestLog=[];await page.reload();await settled();await page.locator(selector).first().waitFor();assert(requestLog.every(x=>readActions.has(x)),'Refresh replayed an action: '+requestLog);}
 try {
  role='admin';
  for(const tab of ['fac','stu','crs','cat'])await check('admin '+tab+' direct and refresh',async()=>{await goto('/admin.html?tab='+tab);await page.locator(`[data-tab="${tab}"].on`).waitFor();await refresh(`[data-tab="${tab}"].on`);});
  await check('admin tab Back and Forward',async()=>{await goto('/admin.html');await page.locator('[data-tab="stu"]').click();await page.locator('[data-tab="cat"]').click();await page.goBack();await settled();await page.locator('[data-tab="stu"].on').waitFor();await page.goForward();await settled();await page.locator('[data-tab="cat"].on').waitFor();});
  for(const [url,selector] of [['tab=fac&invite=1','#invgo'],['tab=fac&person=f1','[data-psave="f1"]'],['tab=stu&person=s1','[data-psave="s1"]'],['tab=cat&edit='+simId,'[data-simsave]'],['tab=cat&reviewers='+simId,'[data-grant]'],['tab=cat&copy='+simId,'[data-copysave]'],['tab=cat&add=1','#s_probe'],['tab=cat&maintenance=1','#mig'],['faculty=f1','#rst']]){
   await check('admin panel '+url,async()=>{await goto('/admin.html?'+url);await refresh(selector);});
  }
  await check('admin search survives refresh without entering URL',async()=>{await goto('/admin.html?tab=stu');await page.locator('[data-q="stu"]').fill('Student 1');await page.reload();await settled();assert.equal(await page.locator('[data-q="stu"]').inputValue(),'Student 1');assert(!page.url().includes('Student'));});
  await check('admin detail opened by button survives refresh',async()=>{await goto('/admin.html');await page.locator('[data-open="f1"]').click();await page.locator('#rst').waitFor();await refresh('#rst');assert(new URL(page.url()).searchParams.get('faculty')==='f1');});
  role='faculty';
  const routes=[['','[data-tab="crs"].on'],['?tab=sim','[data-tab="sim"].on'],['?course=c1','#ce'],['?view=played&course=c1&sim='+simId,'#back'],['?view=student-results&course=c1&student=s1','#backCourse'],['?new=1','#ncgo'],['?course=c1&edit=1','#e_go'],['?course=c1&add=1','#a_go'],['?tab=sim&look='+simId,'#lookClose']];
  for(const [url,selector]of routes)await check('faculty direct and refresh '+url,async()=>{await goto('/faculty.html'+url);await refresh(selector);});
  await check('faculty nested Back Forward and refresh',async()=>{await goto('/faculty.html');await page.locator('[data-open="c1"]').click();await page.locator('[data-student-results="s1"]').click();await page.locator('#backCourse').waitFor();await page.goBack();await settled();await page.locator('#ce').waitFor();await page.goForward();await settled();await refresh('#backCourse');});
  await check('faculty save stays on course without extra history',async()=>{await goto('/faculty.html?course=c1&edit=1');const n=await page.evaluate(()=>history.length);await page.locator('#e_go').click();await page.locator('#ce').waitFor();await settled();assert.equal(await page.evaluate(()=>history.length),n);await refresh('#ce');});
  await check('faculty slow response cannot override Back',async()=>{await goto('/faculty.html');delayCourse='c1';await page.locator('[data-open="c1"]').click();await page.goBack();await settled();await page.waitForTimeout(400);await page.locator('[data-tab="crs"].on').waitFor();delayCourse='';});
  await check('missing record remains an explained error',async()=>{await goto('/faculty.html?course=missing');await page.getByText('This record is unavailable or you no longer have access to it.').waitFor();assert(page.url().includes('course=missing'));});
  await check('temporary API error and retry preserve route',async()=>{failAction='course_detail';await goto('/faculty.html?course=c1');failAction='';await page.getByRole('button',{name:'Try again'}).click();await page.locator('#ce').waitFor();assert(page.url().includes('course=c1'));});
  role='student';
  await check('student results button refresh and Back',async()=>{await goto('/student.html');await page.locator('[data-view-result]').click();await refresh('#resultHome');await page.goBack();await settled();await page.locator('#studentSearch').waitFor();});
  await check('student filter refresh',async()=>{await goto('/student.html');await page.locator('[data-student-filter="To do"]').click();await refresh('[data-student-filter="To do"].on');});
  await check('student polling retains result and updates data',async()=>{await goto('/student.html?course=c1&sim='+simId);const url=page.url();changed++;await page.evaluate(()=>draw());await page.locator('#resultHome').waitFor();assert.equal(page.url(),url);});
  await check('student missing results error',async()=>{await goto('/student.html?course=c1&sim=missing');await page.getByText('This record is unavailable or you no longer have access to it.').waitFor();});
  role='faculty';
  await check('account returns to originating result',async()=>{await goto('/faculty.html?view=student-results&course=c1&student=s1');await page.getByRole('link',{name:'Account',exact:true}).click();await page.locator('#psave').waitFor();await page.reload();await page.locator('#psave').waitFor();await page.locator('#back').click();await page.locator('#backCourse').waitFor();});
  await check('sign-in restores destination',async()=>{signedIn=false;await goto('/faculty.html?course=c1');await page.locator('#go').waitFor();await page.locator('#em').fill('teacher@example.test');await page.locator('#pw').fill('test-only-password');await page.locator('#go').click();await page.locator('#ce').waitFor();});
  await check('external and wrong-role return paths rejected',async()=>{for(const next of ['https://evil.example/','//evil.example/','/admin.html','/api/admin','/faculty.html/../../api/admin']){const result=await page.evaluate(next=>PortalNavigation.safeReturn(next,'student'),next);assert.equal(result,'/student.html');}});
  await check('no action replay on refresh',async()=>{await goto('/faculty.html?course=c1&edit=1');requestLog=[];await refresh('#e_go');assert(requestLog.every(x=>readActions.has(x)),JSON.stringify(requestLog));});

  role='admin';
  await check('admin pagination click refresh and Back',async()=>{await goto('/admin.html?tab=stu');await page.locator('[data-page="stu:2"]').click();await refresh('[data-page="stu:1"]');assert.equal(new URL(page.url()).searchParams.get('p_stu'),'2');await page.goBack();await settled();assert.equal(new URL(page.url()).searchParams.get('p_stu'),null);});
  for(const [start,button,target,param]of [
    ['?tab=fac','#inv','#invgo','invite'],['?tab=cat','#addsim','#s_probe','add'],
    ['?tab=cat','[data-simedit]','[data-simsave]','edit'],['?tab=cat','[data-rev]','[data-grant]','reviewers'],
    ['?tab=cat','#mt','#mig','maintenance']]){
    await check('admin panel button '+param,async()=>{await goto('/admin.html'+start);await page.locator(button).first().click();await refresh(target);assert(new URL(page.url()).searchParams.has(param));});
  }
  role='faculty';
  await check('faculty roster pagination retained after result return',async()=>{await goto('/faculty.html?course=c1');await page.locator('[data-page-key="ros"][data-page="2"]').click();await page.locator('[data-student-results="s11"]').click();await page.locator('#backCourse').click();await settled();await refresh('[data-student-results="s11"]');assert.equal(new URL(page.url()).searchParams.get('p_ros'),'2');});
  await check('faculty overlay closes on Back and reopens on Forward',async()=>{await goto('/faculty.html?tab=sim');await page.locator('[data-look]').first().click();await page.locator('#lookClose').waitFor();await page.goBack();await settled();assert.equal(await page.locator('#lookSheet').count(),0);await page.goForward();await settled();await page.locator('#lookClose').waitFor();});
  await check('add simulation button restores and never submits on refresh',async()=>{await goto('/faculty.html?course=c1');await page.locator('#as').click();await refresh('#a_go');});
  await check('account destination survives expired session and sign-in',async()=>{await goto('/faculty.html?course=c1');await page.getByRole('link',{name:'Account',exact:true}).click();await page.locator('#psave').waitFor();signedIn=false;await page.reload();await page.locator('#em').waitFor();await page.locator('#em').fill('teacher@example.test');await page.locator('#pw').fill('fixture-only');await page.locator('#go').click();await page.locator('#psave').waitFor();await page.locator('#back').click();await page.locator('#ce').waitFor();});
  await check('authentication network failure does not sign out',async()=>{failAction='me';await goto('/faculty.html?course=c1');await page.getByRole('button',{name:'Try again'}).waitFor();assert(page.url().includes('/faculty.html?course=c1'));failAction='';await page.getByRole('button',{name:'Try again'}).click();await page.locator('#ce').waitFor();});
  role='student';
  await check('manual course code retained on refresh',async()=>{await goto('/join.html');await page.locator('#cc').fill('ABC123');await page.locator('#go').click();await page.locator('#join').waitFor();await refresh('#join');assert.equal(new URL(page.url()).searchParams.get('c'),'ABC123');});
  await check('student poll failure recovers with unchanged data',async()=>{await goto('/student.html?course=c1&sim='+simId);failAction='overview';await page.evaluate(async()=>{await draw();await draw();});await page.locator('#retry').waitFor();failAction='';await page.locator('#retry').click();await page.locator('#resultHome').waitFor();});
  await check('public catalogue Back Forward and refresh',async()=>{await goto('/?sim='+simId);await page.locator('#back').click();await page.locator('[data-open]').first().click();await refresh('#back');await page.goBack();await page.locator('[data-open]').first().waitFor();await page.goForward();await page.locator('#back').waitFor();});
  await check('separate tabs keep independent destinations',async()=>{await goto('/student.html?course=c1&sim='+simId);const other=await page.context().newPage();await other.goto(base+'/student.html');await other.close();assert.equal(new URL(page.url()).searchParams.get('course'),'c1');});
  for(const [r,url,selector]of [['admin','/admin.html?tab=stu','[data-tab="stu"].on'],['faculty','/faculty.html?course=c1','#ce'],['student','/student.html?course=c1&sim='+simId,'#resultHome']]){
    await check(r+' mobile refresh',async()=>{role=r;await page.setViewportSize({width:390,height:844});await goto(url);await refresh(selector);});
  }
  await check('session entry form refresh and Back',async()=>{
    signedIn=false;
    await goto('/session.html?sim=rapid-03-midland&session=ABCDE&course=c1');
    await page.locator('#switch-account').click();
    await refresh('#account-form');
    assert.equal(await page.locator('#name').count(),0);
    await page.goBack();await page.locator('#name').waitFor();signedIn=true;
  });
  assert.deepEqual(errors,[]);console.log(`${checks} browser checks passed`);
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
