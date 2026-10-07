'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const origin='http://localhost:'+Number(process.env.LOCAL_PORT||3000);
const manifest=require('./manifest.cjs');
const get=(url)=>fetch(origin+url,{redirect:'manual',signal:AbortSignal.timeout(8000)});
async function redirect(from,to){
 const r=await get(from);assert([301,302,307,308].includes(r.status),from+' must redirect');
 assert.equal(new URL(r.headers.get('location'),origin).href,origin+to,from+' redirect destination');
 await r.arrayBuffer();
}
(async()=>{
 assert.equal(new Set(manifest.map(x=>x.route)).size,manifest.length,'Duplicate local routes');
 for(const entry of manifest){
  const response=await get('/'+entry.route+'/api/health');
  assert.equal(response.status,200,entry.route+' health status');
  assert.equal((await response.json()).sim,entry.meta.id,entry.route+' identity');
  const page=await get('/'+entry.route+'/');
  assert.equal(page.status,200,entry.route+' entry page');
  assert.match(page.headers.get('content-type')||'',/text\/html/,entry.route+' HTML');
  await page.text();
  await redirect('/'+entry.route+'?route_check=1','/'+entry.route+'/?route_check=1');
  const unknown=await get('/'+entry.route+'-unknown');assert.equal(unknown.status,404,'Prefix boundary '+entry.route);await unknown.arrayBuffer();
  console.log('PASS '+entry.route+' entry, identity, redirect and prefix boundary');
 }
 for(const name of ['admin','faculty','student','signin','account','join']){
  const expected=fs.readFileSync(path.join(__dirname,'../../platform/public',name+'.html'),'utf8');
  for(const suffix of ['', '.html']){
   const r=await get('/'+name+suffix+'?route_check=1');assert.equal(r.status,200,name+suffix);
   assert.equal(await r.text(),expected,name+suffix+' must serve its own portal page');
  }
 }
 await redirect('/rapidsims01?route_check=1','/simplus01?route_check=1');
 await redirect('/rapidsims01/api/health?route_check=1','/simplus01/api/health?route_check=1');
 const demo=await get('/sim07/demo');assert.equal(demo.status,200,'Sim07 demo');
 assert.equal(await demo.text(),fs.readFileSync(path.join(__dirname,'../../sim07/public/index.html'),'utf8'));
 console.log('PASS portal aliases, legacy Plus redirect and Sim07 demo');
 console.log('All 12 local routes checked. This does not test complete gameplay, authentication or AI calls.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
