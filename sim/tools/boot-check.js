#!/usr/bin/env node
// Boots the built bundle against a stubbed DOM. Node's syntax check does not
// catch load-time errors — a variable used before its declaration parses fine
// and then kills the page — and this repo has shipped that twice.
//
// Run after build.js and before any deploy.
const fs = require('fs');
const path = require('path');

function mk() {
  const o = { innerHTML:'', style:{}, className:'', dataset:{}, title:'', value:'', textContent:'',
    scrollTop:0, scrollHeight:0, onclick:null, disabled:false,
    appendChild(){}, insertBefore(){}, remove(){}, addEventListener(){}, focus(){},
    setSelectionRange(){}, insertAdjacentHTML(){}, select(){},
    classList:{ toggle(){}, add(){}, remove(){} } };
  o.querySelector = () => mk(); o.querySelectorAll = () => [];
  Object.defineProperty(o, 'firstElementChild', { get: () => mk() });
  return o;
}

function boot(label, search) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const env = {
    window: { matchMedia: () => ({ matches: false }) },
    location: { hash:'', search, pathname:'/', origin:'https://x', reload(){}, replace(){} },
    history: { replaceState(){} },
    document: { getElementById: () => mk(), createElement: () => mk(),
      body: { appendChild(){} }, querySelector: () => mk(), querySelectorAll: () => [] },
    fetch: async () => ({ ok:true, status:200,
      json: async () => ({ cast:{}, castOrder:[], intro:{}, actions:[], readings:[], labels:[] }) }),
    Blob: function(){}, URL: { createObjectURL:()=>'', revokeObjectURL(){} },
    setInterval: () => 0, setTimeout: () => 0,
    atob: (b) => Buffer.from(b, 'base64').toString('binary'),
    navigator: { clipboard: { writeText(){} } }
  };
  try {
    new Function(...Object.keys(env), blocks.join('\n'))(...Object.values(env));
    console.log(`  ok    ${label}`);
    return true;
  } catch (e) {
    console.error(`  FAIL  ${label}: ${e.message}`);
    return false;
  }
}

console.log('boot check:');
const ok = [
  boot('standalone', ''),
  boot('arriving with a launch token', '?lt=eyJzdWIiOiJ4In0.sig'),
  boot('joining a facilitated session', '?s=ABCDE')
].every(Boolean);
process.exit(ok ? 0 : 1);
