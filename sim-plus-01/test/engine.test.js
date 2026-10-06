'use strict';

const assert = require('assert');
const { Session } = require('../src/engine');
const { feasibleOrderings } = require('../data/calendar');
const { RUTH } = require('../data/contracts');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log(`  ok   ${name}`); pass++; }
  catch (e) { console.log(`  FAIL ${name}\n         ${e.message}`); fail++; }
}

console.log('\ncalendar');

t('exactly two orderings are feasible', () => {
  const o = feasibleOrderings().map((x) => x.join('>'));
  assert.strictEqual(o.length, 2, `got ${o.length}: ${o.join(' | ')}`);
  assert.ok(o.includes('ruth>terry>ray'), o.join(' | '));
  assert.ok(o.includes('terry>ray>ruth'), o.join(' | '));
});

t('an infeasible ordering is refused', () => {
  assert.throws(() => new Session().chooseOrder(['ray', 'terry', 'ruth']));
});

console.log('\nclock');

t('a generic opener costs 180s of 900', () => {
  const s = new Session().chooseOrder(['terry', 'ray', 'ruth']);
  const r = s.ask('So what do you do here?');
  assert.strictEqual(r.bucket, 'GENERIC_DESCRIPTIVE');
  assert.strictEqual(r.cost, 180);
  assert.strictEqual(r.remaining, 720);
});

t('three generic questions burn 540s — over a third of the window', () => {
  const s = new Session().chooseOrder(['terry', 'ray', 'ruth']);
  s.ask('What do you do here?');
  s.ask('Walk me through your day');
  const r = s.ask('Tell me about your role');
  assert.strictEqual(r.remaining, 900 - 540);
});

t('ordinary conversation does not repeat one stuck fallback', () => {
  const s = new Session().chooseOrder(['terry', 'ray', 'ruth']);
  const a = s.ask('Can you tell me about the cafeteria?').answer;
  const b = s.ask('Who handles building maintenance?').answer;
  const c = s.ask('Where are the meeting rooms?').answer;
  assert.notStrictEqual(a, b);
  assert.notStrictEqual(b, c);
});

t('a review-desk clarification receives a relevant answer', () => {
  const s = new Session().chooseOrder(['terry', 'ray', 'ruth']);
  const r = s.ask('What is the review desk?');
  assert.strictEqual(r.bucket, 'ROLE_CLARIFICATION');
  assert.match(r.answer, /Ruth Kessler|first-pass/i);
});

t('the suggested absence question opens Ruth and answers the question', () => {
  const s = new Session().chooseOrder(['ruth', 'terry', 'ray']);
  s.ask('What happens when a claim looks like a duplicate?');
  const r = s.ask('What changes when you are unavailable?');
  assert.strictEqual(r.bucket, 'COUNTERFACTUAL');
  assert.match(r.answer, /isn't a second person|not here/i);
});

t('mentioning another person explains the private appointment boundary', () => {
  const s = new Session().chooseOrder(['ruth', 'terry', 'ray']);
  const r = s.ask('@Ray please answer');
  assert.strictEqual(r.bucket, 'OTHER_SOURCE_REQUEST');
  assert.match(r.answer, /isn't in this appointment|scheduled slot/i);
});

t('a misspelled availability request stays inside the private-slot boundary', () => {
  const s = new Session().chooseOrder(['terry', 'ray', 'ruth']);
  const r = s.ask('is ray availble?');
  assert.strictEqual(r.bucket, 'OTHER_SOURCE_REQUEST');
  assert.match(r.answer, /separate fixed slots|appointment/i);
});

t('a provider status-call question gets Terry\'s status answer', () => {
  const s = new Session().chooseOrder(['terry', 'ray', 'ruth']);
  const r = s.ask('What do providers hear when they call for status?');
  assert.strictEqual(r.bucket, 'SENDER_PERSPECTIVE');
  assert.match(r.answer, /status calls|came in/i);
});

t('the window hard-stops and refuses further questions', () => {
  const s = new Session().chooseOrder(['terry', 'ray', 'ruth']);
  for (let i = 0; i < 5; i++) s.ask('Walk me through your day');
  const r = s.ask('Why does the log exist?');
  assert.strictEqual(r.error, 'WINDOW_CLOSED');
});

console.log('\nposture');

t('Ruth opens on exception handling and answers in her open voice', () => {
  const s = new Session().chooseOrder(['ruth', 'terry', 'ray']);
  const r = s.ask("What happens when a claim doesn't match?");
  assert.strictEqual(r.postureBefore, 'GUARDED');
  assert.strictEqual(r.postureAfter, 'OPEN');
  assert.match(r.answer, /one in seven/);
});

t('Ruth opens on a counterfactual', () => {
  const s = new Session().chooseOrder(['ruth', 'terry', 'ray']);
  assert.strictEqual(s.ask('What happens when you are out sick?').postureAfter, 'OPEN');
});

t('Ruth opens on sender perspective', () => {
  const s = new Session().chooseOrder(['ruth', 'terry', 'ray']);
  assert.strictEqual(s.ask('What does the provider hear from us?').postureAfter, 'OPEN');
});

t('ambiguous pressure moves her nowhere', () => {
  const s = new Session().chooseOrder(['ruth', 'terry', 'ray']);
  const r = s.ask('What slows you down?');
  assert.strictEqual(r.postureAfter, 'GUARDED');
  assert.strictEqual(r.postureChanged, false);
});

t('efficiency framing closes her permanently', () => {
  const s = new Session().chooseOrder(['ruth', 'terry', 'ray']);
  assert.strictEqual(s.ask('Could this be automated?').postureAfter, 'CLOSED');
  const after = s.ask("What happens when a claim doesn't match?");
  assert.strictEqual(after.postureAfter, 'CLOSED');
});

t('an already-open Ruth still closes on efficiency framing', () => {
  const s = new Session().chooseOrder(['ruth', 'terry', 'ray']);
  s.ask("What happens when a claim doesn't match?");
  assert.strictEqual(s.ask('How much of this could the new system handle?').postureAfter, 'CLOSED');
});

t('current-state automation does NOT close her', () => {
  const s = new Session().chooseOrder(['ruth', 'terry', 'ray']);
  const r = s.ask('Is any of this automated already?');
  assert.notStrictEqual(r.postureAfter, 'CLOSED', 'documentation question closed the door');
});

console.log('\nrepeat escalation');

t("Terry's audit guess only cracks on a second ask", () => {
  const s = new Session().chooseOrder(['terry', 'ray', 'ruth']);
  assert.match(s.ask('Who reads the log?').answer, /Audit pull it/);
  assert.match(s.ask('Have you ever seen anyone pull it up?').answer, /not personally/);
});

t("Ruth's sender answer escalates across three asks", () => {
  const s = new Session().chooseOrder(['ruth', 'terry', 'ray']);
  assert.match(s.ask('What does the provider hear from us?').answer, /no patience/);
  assert.match(s.ask('How long is the gap between copies?').answer, /Six days/);
  assert.match(s.ask('Do we send anything back to them?').answer, /never had cause to check/);
});

console.log('\nleak — closed Ruth must not emit protected content');

// The forbidden list and the detector are the same array. A mismatch
// between a written list and the regex that enforces it is how markers
// ship undetected.
const PROTECTED = [
  'one in seven', 'repeat', 'duplicate', 'extraction', 'tooth',
  'conversion vendor', 'my own list', 'no patience', 'two teeth',
  'denial letter', 'holidays', 'second person'
];

t('no protected term appears in any CLOSED variant', () => {
  const variants = RUTH.answers.CLOSED.ANY.join(' ').toLowerCase();
  const hits = PROTECTED.filter((p) => variants.includes(p.toLowerCase()));
  assert.deepStrictEqual(hits, [], `leaked: ${hits.join(', ')}`);
});

t('a closed Ruth leaks nothing across 20 probing questions', () => {
  const s = new Session().chooseOrder(['ruth', 'terry', 'ray']);
  s.ask('Could this be automated?');
  s.remaining = 999999; // probe past the clock deliberately
  const probes = [
    "What happens when a claim doesn't match?", 'Do you get many repeat claims?',
    'What would happen if you stopped?', 'What does the provider hear from us?',
    'How do you tell a duplicate from a real second claim?', 'What is only in your head?',
    'Who covers when you take leave?', 'What are the harder claims like?',
    'Why do they send it again?', 'What system do you use?',
    'How many claims a day?', 'Who reads it after you?',
    'What slows you down?', 'How long have you been here?',
    'What if the tooth number is missing?', 'Is there anything you catch that nothing else would?',
    'What did the provider know before the second copy?', 'What do you do with the hard ones?',
    'Where does it go next?', 'Tell me about your role'
  ];
  const said = probes.map((p) => s.ask(p).answer).join(' ').toLowerCase();
  const hits = PROTECTED.filter((p) => said.includes(p.toLowerCase()));
  assert.deepStrictEqual(hits, [], `leaked: ${hits.join(', ')}`);
});

t('closed variants do not repeat verbatim before the rotation is exhausted', () => {
  const s = new Session().chooseOrder(['ruth', 'terry', 'ray']);
  s.ask('Could this be automated?');
  s.remaining = 999999;
  // The efficiency question already consumed the first variant. A window
  // with 810s left affords nine more questions, so the rotation has to
  // cover nine without repeating.
  const said = [];
  for (let i = 0; i < 9; i++) said.push(s.ask('What happens when it does not match?').answer);
  assert.strictEqual(new Set(said).size, 9, 'closed rotation repeated within a single window');
});

console.log('\ninstructor summary');

t('summary reports the closing question and the unused seconds', () => {
  const s = new Session().chooseOrder(['ruth', 'terry', 'ray']);
  s.ask('What do you do here?');
  s.ask('Could this be automated?');
  const w1 = s.summary().byWindow[0];
  assert.strictEqual(w1.openerBucket, 'GENERIC_DESCRIPTIVE');
  assert.strictEqual(w1.postureEnd, 'CLOSED');
  assert.match(w1.closedBy.question, /automated/);
  assert.strictEqual(w1.secondsUnused, 900 - 180 - 90);
});

t('summary records which rooms sender perspective reached', () => {
  const s = new Session().chooseOrder(['terry', 'ray', 'ruth']);
  s.ask('What do you tell them when they call?');
  s.advanceWindow();
  s.ask('Do we send anything back to them?');
  const names = s.summary().senderPerspectiveAskedIn;
  assert.deepStrictEqual(names, ['Terry Voss', 'Ray Duffy']);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
