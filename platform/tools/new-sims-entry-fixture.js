// Disposable API adapters used by the real client-script checks.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..');let clock=Date.now();Date.now=()=>clock;
process.env.LAUNCH_SECRET='local-browser-fixture-secret';process.env.ACCESS_CODE='entry-test';process.env.FACULTY_CODES='Tester:faculty-test';process.env.PLATFORM_URL='https://platform.test';
const fixtures={},reports=[];let failNext=false,failReveal=false;
for(const n of ['07','08','09']){
 const base=path.join(root,'sim'+n),store=require(base+'/lib/store.js');
 const sessions=new Map(),people=new Map(),runs=new Map(),beats=new Map();const clone=x=>structuredClone(x),same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
 Object.assign(store,{configured:()=>true,beat:async c=>beats.set(c,clock),lastBeat:async c=>beats.get(c)||0,getSession:async c=>clone(sessions.get(c)||null),putSession:async(c,v)=>{sessions.set(c,clone(v));return v},compareAndSetSession:async(c,prev,next)=>{if(!same(sessions.get(c),prev))return false;sessions.set(c,clone(next));return true},getParticipants:async c=>clone(people.get(c)||{}),addParticipant:async(c,id,v)=>{const all=people.get(c)||{};all[id]=clone(v);people.set(c,all)},compareAndSetParticipant:async(c,id,prev,next,sess)=>{if(!sessions.has(c)||(sess&&!same(sessions.get(c),sess)))return false;const all=people.get(c)||{};if(!same(all[id],prev))return false;all[id]=clone(next);people.set(c,all);return true},compareAndSetRoster:async(c,prev,next,sess)=>{if(!same(sessions.get(c),sess)||!same(people.get(c)||{},prev))return false;people.set(c,clone(next));return true},getRuns:async c=>clone(runs.get(c)||{}),compareAndSetRun:async(c,id,prev,next)=>{const all=runs.get(c)||{};if(!same(all[id],prev))return false;all[id]=clone(next);runs.set(c,all);return true}});
 const launch=require(base+'/lib/launch.js');launch.announce=()=>Promise.resolve();launch.reportCompletion=async x=>{if(failNext){failNext=false;return {ok:false}}reports.push({n,...x});return {ok:true}};
 const handlers={};for(const file of ['session','config','join','finish','reveal'])if(fs.existsSync(base+'/api/'+file+'.js'))handlers[file]=require(base+'/api/'+file+'.js');
 fixtures[n]={base,store,sessions,people,runs,launch,handlers};
}
function tok(n,p={}){return fixtures[n].launch.signBack({sim:({'07':'rapid-07-bought','08':'rapid-08-later','09':'rapid-09-money-land'})[n],sub:'student-'+n,name:'Test Student',course:'course-'+n,role:'student',mode:'play',iat:clock,exp:clock+86400000,...p})}
async function invoke(n,body,headers={}){let result={status:200};const res={setHeader(){},status(s){result.status=s;return this},json(v){result.body=v;return this},end(){}};await fixtures[n].handlers.session({method:'POST',headers,body},res);return result}

global.fetch=async()=>{throw new Error('Unexpected network request in client fixture')};
async function api(n,name,req){
 if(n==='07'&&name==='reveal'&&failReveal){failReveal=false;return {status:503,body:{error:'reveal_unavailable'}}}
 let result={status:200};
 const res={setHeader(){},status(s){result.status=s;return this},json(v){result.body=v;return this},end(){},redirect(s,url){result.status=s;result.redirect=url}};
 await fixtures[n].handlers[name](req,res);return result;
}
module.exports={fixtures,reports,tok,invoke,api,advance:ms=>{clock+=ms},fail:()=>{failNext=true},failReveal:()=>{failReveal=true}};
