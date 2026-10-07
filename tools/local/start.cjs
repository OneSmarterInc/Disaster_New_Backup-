'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {fork}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),platform=path.join(root,'platform'),local=path.join(root,'.local-dev');
const manifest=require('./manifest.cjs'),{prepare,file,failure}=require('./http.cjs');
if(process.env.NODE_ENV==='production'||process.env.VERCEL)throw new Error('Local development only.');
if(!process.env.PGPASSWORD)throw new Error('Use Start-All.ps1 to enter the local database password.');
const port=Number(process.env.LOCAL_PORT||3000),origin=`http://localhost:${port}`;
const {Pool}=require(path.join(local,'node_modules/pg'));
const pool=new Pool({host:'127.0.0.1',port:Number(process.env.LOCAL_PGPORT||5434),database:'rapidsims_local',user:'rapidsims_app',password:process.env.PGPASSWORD,ssl:false,max:10,connectionTimeoutMillis:5000});
delete process.env.PGPASSWORD;
fs.mkdirSync(local,{recursive:true});
const configPath=path.join(local,'local-secrets.json');
let secrets;
if(fs.existsSync(configPath))secrets=JSON.parse(fs.readFileSync(configPath,'utf8'));
else {secrets=Object.fromEntries(['launch','health','setup'].map(k=>[k,crypto.randomBytes(32).toString('hex')]));fs.writeFileSync(configPath,JSON.stringify(secrets,null,2),{flag:'wx',mode:0o600});}
if(['launch','health','setup'].some(k=>typeof secrets[k]!=='string'||secrets[k].length<32))throw new Error('Invalid local-secrets.json; retain your existing secrets and check the file.');
const workerKey=crypto.randomBytes(32).toString('hex');
for(const key of ['DATABASE_URL','POSTGRES_URL','KV_REST_API_URL','KV_REST_API_TOKEN','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','DEV_OPEN','SIM10_CLOCK_SCALE','W07_MEMORY_STORE','FACULTY_CODE','FACULTY_CODES','SIM_URL','BASE_PATH'])delete process.env[key];
Object.assign(process.env,{PUBLIC_BASE_URL:origin,PLATFORM_URL:origin,LAUNCH_SECRET:secrets.launch,HEALTH_SECRET:secrets.health,SETUP_KEY:secrets.setup});
async function tagged(strings,...values){const text=strings.reduce((s,p,i)=>s+(i?'$'+i:'')+p,'');return (await pool.query(text,values)).rows;}
tagged.query=async(text,values)=>(await pool.query(text,values)).rows;
const dbFile=require.resolve(path.join(platform,'lib/db.js')),chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
require.cache[dbFile]={id:dbFile,filename:dbFile,loaded:true,exports:{sql:()=>tagged,id:p=>p+'_'+crypto.randomBytes(9).toString('base64url'),joinCode:()=>Array.from({length:6},()=>chars[crypto.randomInt(chars.length)]).join('')}};
const originalFetch=global.fetch;
global.fetch=(input,options={})=>{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(url.origin!==origin)throw new Error('Local launcher blocks external platform calls.');return originalFetch(input,{...options,redirect:'error'});};
const children=[],ports=new Map();let stopping=false;
const apiFiles=new Set(fs.readdirSync(path.join(platform,'api')).filter(f=>f.endsWith('.js')));
const aliases=new Set(['admin','faculty','student','signin','account','join']);
const server=http.createServer(async(req,res)=>{
 try{
  if(req.headers.host!==`localhost:${port}`){res.writeHead(400);return res.end('Use '+origin);}
  if(req.headers.origin&&req.headers.origin!==origin){res.writeHead(403);return res.end('Local origin required');}
  req.headers['x-forwarded-host']=`localhost:${port}`;req.headers['x-forwarded-proto']='http';
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const setHeader=res.setHeader.bind(res);
  res.setHeader=(name,value)=>setHeader(name,name.toLowerCase()==='set-cookie'?(Array.isArray(value)?value.map(v=>v.replace(/;\s*Secure\b/gi,'')):String(value).replace(/;\s*Secure\b/gi,'')):value);
  const url=new URL(req.url,origin);
  if(url.pathname==='/rapidsims01'||url.pathname.startsWith('/rapidsims01/')){res.writeHead(302,{Location:req.url.replace('/rapidsims01','/simplus01')});return res.end();}
  const entry=manifest.find(x=>url.pathname==='/'+x.route||url.pathname.startsWith('/'+x.route+'/'));
  if(entry){
   if(url.pathname==='/'+entry.route){res.writeHead(302,{Location:'/'+entry.route+'/'+url.search});return res.end();}
   const destination=ports.get(entry.folder);if(!destination){res.writeHead(503);return res.end('Simulation is starting.');}
   const upstream=http.request({host:'127.0.0.1',port:destination,path:req.url,method:req.method,headers:{...req.headers,'x-local-worker-key':workerKey}},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});
   upstream.on('error',e=>failure(res,e));req.on('aborted',()=>upstream.destroy());req.pipe(upstream);return;
  }
  if(url.pathname.startsWith('/api/')){
   const name=url.pathname.slice(5)+'.js';if(!apiFiles.has(name)){res.writeHead(404);return res.end('Unknown API');}
   await prepare(req,res,origin);await require(path.join(platform,'api',name))(req,res);
   if(name==='setup.js'&&res.statusCode===200)delete process.env.SETUP_KEY;
   return;
  }
  let relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';if(aliases.has(relative))relative+='.html';
  file(req,res,path.join(platform,'public'),relative);
 }catch(e){console.error('Local request:',e.code||e.message);failure(res,e);}
});
async function startWorker(entry){
 const env={...process.env,LOCAL_SIM:entry.folder,LOCAL_WORKER_KEY:workerKey,
  SIM_URL:origin+'/'+entry.route,BASE_PATH:'/'+entry.route+'/',ACCESS_CODE:secrets.health,FACULTY_CODE:secrets.health,FACULTY_CODES:'Local:'+secrets.health,
  KV_REST_API_URL:'http://local-redis.invalid',KV_REST_API_TOKEN:workerKey,UPSTASH_REDIS_REST_URL:'http://local-redis.invalid',UPSTASH_REDIS_REST_TOKEN:workerKey};
 if(entry.number>2)delete env.ANTHROPIC_API_KEY;
 const child=fork(path.join(__dirname,'worker.cjs'),[],{cwd:path.join(root,entry.folder),env,stdio:['ignore','inherit','inherit','ipc']});children.push(child);
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error(entry.route+' startup timed out')),15000);
  child.once('error',e=>{clearTimeout(timer);reject(e)});
  child.once('exit',code=>{clearTimeout(timer);reject(new Error(entry.route+' exited: '+code));if(!stopping){console.error(entry.route+' stopped; stopping the suite.');stop().finally(()=>{process.exitCode=1});}});
  child.once('message',message=>{clearTimeout(timer);ports.set(entry.folder,message.port);resolve();});
 });
}
async function start(){
 await pool.query('SELECT 1');
 // Apply the repository's additive schema before any callbacks can run.
 const connection=await pool.connect();try{await connection.query('BEGIN');for(const sql of require(path.join(platform,'lib/schema.js')))await connection.query(sql);await connection.query('COMMIT');}catch(e){await connection.query('ROLLBACK');throw e;}finally{connection.release();}
 if((await pool.query("SELECT 1 FROM users WHERE role='admin' LIMIT 1")).rows.length)delete process.env.SETUP_KEY;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 for(const entry of manifest)await startWorker(entry);
 for(const entry of manifest){
  const payload={...entry.meta,kind:'register',sim:entry.meta.id,number:entry.number,launchUrl:origin+'/'+entry.route,iat:Date.now(),exp:Date.now()+300000};
  const body=Buffer.from(JSON.stringify(payload)).toString('base64url');const token=body+'.'+crypto.createHmac('sha256',secrets.launch).update(body).digest('base64url');
  const response=await fetch(origin+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
  if(!response.ok)throw new Error('Local registration failed: '+entry.route+' HTTP '+response.status);
  // Explicit local catalogue setup only; preserve all users, courses and results.
  await pool.query('UPDATE sims SET published=true WHERE id=$1',[entry.meta.id]);
  const health=await fetch(origin+'/'+entry.route+'/api/health');if(!health.ok)throw new Error(entry.route+' health failed');
  console.log('Ready: '+origin+'/'+entry.route+' — '+entry.meta.title);
 }
 console.log('\nPortal: '+origin+'\nAll 12 simulations registered and published in the LOCAL catalogue.');
 if(process.env.SETUP_KEY)console.log('First-time admin setup: '+origin+'/setup.html\nLocal setup key: '+secrets.setup);
 if(!process.env.ANTHROPIC_API_KEY)console.log('ACTION NEEDED: Sim01/Sim02 AI conversations require ANTHROPIC_API_KEY. Restart with Start-All.ps1 -WithAI.');
 console.log('PostgreSQL holds portal records. Local Redis holds simulation sessions (normal expiry still applies). Ctrl+C stops Node workers.');
}
async function stop(){if(stopping)return;stopping=true;for(const child of children)child.kill();server.close();server.closeAllConnections();await pool.end();}
process.on('SIGINT',()=>stop().finally(()=>process.exit()));process.on('SIGTERM',()=>stop().finally(()=>process.exit()));
start().catch(async e=>{console.error('Startup failed:',e.code||e.message);await stop();process.exitCode=1;});
