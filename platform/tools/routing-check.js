#!/usr/bin/env node
// Static configuration checks, not a test of live hosted deployments.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '../vercel.json'), 'utf8'));
const publicDir = path.join(__dirname, '../public');
const manifest = require('../../tools/local/manifest.cjs');
const targets = {
  sim01:'https://flexee-rapid-sim-01-vercel.vercel.app',
  sim02:'https://flexee-rapid-sim-02.vercel.app',
  sim03:'https://sim-03-midland.vercel.app',
  sim04:'https://sim04.vercel.app', sim05:'https://sim05.vercel.app',
  sim06:'https://sim06.vercel.app', sim07:'https://sim07.vercel.app',
  sim08:'https://sim08.vercel.app', sim09:'https://sim09.vercel.app',
  sim10:'https://sim10.vercel.app',
  simplus01:'https://flexee-rapid-sim-03-vercel.vercel.app'
};
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function match(source, pathname) {
  const suffix='/:path*';
  return source.endsWith(suffix)
    ? new RegExp('^'+escape(source.slice(0,-suffix.length))+'(?:/(.*))?$').exec(pathname)
    : source===pathname ? [pathname] : null;
}
function resolve(pathname) {
  for(const rule of cfg.rewrites) {
    const hit=match(rule.source,pathname);
    if(hit)return rule.destination.replace(':path*',hit[1]||'');
  }
  return null;
}
assert.equal(new Set(cfg.rewrites.map(r=>r.source)).size,cfg.rewrites.length,'Duplicate rewrite source');
for(const key of ['route','folder','db'])assert.equal(new Set(manifest.map(x=>x[key])).size,manifest.length,'Duplicate local '+key);
assert.equal(new Set(manifest.map(x=>x.meta.id)).size,manifest.length,'Duplicate simulation identity');
for(const page of ['admin','faculty','student','signin','account','join']) {
  assert.equal(resolve('/'+page),'/'+page+'.html',page+' alias destination');
  assert(fs.existsSync(path.join(publicDir,page+'.html')));
}
let count=0;
for(const [route,host]of Object.entries(targets)) {
  const entry=manifest.find(x=>x.route===route);assert(entry,'Missing local manifest entry '+route);
  const landing=entry.entry==='launch.html'?'/launch.html':'/';
  for(const [tail,destination]of [['',landing],['/',landing],['/api/health','/api/health'],['/api/example','/api/example'],['/index.html','/index.html']]) {
    assert.equal(resolve('/'+route+tail),host+destination,route+tail+' destination');count++;
  }
  assert.equal(resolve('/'+route+'-unknown'),null,'Overbroad route '+route);
}
for(const tail of ['','/','/api/health'])assert.equal(resolve('/rapidsims01'+tail),resolve('/simplus01'+tail),'Legacy Plus alias');
for(const tail of ['/demo','/demo/'])assert.equal(resolve('/sim07'+tail),targets.sim07+'/index.html','Sim07 demo');
const protectedPaths=['/',...fs.readdirSync(publicDir).map(p=>'/'+p),...fs.readdirSync(path.join(__dirname,'../api')).filter(p=>p.endsWith('.js')).map(p=>'/api/'+p.slice(0,-3))];
for(const p of protectedPaths)assert.equal(resolve(p),null,'Platform path captured: '+p);
console.log(`Routing configuration passed: ${count} destination checks across ${Object.keys(targets).length} hosted simulation prefixes; 12 unique local routes; aliases and platform paths checked.`);
if(!cfg.rewrites.some(r=>r.source==='/simplus02')) {
  console.log('KNOWN GAP: hosted /simplus02 has no configured destination. Local /simplus02 is separate and supported.');
  if(process.argv.includes('--require-all-hosted'))process.exitCode=1;
} else {
  throw new Error('Hosted /simplus02 was added: verify its destination and include it in this test.');
}
