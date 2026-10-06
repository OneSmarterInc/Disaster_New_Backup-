#!/usr/bin/env node
// The public and faculty detail renderer must explain every shipped sim,
// without inventing a common duration, play mode, or number of decisions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { present, statesOutcome } = require('../lib/catalogue');
const { snapshot } = require('./sync-catalogue-source');
const source = require('../lib/catalogue-source.json');
const identity = require('../public/sim-identity');
assert.deepEqual(source, snapshot(), 'refresh the public metadata snapshot after editing a sim');
assert.equal(Object.keys(source).length, 12);
const scope = { window: {}, RapidSimsIdentity: identity };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/sim-detail.js'), 'utf8'), scope);
const render = scope.window.simDetailHTML;
for (const [id, copy] of Object.entries(source)) {
  const before = { id, title: id, minutes: 123, published: false, launch_url: '/existing-link',
    detail: { teaches: 'Stale registered copy' } };
  const saved = structuredClone(before);
  const sim = present(before);
  assert.deepEqual(before, saved, 'presentation must not mutate stored records');
  for (const key of ['id', 'title', 'minutes', 'published', 'launch_url']) assert.equal(sim[key], saved[key]);
  for (const key of ['world', 'seat', 'clock', 'activity', 'output', 'preparation', 'suitableFor',
    'teaches', 'durationNote', 'tangle', 'turn', 'after', 'discussion', 'sessionShape']) {
    assert.ok(sim.detail[key]?.trim(), `${id}: missing ${key}`);
  }
  assert.ok(sim.detail.beats.length >= 3, `${id}: explain the steps`);
  assert.ok(sim.detail.catalogueFacts.some(x => x.label === 'Play'), `${id}: specify the play mode`);
  assert.deepEqual(statesOutcome(JSON.stringify(copy)), [], `${id}: public copy must not state the answer`);
  for (const forFaculty of [false, true]) {
    const html = render(sim, { forFaculty });
    for (const heading of ['What you will do', 'What you will produce', 'Before you start',
      'Useful for', 'What you will learn', 'How it works', 'Running a session']) assert.ok(html.includes(heading), `${id}: ${heading}`);
    assert.equal(html.includes('Request a preview'), !forFaculty);
    assert.ok(!/How the twenty minutes go|runs <b>standalone|<b>Three<\/b>/.test(html));
  }
  console.log(`PASS ${id}: complete public and faculty detail`);
}
const rewritten = present({ id: 'rapid-06-switch', tagline: 'My tagline', description: 'My description',
  detail: { activity: 'My activity', preparation: 'My preparation', _edited: ['tagline', 'description', 'activity', 'preparation'] } });
assert.equal(rewritten.tagline, 'My tagline');
assert.equal(rewritten.description, 'My description');
assert.equal(rewritten.detail.activity, 'My activity');
assert.equal(rewritten.detail.preparation, 'My preparation');
const legacy = { id: 'rapid-03-bench', title: 'The Bench Is Clear', number: 3, minutes: 45, detail: { seat: 'Original role' } };
assert.equal(present(legacy).detail.seat, 'Original role', 'a mixed historical id must not identify a different scenario');
const wexford = present({ ...legacy, title: 'Why Don’t They Have Any Patience?' });
assert.equal(wexford.id, legacy.id);
assert.equal(wexford.detail.activity, source['rapidsimplus-01'].detail.activity);
const unknown = render(present({ id: 'future-sim', title: 'Future sim' }));
assert.ok(!/individually|no<\/b> preparation|not<\/b> marked|About an hour/.test(unknown), 'unknown sims get no invented facts');
const unsafe = render(present({ id: 'future-sim', title: '<script>alert(1)</script>', detail: { activity: '<img src=x onerror=alert(1)>' } }));
assert.ok(!unsafe.includes('<script>') && !unsafe.includes('<img'), 'copy is escaped');
console.log('PASS admin copy, legacy identity, unknown metadata, and HTML escaping');
