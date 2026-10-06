#!/usr/bin/env node
// Real admin and simulation handlers; disposable auth/SQL and no network calls.
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
process.env.LAUNCH_SECRET = 'audit-launch-secret';
process.env.HEALTH_SECRET = 'audit-health-secret';
process.env.ACCESS_CODE = 'audit-access';
process.env.ANTHROPIC_API_KEY = 'audit-model-key';
process.env.PLATFORM_URL = 'https://platform.test';
process.env.KV_REST_API_URL = 'https://redis.test';
process.env.KV_REST_API_TOKEN = 'audit-redis-token';
let sims = [], diagnosticKey = process.env.HEALTH_SECRET;
const mock = (name, exports) => { const file = path.join(root, name); require.cache[file] = { id:file, filename:file, loaded:true, exports }; };
mock('platform/lib/db.js', { sql: () => async(strings, ...values) => {
  const query = strings.join('?');
  if (query.includes('WHERE id =')) return sims.filter(s => s.id === values[0]);
  return sims;
}, id: () => 'test-id' });
mock('platform/lib/auth.js', { requireRole: async() => ({ id:'test-admin', role:'admin' }) });
const admin = require('../api/admin.js');
const { inspectHealth } = require('../lib/sim-health.js');
async function invoke(handler, req) {
  let code=200, payload;
  const res = { status(c){ code=c;return this; },setHeader(){},json(p){payload=p;return this;},
    writeHead(c){code=c;return this;},end(raw){if(raw)payload=JSON.parse(raw);return this;} };
  await handler(req,res); return { status:code, body:payload };
}
const handlers = new Map();
for (const dir of ['sim','sim-02','sim03','sim04','sim05','sim06','sim07','sim08','sim09','sim-plus-01','sim10','simplus02']) {
  const handler = dir === 'sim10' ? require('../../sim10/lib/app').createApp() : require(path.join(root,dir,'api/health.js'));
  handlers.set(`https://${dir}.test/api/health`,handler);
}
let requests=0;
global.fetch = async(url, opts) => {
  requests++;
  const headers = opts.headers || {};
  assert.notEqual(headers['x-health-key'],process.env.LAUNCH_SECRET,'launch credentials must never be sent to health');
  assert.equal(headers['x-health-key'],process.env.HEALTH_SECRET || undefined);
  const handler=handlers.get(url); assert.ok(handler,'only the test health endpoints may be called');
  const previous=process.env.HEALTH_SECRET;
  process.env.HEALTH_SECRET=diagnosticKey;
  let response;
  try { response=await invoke(handler,{method:'GET',url:'/api/health',headers,query:{}}); }
  finally { if(previous===undefined)delete process.env.HEALTH_SECRET;else process.env.HEALTH_SECRET=previous; }
  return { ok:response.status===200,status:response.status,json:async()=>response.body };
};
const call = body => invoke(admin,{method:'POST',headers:{},body});
(async()=>{
  for(const [url,handler] of handlers){
    process.env.SIM_URL=url.replace('/api/health','');
    const info=await invoke(handler,{method:'GET',url:'/api/health',headers:{'x-health-key':diagnosticKey},query:{}});
    sims=[{id:info.body.sim,title:'Test simulation',number:1,launch_url:process.env.SIM_URL}];
    let r=await call({action:'refresh_sims'});
    assert.equal(r.body.results[0].state,'ready',JSON.stringify(r.body));
    r=await call({action:'probe_sim',launchUrl:process.env.SIM_URL});
    assert.deepEqual(r.body.problems,[]);
    if(info.body.acceptsLaunchIds){
      assert.equal(inspectHealth(info.body,{...sims[0],id:'rapid-03-bench'}).state,'ready','legacy Wexford launches remain compatible');
    }
    if(info.body.needsModelKey===false)assert.equal(info.body.characters,undefined,'deterministic simulations need no AI key');
    const mismatch=inspectHealth({...info.body,launchSecretFingerprint:'00000000'},sims[0]);
    assert.ok(mismatch.problems.some(x=>x.includes('does not match')));
    assert.equal(inspectHealth({...info.body,sessions:'MISSING'},sims[0]).state,'needs attention');
  }
  diagnosticKey='different-diagnostic-key';
  let r=await call({action:'refresh_sims'});
  assert.equal(r.body.results[0].state,'unverified');
  assert.doesNotMatch(r.body.results[0].detail,/no API key|no launch secret|nowhere to report/);
  delete process.env.HEALTH_SECRET;
  r=await call({action:'refresh_sims'});
  assert.equal(r.body.results[0].state,'unverified');
  assert.match(r.body.results[0].detail,/Set a dedicated matching HEALTH_SECRET/);
  assert.equal(inspectHealth({ok:true,sim:'unexpected'},sims[0]).state,'needs attention');
  console.log(`Health contracts passed for all ${handlers.size} sims (${requests} admin probes), missing/wrong diagnostic keys, storage, signing and legacy aliases.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
