'use strict';
const http=require('node:http'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'../..'), {prepare,file,failure}=require('./http.cjs');
const entry=require('./manifest.cjs').find(x=>x.folder===process.env.LOCAL_SIM);
if(!entry || !process.send)throw new Error('Start this worker through start.cjs.');
const {createClient}=require(path.join(root,'.local-dev/node_modules/redis'));
const origin=process.env.PLATFORM_URL;
const client=createClient({url:`redis://127.0.0.1:${process.env.LOCAL_REDIS_PORT || 6380}`,database:entry.db,socket:{reconnectStrategy:false}});
client.on('error',e=>console.error(`[${entry.route}] Redis: ${e.code||e.message}`));
const originalFetch=global.fetch;
global.fetch=async(input,options={})=>{
 const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
 if(url.origin==='http://local-redis.invalid'){
  const args=JSON.parse(options.body).map(String);
  const result=await client.sendCommand(args);
  return new Response(JSON.stringify({result}),{headers:{'Content-Type':'application/json'}});
 }
 const ai=entry.number<=2 && process.env.ANTHROPIC_API_KEY && url.origin==='https://api.anthropic.com';
 if(url.origin!==origin&&!ai)throw new Error('Local launcher blocks external callbacks: '+url.origin);
 return originalFetch(input,{...options,redirect:'error'});
};
const dir=path.join(root,entry.folder),prefix='/'+entry.route;
const apiFiles=new Set(fs.readdirSync(path.join(dir,'api')).filter(f=>f.endsWith('.js')));
let app;
if(entry.folder==='sim10')app=require(path.join(dir,'lib/app')).createApp();
const server=http.createServer(async(req,res)=>{
 try{
  if(req.headers['x-local-worker-key']!==process.env.LOCAL_WORKER_KEY){res.writeHead(403);return res.end();}
  delete req.headers['x-local-worker-key'];
  if(app)return await app(req,res);
  const url=new URL(req.url,origin);const relative=decodeURIComponent(url.pathname.slice(prefix.length)).replace(/^\/+/, '');
  if(relative.startsWith('api/')){
   const name=relative.slice(4)+'.js';if(!apiFiles.has(name)){res.writeHead(404);return res.end('Unknown API');}
   await prepare(req,res,origin);return await require(path.join(dir,'api',name))(req,res);
  }
  file(req,res,path.join(dir,'public'),relative==='demo'||relative==='demo/'?'index.html':relative||entry.entry);
 }catch(e){console.error(`[${entry.route}]`,e.code||e.message);failure(res,e);}
});
async function stop(){server.close();server.closeAllConnections();if(client.isOpen)await client.quit();}
process.on('disconnect',()=>stop().finally(()=>process.exit()));
process.on('SIGTERM',()=>stop().finally(()=>process.exit()));
(async()=>{await client.connect();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});process.send({port:server.address().port});})().catch(e=>{console.error(`[${entry.route}] startup:`,e.code||e.message);process.exit(1)});
