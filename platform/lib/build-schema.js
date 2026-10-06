#!/usr/bin/env node
// Regenerates lib/schema.js from lib/schema.sql.
// The SQL file is the source of truth; the JS module is what actually ships,
// because Vercel only bundles files it can see being required.
const fs = require('fs');
const path = require('path');

const sqlText = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

// Strip comments first — otherwise a statement preceded by one looks like a
// comment and gets dropped.
const stripped = sqlText
  .split('\n')
  .filter(l => !l.trim().startsWith('--'))
  .join('\n');

const stmts = stripped.split(';').map(x => x.trim()).filter(Boolean);

const out = `// Generated from schema.sql — kept as JavaScript so Vercel bundles it with the
// function. Edit schema.sql, then run \`node lib/build-schema.js\`.

module.exports = [
${stmts.map(s => '`' + s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`,').join('\n\n')}
];
`;
fs.writeFileSync(path.join(__dirname, 'schema.js'), out);

const tables = stmts.filter(s => /^CREATE TABLE/i.test(s)).length;
const indexes = stmts.filter(s => /^CREATE (UNIQUE )?INDEX/i.test(s)).length;
const alters = stmts.filter(s => /^ALTER TABLE/i.test(s)).length;
console.log(`schema.js written — ${stmts.length} statements (${tables} tables, ${indexes} indexes, ${alters} alters)`);
if (tables !== 12) { console.error(`expected 12 tables, found ${tables}`); process.exit(1); }
