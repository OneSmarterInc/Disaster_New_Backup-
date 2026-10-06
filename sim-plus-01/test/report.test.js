'use strict';

const assert = require('assert');
const { Session } = require('../src/engine');
const { validate, review } = require('../src/report');
const { ROWS, EVIDENCE, LOOP_PAIRS } = require('../data/report');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log(`  ok   ${name}`); pass++; }
  catch (e) { console.log(`  FAIL ${name}\n         ${e.message}`); fail++; }
}

const J = 'Documented during the interview windows.';
function form(dispositions, rootCause = 'Front-end latency drives repeat submissions.') {
  return {
    rootCause,
    rows: Object.fromEntries(
      Object.entries(dispositions).map(([k, d]) => [k, { disposition: d, justification: J }])
    )
  };
}
const ALL_KEEP = { intake: 'keep', log: 'keep', vendor: 'keep', review: 'keep' };

console.log('\nvalidation');

t('a complete report validates', () => {
  assert.strictEqual(validate(form(ALL_KEEP)).ok, true);
});

t('an omitted row is refused', () => {
  const f = form(ALL_KEEP);
  delete f.rows.review;
  const v = validate(f);
  assert.strictEqual(v.ok, false);
  assert.match(v.errors[0].message, /First-pass review/);
});

t('a blank justification is refused', () => {
  const f = form(ALL_KEEP);
  f.rows.review.justification = '   ';
  assert.strictEqual(validate(f).ok, false);
});

t('a blank root cause is refused', () => {
  assert.strictEqual(validate(form(ALL_KEEP, '')).ok, false);
});

t('a short vendor justification names the length requirement', () => {
  const f = form(ALL_KEEP);
  f.rows.vendor.justification = 'too short';
  const v = validate(f);
  assert.strictEqual(v.ok, false);
  const error = v.errors.find((e) => e.field === 'vendor');
  assert.ok(error);
  assert.match(error.message, /Fax conversion vendor: justification must be at least 15 characters/);
});

t('an invented disposition is refused', () => {
  const f = form(ALL_KEEP);
  f.rows.review.disposition = 'outsource';
  const v = validate(f);
  assert.strictEqual(v.ok, false);
  assert.match(v.errors[0].message, /not a disposition/);
});

t('every row in the schema is required', () => {
  assert.strictEqual(ROWS.length, 4);
  const v = validate({ rootCause: 'x'.repeat(30), rows: {} });
  assert.strictEqual(v.errors.filter((e) => e.field !== 'rootCause').length, 4);
});

console.log('\nconsequences');

t('automating first-pass review fires the harm', () => {
  const r = review(form({ ...ALL_KEEP, review: 'automate' }), []);
  assert.strictEqual(r.harmFired, true);
  assert.match(r.harm[0].consequence, /Denial letters go to patients/);
});

t('eliminating first-pass review also fires harm', () => {
  assert.strictEqual(review(form({ ...ALL_KEEP, review: 'eliminate' }), []).harmFired, true);
});

t('keeping first-pass review fires no harm', () => {
  assert.strictEqual(review(form(ALL_KEEP), []).harmFired, false);
});

t('cannot_assess on the vendor row is the correct answer', () => {
  const r = review(form({ ...ALL_KEEP, vendor: 'cannot_assess' }), []);
  const vendor = r.consequences.find((c) => c.rowId === 'vendor');
  assert.strictEqual(vendor.severity, 'correct');
});

t('cannot_assess on a row they had full access to is a dodge', () => {
  const r = review(form({ ...ALL_KEEP, review: 'cannot_assess' }), []);
  assert.strictEqual(r.dodges.length, 1);
  assert.strictEqual(r.dodges[0].rowId, 'review');
  assert.strictEqual(r.harmFired, false, 'a dodge must not be scored as harm');
});

console.log('\nevidence — reasoned vs lucky');

function playPathB() {
  const s = new Session().chooseOrder(['terry', 'ray', 'ruth']);
  s.ask('Why does the log exist?');
  s.ask('Who reads the log?');
  s.ask('Have you ever seen anyone pull it up?');
  s.ask('What do you tell them when they call?');
  s.advanceWindow();
  s.ask('How many claims a day?');
  s.ask('Do we send anything back to them?');
  s.ask('What is the turnaround from the vendor?');
  s.advanceWindow();
  s.ask('Is there anything you catch that nothing else would?');
  s.ask('Why do they send it again?');
  s.ask('How long is the gap between copies?');
  return s;
}

t('an informed run holds the loop evidence', () => {
  const r = review(form({ ...ALL_KEEP, log: 'eliminate' }), playPathB().transcript);
  assert.strictEqual(r.evidence.loopAvailable, true);
  const ids = r.evidence.held.map((e) => e.id);
  assert.ok(ids.includes('no_reply'), ids.join(','));
  assert.ok(ids.includes('resend_spacing'), ids.join(','));
});

t('a run that closed Ruth cannot reach the loop', () => {
  const s = new Session().chooseOrder(['ruth', 'terry', 'ray']);
  s.ask('So what do you do here?');
  s.ask('How much of this could the new system handle?');
  s.ask('Do you get many repeat claims?');
  s.advanceWindow();
  s.ask('Why does the log exist?');
  s.advanceWindow();
  s.ask('Do we send anything back to them?');
  const r = review(form({ ...ALL_KEEP, review: 'automate' }), s.transcript);
  assert.strictEqual(r.evidence.loopAvailable, false);
  assert.strictEqual(r.harmFired, true);
});

t('eliminating the log without asking about it is flagged unsupported', () => {
  const s = new Session().chooseOrder(['terry', 'ray', 'ruth']);
  s.ask('How many claims a day?'); // never asks purpose or consumer
  const r = review(form({ ...ALL_KEEP, log: 'eliminate' }), s.transcript);
  assert.strictEqual(r.support.log, false);
  assert.ok(r.unsupportedDispositions.some((u) => u.rowId === 'log'));
});

t('eliminating the log after asking about it is supported', () => {
  const r = review(form({ ...ALL_KEEP, log: 'eliminate' }), playPathB().transcript);
  assert.strictEqual(r.support.log, true);
  assert.ok(!r.unsupportedDispositions.some((u) => u.rowId === 'log'));
});

t('keeping review without ever opening Ruth is unsupported — right answer, no reasoning', () => {
  const s = new Session().chooseOrder(['ruth', 'terry', 'ray']);
  s.ask('So what do you do here?');
  const r = review(form(ALL_KEEP), s.transcript);
  assert.strictEqual(r.harmFired, false, 'keep is the safe disposition');
  assert.strictEqual(r.support.review, false, 'but nothing was learned to support it');
});

t('a dodge is never counted as an unsupported disposition', () => {
  const r = review(form({ ...ALL_KEEP, intake: 'cannot_assess' }), []);
  assert.ok(!r.unsupportedDispositions.some((u) => u.rowId === 'intake'));
});

console.log('\nintegrity');

t('every evidence marker is reachable from some scripted answer', () => {
  const ids = new Set(EVIDENCE.map((e) => e.id));
  for (const pair of LOOP_PAIRS) {
    for (const id of pair) assert.ok(ids.has(id), `loop pair references unknown marker "${id}"`);
  }
});

t('the electronic anomaly marker actually fires', () => {
  const s = new Session().chooseOrder(['ruth', 'terry', 'ray']);
  s.ask('What happens when a claim does not match?');
  const second = s.ask('Do you get many repeat claims?');
  assert.match(second.answer, /hardly ever see twice/);
  const held = review(form(ALL_KEEP), s.transcript).evidence.held.map((e) => e.id);
  assert.ok(held.includes('electronic_anomaly'), held.join(','));
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
