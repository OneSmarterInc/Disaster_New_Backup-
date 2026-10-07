'use strict';
const assert=require('node:assert/strict');
const origin='http://localhost:'+Number(process.env.LOCAL_PORT||3000);
(async()=>{
 for(const entry of require('./manifest.cjs')){
  const response=await fetch(origin+'/'+entry.route+'/api/health',{signal:AbortSignal.timeout(8000)});
  assert.equal(response.status,200,entry.route+' health status');
  assert.equal((await response.json()).sim,entry.meta.id,entry.route+' identity');
  const page=await fetch(origin+'/'+entry.route+'/',{signal:AbortSignal.timeout(8000)});
  assert.equal(page.status,200,entry.route+' entry page');
  console.log('PASS '+entry.route);
 }
 console.log('All 12 local entry pages and health endpoints respond. This does not test complete gameplay or AI calls.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
