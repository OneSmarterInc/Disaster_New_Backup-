'use strict';
const assert = require('node:assert/strict');
const { META, LEGACY_LAUNCH_IDS, acceptsLaunchId } = require('../lib/meta');
const { verifyLaunch, signBack, reportCompletion, reportTranscript } = require('../lib/launch');
const { checkAccess, canonicalUrl } = require('../lib/guard');
const env = { ...process.env }, nativeFetch = global.fetch, requests=[];
(async()=>{try{
 process.env.LAUNCH_SECRET='identity-test-secret';delete process.env.PLATFORM_URL;
 delete process.env.SIM_URL;
 const direct={headers:{host:'preview.test'}};
 assert.equal(canonicalUrl(direct),'https://preview.test');
 process.env.PLATFORM_URL='https://platform.test/';
 assert.equal(canonicalUrl(direct),'https://platform.test/simplus01','platform fallback keeps the simulation path');
 process.env.SIM_URL='https://platform.test/rapidsims01/';
 assert.equal(canonicalUrl(direct),'https://platform.test/rapidsims01','explicit legacy aliases remain supported');
 delete process.env.PLATFORM_URL;delete process.env.SIM_URL;
 assert.equal(META.id,'rapidsimplus-01');assert.deepEqual(META.replaces,[]);
 assert.equal(require('../data/simmeta').SIM_ID,META.id);
 for(const id of [META.id,...LEGACY_LAUNCH_IDS]) {
   assert.equal(acceptsLaunchId(id),true);
   const payload={sub:'student',sim:id,role:'student',course:'course',exp:Date.now()+60000};
   const req={headers:{'x-launch-token':signBack(payload)}};
   let status=200, response;
   const res={status(n){status=n;return this;},json(x){response=x;return this;}};
   assert.equal(checkAccess(req,res),true);assert.equal(status,200);assert.equal(req.launch.sim,id);
 }
 const req={headers:{'x-launch-token':signBack({sub:'student',sim:'rapid-03-midland',exp:Date.now()+60000})}};
 let status=200;const res={status(n){status=n;return this;},json(){return this;}};
 assert.equal(checkAccess(req,res),false);assert.equal(status,403,'a different simulation token must not work');
 process.env.PLATFORM_URL='https://platform.test';
 global.fetch=async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return {ok:true};};
 const envelope={simId:META.id,sessionId:'saved-run',events:[]};
 for(const id of [META.id,...LEGACY_LAUNCH_IDS]) {
   const launch={sub:'student',sim:id,course:'course',iat:Date.now()-1000};
   await reportCompletion({launch,summary:'Complete',metrics:{}});
   await reportTranscript({launch,envelope});
   const [completion,transcript]=requests.slice(-2);
   assert.equal(verifyLaunch(completion.body.token).sim,id,'completion keeps its signed launch identity');
   assert.equal(verifyLaunch(transcript.body.token).sim,id);
   assert.equal(transcript.body.envelope.simId,id,'legacy transcript and token must agree for platform acceptance');
   assert.equal(envelope.simId,META.id,'reporting a legacy run must not mutate the authored envelope');
 }
 console.log('Wexford identity checks passed: canonical registration, legacy launches, completion/transcript attribution and wrong-sim rejection.');
}finally{global.fetch=nativeFetch;for(const k of ['LAUNCH_SECRET','PLATFORM_URL','SIM_URL']) {if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}}})().catch(e=>{console.error(e);process.exitCode=1;});
