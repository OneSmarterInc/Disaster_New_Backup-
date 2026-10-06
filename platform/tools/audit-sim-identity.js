#!/usr/bin/env node
'use strict';
// Run from an authorized environment with the existing platform DB connection.
// No secrets or participant records are printed; no data is modified.
const { auditSimIdentities, DEFAULT_IDS } = require('../lib/sim-identity-audit');
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node tools/audit-sim-identity.js [sim-id ...]\nRead-only catalogue and dependency counts. Defaults: ' + DEFAULT_IDS.join(', ')); return;
  }
  const { sql } = require('../lib/db');
  console.log(JSON.stringify(await auditSimIdentities(sql(), args.length ? args : DEFAULT_IDS), null, 2));
}
if (require.main === module) main().catch(e => { console.error('Identity audit failed:', e.message); process.exitCode = 1; });
