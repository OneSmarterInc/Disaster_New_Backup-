global.RapidSimsIdentity = require('../public/sim-identity.js');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const vercel = JSON.parse(read('platform/vercel.json'));
const rewrites = Object.fromEntries((vercel.rewrites || []).map(r => [r.source, r.destination]));
assert.equal(rewrites['/sim03'], 'https://sim-03-midland.vercel.app/launch.html');
assert.equal(rewrites['/sim03/'], 'https://sim-03-midland.vercel.app/launch.html');
assert.equal(rewrites['/sim03/:path*'], 'https://sim-03-midland.vercel.app/:path*');
assert((vercel.headers || []).some(h => h.source === '/sim03/(.*)'), 'Sim03 proxy headers are missing');

const cataloguePage = read('platform/public/index.html');
assert(cataloguePage.includes('function catalogueFactsHTML(s)'), 'catalogue does not support per-sim facts');
assert(cataloguePage.includes('${catalogueFactsHTML(s)}'), 'catalogue card does not render per-sim facts');

const detailJs = read('platform/public/sim-detail.js');
assert(detailJs.includes('const customFacts ='), 'detail page does not support per-sim facts');
assert(detailJs.includes('const customGlance ='), 'detail page does not support per-sim at-a-glance facts');
new vm.Script(detailJs, { filename: 'platform/public/sim-detail.js' });

const S = require(path.join(root, 'sim03', 'lib', 'scenario.js'));
const { effective } = require(path.join(root, 'platform', 'lib', 'catalogue.js'));
const d = effective(S.META.detail);
assert(Array.isArray(d.catalogueFacts) && d.catalogueFacts.length >= 3, 'Sim03 catalogue facts missing');
assert(d.catalogueFacts.some(x => /individual or team/i.test(x.value)), 'Sim03 play-mode fact missing');
assert(d.catalogueFacts.some(x => /briefing packet/i.test(x.value)), 'Sim03 preparation fact missing');
assert(d.catalogueFacts.some(x => /no score/i.test(x.value)), 'Sim03 assessment fact missing');
assert(Array.isArray(d.atAGlance) && d.atAGlance.some(x => /\$9 million.*five areas/.test(x.value)), 'Sim03 quantitative fact missing');
assert(Array.isArray(d.beats) && d.beats.every(x => x.at && x.what), 'Sim03 detail beats do not match platform renderer contract');

const guard = read('sim03/lib/guard.js');
assert(guard.includes("+ '/sim03'"), 'Sim03 does not derive the canonical platform route');

console.log('Sim03 platform integration checks passed.');
