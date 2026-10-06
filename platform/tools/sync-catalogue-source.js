#!/usr/bin/env node
// Export only authored public metadata, never the scenario module itself.
// Vercel builds platform/ in isolation, so sibling sim files are unavailable
// there. This checked-in snapshot keeps the catalogue current even before a
// simulation's next registration and supports existing Wexford course aliases.
const fs = require('node:fs');
const path = require('node:path');
const sources = [
  'sim/lib/scenario.js', 'sim-02/lib/scenario.js', 'sim03/lib/scenario.js', 'sim04/lib/meta.js',
  'sim05/config/content.js', 'sim06/lib/meta.js', 'sim07/data/config.js',
  'sim08/config/content.js', 'sim09/config/content.js', 'sim10/data/config.js',
  'sim-plus-01/lib/meta.js', 'simplus02/lib/meta.js'
];
function snapshot() {
  return Object.fromEntries(sources.map(file => {
    const module = require(path.join(__dirname, '../..', file));
    const m = module.META || module;
    return [m.id || m.simId, { tagline: m.tagline, description: m.description, detail: m.detail }];
  }));
}
if (require.main === module) {
  const output = path.join(__dirname, '../lib/catalogue-source.json');
  const text = JSON.stringify(snapshot(), null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(output, 'utf8') !== text) {
      console.error('Catalogue copy is stale. Run node platform/tools/sync-catalogue-source.js');
      process.exitCode = 1;
    } else console.log(`Catalogue source matches all ${sources.length} simulations.`);
  } else {
    fs.writeFileSync(output, text);
    console.log(`Updated public catalogue source for all ${sources.length} simulations.`);
  }
}
module.exports = { sources, snapshot };
