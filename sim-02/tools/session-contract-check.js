#!/usr/bin/env node
// What the browser sends and what the server demands must agree. When they do
// not, the server returns 403, the browser catches it so a student's run
// continues, and the facilitator quietly receives nothing — which is how a class
// finishes with an empty comparison and nobody knowing why.
const fs = require('fs');
const path = require('path');

const bundle = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '../api/session.js'), 'utf8');
let bad = 0;

// what submit is required to carry
const required = [];
const submitBlock = server.slice(server.indexOf("case 'submit'"), server.indexOf("case 'submit'") + 1400);
if (/not_in_that_group/.test(submitBlock)) required.push('participantId');
if (/group_required/.test(submitBlock)) required.push('groupId');

// what the browser actually sends
const call = bundle.slice(bundle.indexOf("action: 'submit'"), bundle.indexOf("action: 'submit'") + 320);
for (const field of required) {
  if (!new RegExp('\\b' + field + '\\s*:').test(call)) {
    bad++;
    console.log(`  the server rejects a submit without ${field}, and the browser does not send it`);
  }
}

// the field names the server stores must be the ones the browser sends
const stored = [...submitBlock.matchAll(/b\.(\w+)\s*!==\s*undefined/g)].map(m => m[1]);
for (const field of stored) {
  if (!new RegExp('\\b' + field + '\\s*:').test(call)) {
    bad++;
    console.log(`  the server reads b.${field}, which the browser never sends — the value is silently dropped`);
  }
}

if (bad) { console.error('\nA facilitator would receive nothing, and nobody would be told.'); process.exit(1); }
console.log(`session contract: browser and server agree on ${required.length + stored.length} fields`);
