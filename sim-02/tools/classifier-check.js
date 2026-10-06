#!/usr/bin/env node
// The branch decides the ending, so the two lines it draws are worth testing
// without a model in the loop: a question is not an instruction, and holding
// something else is not holding this.
//
// An instruction must be recognised without calling anything, so a real hold
// can never be lost to an outage. A question need not short-circuit — a
// transcript may contain a question and an instruction both — but its verdict
// must still come out right when the model is unavailable, which is how these
// cases are run.
process.env.ANTHROPIC_API_KEY = 'test';

let MODEL_CALLED = false;
require.cache[require.resolve('../lib/guard.js')] = { exports: {
  checkAccess: () => true,
  requireKey: () => 'test',
  anthropic: async () => { MODEL_CALLED = true; throw new Error('model unavailable'); },
  body: (req) => req.body
}};
const handler = require('../api/classify.js');

const call = (said) => new Promise(res => {
  MODEL_CALLED = false;
  const r = { _c: 200, status(c) { this._c = c; return this; }, json(d) { res({ status: this._c, body: d, calledModel: MODEL_CALLED }); }, end() { res({}); } };
  handler({ method: 'POST', body: { phase: 1, room: said.map(t => ({ who: 'you', text: t })) }, headers: {} }, r);
});

// [ what was said, expected verdict, must be decided without a model ]
const cases = [
  // instructions — must hold, without a model
  ['Hold the overnight job — don\'t let it run.',            true,  true],
  ['Stop the re-index tonight.',                             true,  true],
  ['Freeze the index before that job runs.',                 true,  true],
  ['Don\'t let the nightly job run until we\'ve looked.',    true,  true],
  ['Let\'s hold the rebuild.',                               true,  true],
  ['Preserve the index state, please.',                      true,  true],

  // questions — must not hold, even with the model unavailable
  ['Should we hold that job?',                               false, false],
  ['What happens if the index rebuilds tonight?',            false, false],
  ['Could we pause the re-index?',                           false, false],
  ['Does the ingestion job run tonight?',                    false, false],

  // holding something else — must not hold
  ['Hold off on notifying the customers until tomorrow.',    false, false],
  ['Pause the outreach to the nine.',                        false, false],
  ['Don\'t publish anything yet.',                           false, false],

  // nothing relevant said at all
  ['Joanna, how did a superseded revision stay in the library?', false, false],

  // wondering aloud and then deciding, in one message — the instruction wins
  ['Should we hold that job? Hold the overnight job — do not let it run.', true, true],
  ['What happens if it rebuilds tonight? Stop the re-index.',              true, true],
  ['Could we pause the job? Actually yes — freeze the index.',             true, true],
  // and the reverse order, which must still hold
  ['Hold the nightly job. Or should we? No, hold it.',                     true, true],
];

(async () => {
  let failed = 0;
  for (const [said, expectHeld, expectLocal] of cases) {
    const r = await call([said]);
    const heldOK = r.body.held === expectHeld;
    // With the model throwing, anything not decided locally degrades — which is
    // exactly what we want to observe.
    const localOK = expectLocal ? !r.calledModel : true;
    const ok = heldOK && localOK;
    if (!ok) failed++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} held=${String(r.body.held).padEnd(5)} ${r.calledModel ? 'model down, fell back' : 'decided locally  '}  "${said}"`);
    if (!heldOK) console.log(`         expected held=${expectHeld}`);
    if (!localOK) console.log(`         expected this to be decided without a model`);
  }

  // The failure that matters: an outage must not turn a question into a hold.
  const outage = await call(['Should we hold that job?']);
  const safe = outage.body.held === false;
  console.log(`  ${safe ? 'ok  ' : 'FAIL'} an outage does not turn a question into an instruction`);
  if (!safe) failed++;

  console.log(failed ? `\n${failed} classifier case${failed === 1 ? '' : 's'} wrong.` : '\nclassifier: all cases correct');
  process.exit(failed ? 1 : 0);
})();
