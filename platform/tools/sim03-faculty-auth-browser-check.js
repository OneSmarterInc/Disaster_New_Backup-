// Real HTML, HTTPS cookies and production handlers; disposable SQL/session adapters.
// No production accounts, enrolments, secrets, or Redis records are changed.
const assert = require('node:assert/strict');
const https = require('node:https');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const { chromium } = require('playwright');
const f = require('./sim03-account-fixture.js');
const { sign, verify } = require('../lib/launch.js');
const exec = promisify(execFile);
const root = path.resolve(__dirname, '../..');
const artifacts = path.resolve('browser-artifacts/faculty-auth');
let server, browser, certDir, base, checks = 0;
const errors = [], requests = [], contexts = [];
const equal = (a,b,label) => { assert.deepEqual(a,b,label); checks++; console.log('PASS:',label); };
async function page(name, email) {
  const context = await browser.newContext({ignoreHTTPSErrors:true}); contexts.push(context);
  await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
  const p = await context.newPage(); p.setDefaultTimeout(8000);
  p.on('pageerror',e=>errors.push(name+': '+e.message));
  if (email) equal((await context.request.post(base+'/api/auth',{data:{action:'signin',email,password:'password123'}})).status(),200,name+' signs in with a real Secure cookie');
  return p;
}
async function requestToken(p) {
  const r=await p.context().request.get(base+'/api/launch?sim='+f.sim.id+'&course=course-a&mode=session&format=json');
  equal(r.status(),200,'faculty platform launch succeeds');
  return new URLSearchParams(new URL((await r.json()).url).hash.slice(1)).get('lt');
}
async function sessionCode(p) {
  await p.locator('#join').waitFor();
  return new URL(await p.locator('#join').inputValue()).searchParams.get('session');
}
(async()=>{
  await fs.mkdir(artifacts,{recursive:true});
  certDir=await fs.mkdtemp(path.join(os.tmpdir(),'faculty-auth-'));
  const key=path.join(certDir,'key.pem'),cert=path.join(certDir,'cert.pem');
  await exec('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost']);
  server=https.createServer({key:await fs.readFile(key),cert:await fs.readFile(cert)},async(req,res)=>{
    try {
      const url=new URL(req.url,base); requests.push(url.pathname+url.search);
      const simPath=url.pathname.startsWith('/sim03/');
      const pathname=simPath?url.pathname.slice(6):url.pathname;
      if(pathname.startsWith('/api/')) {
        const chunks=[];for await(const chunk of req)chunks.push(chunk);
        const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{};
        const r=await f.call(pathname.slice(5),body,{headers:req.headers,method:req.method,query:Object.fromEntries(url.searchParams)});
        Object.entries(r.headers).forEach(([k,v])=>res.setHeader(k,v));res.statusCode=r.statusCode;
        if(r.url)res.setHeader('location',r.url);
        res.setHeader('content-type','application/json');return res.end(r.payload?JSON.stringify(r.payload):'');
      }
      if(['/instructor.html','/faculty-workspace.js','/faculty-workspace.css'].includes(pathname)){
        res.setHeader('content-type',pathname.endsWith('.js')?'text/javascript':pathname.endsWith('.css')?'text/css':'text/html');return res.end(await fs.readFile(path.join(root,'sim03/public',pathname.slice(1))));
      }
      res.statusCode=404;res.end();
    }catch(e){errors.push(e.stack);res.statusCode=500;res.end('{}');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='https://127.0.0.1:'+server.address().port;
  process.env.PLATFORM_URL=base;f.sim.launch_url=base+'/sim03';
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});

  const form=await page('standalone');process.env.FACULTY_CODES='Standalone:code-for-test';
  await form.goto(base+'/instructor.html');
  await form.locator('#name').fill('Friday "class"');await form.locator('#fc').fill('code-for-test');
  await form.locator('[data-mode="team"]').click();
  equal(await form.locator('#name').inputValue(),'Friday "class"','switching mode preserves class name');
  equal(await form.locator('#fc').inputValue(),'code-for-test','switching mode preserves facilitator authorization');
  await form.locator('#create').click();await form.locator('#join').waitFor();
  equal(await form.evaluate(()=>state.session.mode),'team','standalone configured code still creates a team session');
  delete process.env.FACULTY_CODES;

  const teacher=await page('missing-token','teacher@example.test');
  await teacher.goto(base+'/sim03/instructor.html');
  await teacher.locator('#name').fill('Recovered Friday class');await teacher.locator('[data-mode="team"]').click();
  await teacher.locator('#create').click();const code=await sessionCode(teacher);
  equal(f.sessions.get(code).courseId,'course-a','missing token recovers from signed-in faculty and binds the sole eligible course');
  equal(f.sessions.get(code).name,'Recovered Friday class','recovery keeps the session name');
  equal(f.sessions.get(code).platformAuth,true,'recovered session requires signed student identity');
  equal(await teacher.locator('#fc').count(),0,'authenticated faculty are not asked for a separate facilitator code');
  equal(new URL(teacher.url()).hash,'#'+code,'URL contains the session code, not credentials');
  await teacher.screenshot({path:path.join(artifacts,'01-recovered-team-session.png'),fullPage:true});

  const saved=await teacher.evaluate(()=>sessionStorage.getItem('m03-faculty-lt'));
  const expired=sign({...verify(saved),exp:Date.now()-1000});
  await teacher.evaluate(t=>sessionStorage.setItem('m03-faculty-lt',t),expired);await teacher.reload();
  await teacher.locator('#resumeBtn').click();equal(await sessionCode(teacher),code,'expired authorization resumes the original room');
  equal(f.sessions.size,2,'renewal did not create a duplicate room');
  // Expiry while already in the console must renew once and retain the room.
  const before=requests.filter(x=>x.startsWith('/api/launch?')).length;
  await teacher.evaluate(t=>{LT=t;return Promise.all([api({action:'faculty_state',code}),api({action:'faculty_state',code})]);},expired);
  equal(requests.filter(x=>x.startsWith('/api/launch?')).length-before,1,'concurrent expired requests share one renewal');
  equal(await teacher.evaluate(()=>code),code,'live refresh preserves session state');

  f.courses.set('course-b',{id:'course-b',title:'Second course',join_code:'SECOND',faculty_id:'teacher',archived:false});
  const multi=await page('multiple-courses','teacher@example.test');await multi.goto(base+'/sim03/instructor.html');
  await multi.locator('#name').fill('Select my course');await multi.locator('[data-mode="individual"]').click();await multi.locator('#create').click();
  await multi.locator('#facultyCourse').waitFor();
  equal(await multi.locator('#facultyCourse option').count(),3,'multiple courses require an explicit choice');
  equal(f.sessions.size,2,'no unbound session is created while course choice is missing');
  await multi.locator('#facultyCourse').selectOption('course-b');await multi.locator('#create').click();const second=await sessionCode(multi);
  equal(f.sessions.get(second).courseId,'course-b','selected course is authorized by the server');
  equal(f.sessions.get(second).mode,'individual','individual session creation remains supported');
  equal(f.sessions.get(second).name,'Select my course','course selection preserves the draft');

  for(const [name,email] of [['anonymous',null],['student','alice@example.test']]){
    const denied=await page(name,email);await denied.goto(base+'/sim03/instructor.html?course=course-a');
    await denied.locator('[data-mode="team"]').click();await denied.locator('#create').click();
    await denied.locator('#facultyRecovery').waitFor();
    equal((await denied.locator('#app').textContent()).includes('faculty_authorization_required'),false,name+' gets a readable recovery message');
    equal(f.sessions.size,3,name+' cannot create an instructor session');
    equal(await denied.locator('#create').isEnabled(),true,name+' can retry after signing in');
    await denied.screenshot({path:path.join(artifacts,name+'-recovery.png'),fullPage:true});
  }
  const unowned=await page('wrong-course','teacher@example.test');
  await unowned.goto(base+'/sim03/instructor.html?course=not-owned');await unowned.locator('[data-mode="team"]').click();await unowned.locator('#create').click();
  await unowned.locator('#facultyRecovery').waitFor();equal(f.sessions.size,3,'another course cannot be authorized through an unrelated owned course');

  const launchPath='/api/launch?sim='+f.sim.id+'&course=course-b&mode=session&format=json';
  f.courses.get('course-b').archived=true;
  equal((await teacher.context().request.get(base+launchPath)).status(),403,'archived class cannot authorize a new room');
  f.courses.get('course-b').archived=false;f.sim.detached=true;
  equal((await teacher.context().request.get(base+launchPath)).status(),403,'removed simulation cannot authorize a new room');
  f.sim.detached=false;f.users.get('teacher').disabled=true;
  equal((await teacher.context().request.get(base+launchPath)).status(),401,'disabled faculty account cannot renew access');
  f.users.get('teacher').disabled=false;
  const stored=await teacher.evaluate(()=>sessionStorage.getItem('m03-faculty-lt'));
  const other=sign({...verify(stored),sub:'other-teacher'});
  equal((await f.call('session',{action:'faculty_state',code},{headers:{'x-launch-token':other}})).statusCode,403,'same display name does not grant another faculty account ownership');
  const otherCourse=sign({...verify(stored),course:'course-b'});
  equal((await f.call('session',{action:'faculty_state',code},{headers:{'x-launch-token':otherCourse}})).statusCode,403,'faculty authorization is scoped to the room course');

  // A syntactically valid but untrusted token is retried once, never accepted or looped.
  const mismatch=await page('invalid-signature','teacher@example.test');
  const valid=await requestToken(mismatch),bad=valid.split('.')[0]+'.invalid';
  await mismatch.route('**/api/launch?**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({url:base+'/sim03#lt='+bad})}));
  await mismatch.goto(base+'/sim03/instructor.html?course=course-a#lt='+bad);await mismatch.locator('[data-mode="team"]').click();await mismatch.locator('#create').click();
  await mismatch.locator('#facultyRecovery').waitFor();equal(f.sessions.size,3,'rejected renewed token cannot create a session');
  equal((await mismatch.locator('#app').textContent()).includes('could not verify'),true,'deployment verification failure is not mislabeled as an expired login');
  // Faculty can enter the instructor surface from a play-mode preview. Upgrade
  // through the platform, not by accepting a play token as roster permission.
  const shortcut=await page('faculty-play-shortcut','teacher@example.test');
  const playResponse=await shortcut.context().request.get(base+'/api/launch?sim='+f.sim.id+'&course=course-a&format=json');
  equal(playResponse.status(),200,'faculty play-mode launch succeeds');
  const playToken=new URLSearchParams(new URL((await playResponse.json()).url).hash.slice(1)).get('lt');
  equal(verify(playToken).mode,'play','shortcut test begins with a real play-mode token');
  await shortcut.goto(base+'/sim03/instructor.html#lt='+playToken);
  await shortcut.locator('[data-mode="team"]').click();await shortcut.locator('#create').click();
  const shortcutCode=await sessionCode(shortcut);
  const sessionToken=await shortcut.evaluate(()=>sessionStorage.getItem('m03-faculty-lt'));
  equal(verify(sessionToken).mode,'session','play-mode shortcut obtains faculty session authorization');
  const roster=await f.call('session',{action:'faculty_enrolments',code:shortcutCode},{headers:{'x-launch-token':sessionToken}});
  equal(roster.statusCode,200,'recovered shortcut authorizes the course roster');
  equal(roster.payload.students.some(p=>p.name==='Alex Student'),true,'recovered shortcut returns real enrolled student names');
  equal(f.sessions.get(shortcutCode).courseId,'course-a','shortcut keeps its original course');
  await shortcut.waitForFunction(() => document.querySelectorAll('.fw-unassigned .fw-person').length === 2);
  equal(Object.values(f.participants.get(shortcutCode)).every(p=>p.joinedAt===null),true,'approved roster is available before any student opens the sim');
  equal(await shortcut.locator('#start-session').isDisabled(),true,'start explains missing team assignments');
  f.seed('third','third@example.test','student',true,'Third Student');
  f.seed('fourth','fourth@example.test','student',true,'Fourth Student');
  await shortcut.locator('#fw-refresh').click();
  await shortcut.waitForFunction(() => document.querySelectorAll('.fw-unassigned .fw-person').length === 4);
  equal(await shortcut.locator('#teamCount').inputValue(),'2','four approved students default to two teams');
  await shortcut.locator('#autoSplit').click();
  await shortcut.waitForFunction(() => document.querySelectorAll('.fw-team-card').length === 2);
  equal(await shortcut.locator('.fw-team-card').count(),2,'auto split creates two visible team cards before launch');
  equal(await shortcut.locator('.team-lead').first().locator('option[value^="platform:"]').count(),2,'runner dropdown includes both real member IDs');
  equal(await shortcut.locator('#start-session').isEnabled(),true,'assigned teams can start without student attendance');
  const startBox=await shortcut.locator('#start-session').boundingBox();
  equal(startBox.y+startBox.height <= (await shortcut.evaluate(()=>innerHeight)),true,'start action stays visible without scrolling back to top');
  await shortcut.locator('#fw-advanced summary').click();
  await shortcut.evaluate(()=>refresh());
  equal(await shortcut.locator('#fw-advanced').evaluate(el=>el.open),true,'advanced settings stay open through polling');
  await shortcut.locator('#fw-advanced summary').click();
  await shortcut.locator('#start-session').click();
  await shortcut.waitForFunction(() => document.querySelector('#results-view')?.hidden===false);
  equal((await shortcut.locator('#response-heading').textContent()).includes('All team results'),true,'start leads directly to all team results');
  equal(await shortcut.locator('.fw-overview tbody tr').count(),2,'all teams including not-started runs appear once');
  equal(Object.values(f.participants.get(shortcutCode)).every(p=>p.joinedAt===null),true,'starting did not manufacture attendance');
  await shortcut.reload();await shortcut.locator('#resumeBtn').click();
  await shortcut.locator('.fw-overview tbody tr').first().waitFor();
  equal(await shortcut.locator('#manage-view').isHidden(),true,'resuming a running room opens results rather than setup');
  await shortcut.screenshot({path:path.join(artifacts,'02-faculty-shortcut-roster.png'),fullPage:true});
  const rosterPeople=Object.values(f.participants.get(shortcutCode));
  const teamIds=[...new Set(rosterPeople.map(p=>p.groupId))];
  const allocations=[{run:4,uptime:2,capacity:1,connect:2,features:0},{run:4,uptime:1,capacity:1,connect:1,features:2}];
  for(const [i,groupId] of teamIds.entries()){
    const lead=rosterPeople.find(p=>p.groupId===groupId&&p.isCaptain);
    const user=f.users.get(lead.id.slice(9));
    const studentCookie=await f.signin(user.email);
    const launch=await f.call('launch',{}, {method:'GET',headers:{cookie:studentCookie},query:{sim:f.sim.id,course:'course-a',session:shortcutCode,format:'json'}});
    equal(launch.statusCode,200,'assigned runner receives a course-authorized launch');
    const token=new URLSearchParams(new URL(launch.payload.url).hash.slice(1)).get('lt');
    const headers={'x-launch-token':token};
    equal((await f.call('session',{action:'join',code:shortcutCode},{headers})).payload.me.groupId,groupId,'runner launch restores the preassigned team');
    const answer='Team '+(i+1)+' committed response — '+('Explain our trade-off. '.repeat(55));
    const submitted=await f.call('session',{action:'submit',code:shortcutCode,participantId:lead.id,runnerRevision:0,
      strategicView:'Midland should provide reliable service through connected equipment.',year1:allocations[i],year2:allocations[i],reflection1:answer,reflection2:'We would move one million into capacity.',done:true},{headers});
    equal(submitted.statusCode,200,'runner submits the single shared result through the production handler');
  }
  await shortcut.evaluate(()=>refresh());
  await shortcut.waitForFunction(()=>document.getElementById('submitted-stat')?.textContent==='2');
  equal(await shortcut.locator('.fw-overview tbody tr').count(),2,'two completed teams produce two rows, not four student copies');
  await shortcut.locator('.fw-overview [data-open-team]').first().click();
  equal((await shortcut.locator('#response-content').textContent()).includes('committed response'),true,'faculty can read the actual runner answer inline');
  await shortcut.locator('#tab-outcomes').click();
  equal((await shortcut.locator('#response-content').textContent()).includes('Carrolton Systems'),true,'saved buyer outcomes appear in the same selected-team panel');
  await shortcut.locator('#compare-btn').click();
  const compared=await shortcut.locator('#compare-left').inputValue();
  await shortcut.evaluate(()=>refresh());
  equal(await shortcut.locator('#compare-dialog').evaluate(el=>el.open),true,'polling does not close comparison');
  equal(await shortcut.locator('#compare-left').inputValue(),compared,'polling preserves comparison selection');
  await shortcut.locator('#close-compare').click();
  await shortcut.locator('#tab-answers').click();
  await shortcut.screenshot({path:path.join(artifacts,'03-team-written-responses.png'),fullPage:true});
  const exportPromise=shortcut.waitForEvent('download');await shortcut.locator('#export-btn').click();
  const download=await exportPromise;const csvPath=path.join(artifacts,'shared-team-responses.csv');await download.saveAs(csvPath);
  const csv=await fs.readFile(csvPath,'utf8');
  equal(csv.split('Team 1 committed response').length-1,1,'the team answer appears once in the export');
  await shortcut.setViewportSize({width:390,height:844});
  equal(await shortcut.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile results have no page-wide horizontal overflow');
  await shortcut.screenshot({path:path.join(artifacts,'04-mobile-results.png'),fullPage:true});
  await shortcut.setViewportSize({width:1366,height:900});
  await shortcut.locator('#manage-tab').click();
  await shortcut.locator('#fw-advanced summary').click();
  const calibration=shortcut.locator('.th').first();
  equal(await calibration.isDisabled(),true,'advanced calibration is locked after start');
  shortcut.once('dialog',d=>d.accept());await shortcut.locator('[data-session-control="close"]').click();
  await shortcut.waitForFunction(()=>state.session.state==='closed');
  await shortcut.reload();await shortcut.locator('#resumeBtn').click();
  await shortcut.locator('.fw-overview tbody tr').first().waitFor();
  equal(await shortcut.locator('#manage-view').isHidden(),true,'resuming a closed room opens all saved results');
  equal(errors,[],'no browser or server errors');
  await fs.writeFile(path.join(artifacts,'results.json'),JSON.stringify({ok:true,checks,productionDataTouched:false},null,2));
  console.log(`Midland faculty-auth browser checks passed (${checks} assertions).`);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  for(const c of contexts)await c.close().catch(()=>{});if(browser)await browser.close();
  if(server)await new Promise(resolve=>server.close(resolve));if(certDir)await fs.rm(certDir,{recursive:true,force:true});
});
