#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { auditSimIdentities } = require('../lib/sim-identity-audit');
let hasTranscripts = true;
const calls=[];
async function sql(strings,...values) {
  const q=strings.join('?').replace(/\s+/g,' ').trim(); calls.push({q,values});
  assert.match(q,/^SELECT\b/,'inventory must be read-only');
  if(q.includes('to_regclass')) return [{relation:hasTranscripts?'transcripts':null}];
  if(q.startsWith('SELECT id, title')) return values[0]==='rapid-03-bench'?[{id:values[0],title:'Historical mixed entry',published:true}]:[];
  if(q.startsWith('SELECT (SELECT count')) {assert.equal(values.length,5);assert.equal(new Set(values).size,1);return [{course_sims:'2',launches:'3',completions:'1',previews:'4',sim_access:'5'}];}
  if(q.startsWith('SELECT count(*) AS n FROM transcripts')) return [{n:'6'}];
  throw new Error(q);
}
(async()=>{
 const report=await auditSimIdentities(sql,['rapid-03-bench','rapidsimplus-01']);
 assert.equal(report.readOnly,true);assert.match(report.warning,/do not authorize deletion/);
 assert.equal(report.records[0].dependencies.transcripts,6);
 assert.equal(report.records[0].dependencies.launches,3);
 assert.equal(report.records[1].exists,false,'an absent new catalogue identity is explicit');
 assert.equal(report.records[0].catalogue.published,true,'existing publication metadata is unchanged');
 hasTranscripts=false;const absent=await auditSimIdentities(sql,['rapid-03-bench']);
 assert.equal(absent.transcriptsTablePresent,false);assert.equal(absent.records[0].dependencies.transcripts,null,'missing table must not masquerade as a checked zero');
 await assert.rejects(auditSimIdentities(sql,["x'; DELETE FROM sims; --"]),/valid simulation identifiers/);
 assert.ok(calls.every(x=>!x.q.includes('DELETE')&&!x.q.includes('UPDATE')));
 console.log('Simulation identity inventory checks passed (read-only, all six dependencies, parameter binding and absent transcript table).');
})().catch(e=>{console.error(e);process.exitCode=1;});
