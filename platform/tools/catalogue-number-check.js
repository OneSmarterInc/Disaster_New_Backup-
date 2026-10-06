#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const identity = require('../public/sim-identity.js');
for (const [id,number,label] of [
  ['rapid-03-midland',4,'RapidSim 03'],['rapid-04-whose-number',4,'RapidSim 04'],['rapid-05-approve',6,'RapidSim 05'],
  ['rapid-06-switch',5,'RapidSim 06'],['rapid-07-bought',8,'RapidSim 07'],
  ['rapid-08-later',7,'RapidSim 08'],['rapid-09-money-land',10,'RapidSim 09'],
  ['rapid-10-bubble',9,'RapidSim 10'],['rapidsimplus-01',101,'RapidSim+ 01'],['rapidsimplus-02',102,'RapidSim+ 02']
]) {
  const row={id,number,title:'Test'};
  assert.equal(identity.label(row),label);
  assert.equal(identity.label({sim_id:id,number}),label,'course/result rows use sim_id');
  assert.equal(row.number,number,'display must not mutate stored numbers');
}
assert.equal(identity.label({id:'rapid-03-bench',number:3,title:"Why Don't They Have Any Patience?"}),'RapidSim+ 01');
assert.equal(identity.label({id:'rapid-03-bench',number:3,title:'The Bench Is Clear'}),'RapidSim 03','historical Bench rows must not be relabelled as Wexford');
const ctx={window:{},console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/sim-identity.js'),'utf8'),ctx);
assert.equal(ctx.window.RapidSimsIdentity.label({id:'rapid-10-bubble',number:9}),'RapidSim 10','browser export works');
console.log('Catalogue numbering passed: canonical labels, Plus labels, legacy disambiguation, course rows and browser export.');
