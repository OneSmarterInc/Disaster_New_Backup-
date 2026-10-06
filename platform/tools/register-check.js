#!/usr/bin/env node
// Registration contract, including non-destructive identity transitions and copy revisions.
const assert = require('assert/strict');
const path = require('path');
const P = x => path.join(__dirname, '../..', x);
process.env.LAUNCH_SECRET = 'shared';
const DB = { sims:[], course_sims:[], launches:[], completions:[], previews:[], sim_access:[], transcripts:[] };
const row = id => DB.sims.find(s => s.id === id);
require.cache[require.resolve(P('platform/lib/db.js'))] = { exports:{
  sql:() => (strings, ...v) => {
    const q = strings.join('?').replace(/\s+/g, ' ').trim();
    if (q.startsWith('SELECT (SELECT count(*) FROM course_sims')) {
      const n = ['course_sims','launches','completions','previews','sim_access'].reduce((sum, table) => sum + DB[table].filter(x => x.sim_id === v[0]).length, 0);
      return Promise.resolve([{ n }]);
    }
    if (/^DELETE|^UPDATE.*sim_id/i.test(q)) throw new Error('Registration must not migrate or delete history');
    if (q.startsWith('SELECT * FROM sims WHERE id')) return Promise.resolve(DB.sims.filter(s => s.id === v[0]));
    if (q.includes('number IS NOT NULL')) return Promise.resolve(DB.sims.filter(s => s.number));
    if (q.startsWith('INSERT INTO sims')) {
      DB.sims.push({ id:v[0], number:v[1], title:v[2], tagline:v[3], description:v[4], minutes:v[5], launch_url:v[6], published:false, detail:v[7] ? JSON.parse(v[7]) : null });
      return Promise.resolve([]);
    }
    const updates = { 'UPDATE sims SET detail':'detail', 'UPDATE sims SET launch_url':'launch_url', 'UPDATE sims SET minutes':'minutes', 'UPDATE sims SET title':'title', 'UPDATE sims SET tagline':'tagline', 'UPDATE sims SET description':'description' };
    const prefix = Object.keys(updates).find(x => q.startsWith(x));
    if (prefix) { row(v[1])[updates[prefix]] = updates[prefix] === 'detail' ? JSON.parse(v[0]) : v[0]; return Promise.resolve([]); }
    throw new Error(`Unrecognised registration query: ${q}`);
  },
  id:p => `${p}_1`, joinCode:() => 'X'
} };
const handler = require(P('platform/api/register.js'));
const { signBack } = require(P('sim/lib/launch.js'));
const call = body => new Promise(resolve => {
  const response = { _c:200, status(c){ this._c=c; return this; }, json(data){ resolve({status:this._c, body:data}); }, setHeader(){}, end(){ resolve({status:this._c}); } };
  handler({ method:'POST', body, headers:{} }, response);
});
const announce = data => signBack(Object.assign({ kind:'register', exp:Date.now()+60000 }, data));

(async () => {
  let result = await call({ token:announce({ sim:'rapid-01-disaster', title:'Disaster or Breach?', tagline:'From sim.', description:'Developer copy.', minutes:20, launchUrl:'https://sim1.test', detail:{ tryIt:'Play.' } }) });
  assert.equal(result.body.created, true);
  assert.equal(row('rapid-01-disaster').published, false);
  Object.assign(row('rapid-01-disaster'), { title:'Admin title', tagline:'Admin tagline', published:true });
  row('rapid-01-disaster').detail._edited = ['title','tagline'];
  await call({ token:announce({ sim:'rapid-01-disaster', title:'Developer title', tagline:'Developer tagline', description:'New description', minutes:25, launchUrl:'https://sim1-new.test', detail:{ tryIt:'Play again.' } }) });
  assert.equal(row('rapid-01-disaster').title, 'Admin title');
  assert.equal(row('rapid-01-disaster').tagline, 'Admin tagline');
  assert.equal(row('rapid-01-disaster').description, 'New description');
  assert.equal(row('rapid-01-disaster').launch_url, 'https://sim1-new.test');
  assert.equal(row('rapid-01-disaster').minutes, 25);
  assert.equal(row('rapid-01-disaster').published, true);

  DB.sims.push({ id:'rapid-03-bench', number:3, title:'The Bench Is Clear', tagline:'Old scenario', description:'Old Harlow content', minutes:45, launch_url:'https://old.test', published:true, detail:{ _edited:['title'], cast:[{name:'Harlow'}] } });
  DB.sims.push({ id:'rapid-sim-03', number:4, title:'Temporary duplicate', published:false, detail:{} });
  const bench = structuredClone(row('rapid-03-bench'));
  DB.transcripts.push({ sim_id:'rapid-03-bench', envelope:{ simId:'rapid-03-bench' } });
  const replacement = { sim:'rapidsimplus-01', catalogueRevision:'claims-interview-v1', replaces:['rapid-03-bench','rapid-sim-03'], title:"Why Don't They Have Any Patience?", tagline:'Three interviews.', description:'Document a dental-claims intake process.', minutes:180, launchUrl:'https://simplus.test', detail:{ cast:[{name:'Ray Duffy'}], tryIt:'Play the complete sequence.' } };
  result = await call({ token:announce(replacement) });
  assert.equal(result.body.created, true);
  assert.deepEqual(result.body.aliasesRemoved, []);
  assert.deepEqual(result.body.aliasesRetained, ['rapid-03-bench','rapid-sim-03']);
  assert.ok(row('rapid-sim-03'), 'even an empty alias needs a deliberate migration');
  assert.deepEqual(row('rapid-03-bench'), bench, 'old metadata and publication state must not be overwritten');
  assert.equal(DB.transcripts.length, 1, 'transcript-only history must survive registration');
  assert.equal(row('rapidsimplus-01').title, replacement.title);
  assert.equal(row('rapidsimplus-01').published, false, 'a new identity requires administrator publication');
  assert.equal(row('rapidsimplus-01').detail.cast[0].name, 'Ray Duffy');
  assert.equal(row('rapidsimplus-01').detail._source_revision, 'claims-interview-v1');

  row('rapidsimplus-01').title = 'Faculty-facing title';
  row('rapidsimplus-01').detail._edited = ['title'];
  result = await call({ token:announce(replacement) });
  assert.equal(result.body.catalogueRefreshed, false);
  assert.equal(row('rapidsimplus-01').title, 'Faculty-facing title');
  result = await call({token:announce({...replacement,catalogueRevision:'claims-interview-v2'})});
  assert.equal(result.body.catalogueRefreshed, true, 'intentional copy revisions still work within the same identity');

  await call({token:announce({sim:'numbered-sim',number:9,title:'Numbered',launchUrl:'https://numbered.test'})});
  assert.equal(row('numbered-sim').number,9,'new registration honors an available declared number');
  await call({token:announce({sim:'occupied-number',number:9,launchUrl:'https://occupied.test'})});
  assert.notEqual(row('occupied-number').number,9,'a collision must not displace another simulation');
  await call({token:announce({sim:'numbered-sim',number:10,launchUrl:'https://numbered.test'})});
  assert.equal(row('numbered-sim').number,9,'registration preserves existing/admin numbering');
  await call({token:announce({sim:'invalid-number',number:-1,launchUrl:'https://invalid.test'})});
  assert.ok(row('invalid-number').number>0,'invalid declarations use a free positive number');

  const wire = require('../../simplus02/lib/meta');
  result = await call({ token: announce({ ...wire, sim: wire.id, launchUrl: 'https://wire.test/simplus02' }) });
  assert.equal(result.body.created, true);
  assert.equal(row(wire.id).number, 102);
  assert.equal(row(wire.id).published, false, 'SimPlus-02 stays unpublished until its reveal is verified and an administrator publishes it');
  assert.deepEqual(row(wire.id).detail.beats, wire.detail.beats);

  for (const table of ['course_sims','launches','completions','previews','sim_access','transcripts']) {
    const alias = `used-${table}`;
    DB.sims.push({id:alias,number:20+DB.sims.length,title:'Historical',published:false,detail:{}});
    DB[table].push({sim_id:alias});
    result=await call({token:announce({...replacement,replaces:[alias]})});
    assert.ok(row(alias), `${table} history must be retained`);
    assert.deepEqual(result.body.aliasesRemoved, []);
  }
  // An older still-running Midland deployment may keep announcing this alias.
  result=await call({token:announce({sim:'rapid-03-midland',replaces:['rapid-03-bench'],launchUrl:'https://midland.test'})});
  assert.deepEqual(row('rapid-03-bench'),bench);
  assert.equal((await call({ token:'forged.nonsense' })).status, 401);
  assert.equal((await call({ token:announce({ sim:'x', launchUrl:'not-a-url' }) })).status, 400);
  console.log('registration contract: all checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
