'use strict';
const assert = require('assert');
const cfg = require('../data/config');
const E = require('../lib/engine');
const { checkConfig, checkVercel } = require('../tools/build-gate');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; console.error(`FAIL ${name}\n  ${e.message}`); }
}
const clone = o => JSON.parse(JSON.stringify(o));
const T0 = 1_000_000;
const sec = s => T0 + s * 1000;
function started() { return E.begin(E.createParticipant({ participantId: 'p1' }), T0); }

// ---- Session creation
t('mode is required', () => assert.throws(() => E.createSession({ sessionId: 's', now: T0 }), /mode is required/));
t('mode must be valid', () => assert.throws(() => E.createSession({ sessionId: 's', mode: 'solo', now: T0 }), /mode/));
t('both modes accepted', () => {
  assert.strictEqual(E.createSession({ sessionId: 's', mode: 'individual', now: T0 }).mode, 'individual');
  assert.strictEqual(E.createSession({ sessionId: 's', mode: 'team', now: T0 }).mode, 'team');
});

// ---- Clock and reports
t('briefing shows no reports', () => assert.deepStrictEqual(E.visibleReports(E.createParticipant({ participantId: 'x' }), sec(100)), []));
t('report 1 at begin', () => assert.strictEqual(E.visibleReports(started(), sec(0)).length, 1));
t('reports drip on schedule', () => {
  const p = started();
  assert.strictEqual(E.visibleReports(p, sec(44)).length, 1);
  assert.strictEqual(E.visibleReports(p, sec(45)).length, 2);
  assert.strictEqual(E.visibleReports(p, sec(540)).length, 12);
  assert.strictEqual(E.visibleReports(p, sec(9999)).length, 12);
});
t('story time runs 11:05 to 12:05', () => {
  assert.strictEqual(E.storyTime(0), '11:05');
  assert.strictEqual(E.storyTime(180_000), '11:23');
  assert.strictEqual(E.storyTime(600_000), '12:05');
});
t('report story times match the script', () => {
  const expect = ['11:05','11:09','11:14','11:18','11:23','11:28','11:33','11:38','11:43','11:48','11:53','11:59'];
  cfg.reports.forEach((r, i) => assert.strictEqual(E.storyTime(r.atSeconds * 1000), expect[i], `report ${r.n}`));
});

// ---- Decisions
t('decision needs a reason', () => assert.throws(() => E.decide(started(), { choice: 'stay', reason: '  ', now: sec(10) }), /reason/));
t('reason length capped', () => assert.throws(() => E.decide(started(), { choice: 'stay', reason: 'x'.repeat(201), now: sec(10) }), /200/));
t('decision is irreversible', () => {
  const p = E.decide(started(), { choice: 'stay', reason: 'r', now: sec(10) });
  assert.throws(() => E.decide(p, { choice: 'switch', reason: 'r', now: sec(20) }), /already/);
});
t('no decision after the clock', () => assert.throws(() => E.decide(started(), { choice: 'switch', reason: 'r', now: sec(600) }), /ended/));
t('no decision before begin', () => assert.throws(() => E.decide(E.createParticipant({ participantId: 'x' }), { choice: 'switch', reason: 'r', now: T0 }), /not begun/));
t('decision records report and story time', () => {
  const p = E.decide(started(), { choice: 'switch', reason: 'firmware', now: sec(200) });
  assert.strictEqual(p.decision.atReport, 5);
  assert.strictEqual(p.decision.storyTime, '11:25');
});

// ---- Economics
t('holder loses 60 x 560', () => assert.strictEqual(E.lostSoFar(started(), sec(600)), 33600));
t('ticker stops at clock end', () => assert.strictEqual(E.lostSoFar(started(), sec(900)), 33600));
t('switcher pays 8 x 240 extra', () => {
  const p = E.decide(started(), { choice: 'switch', reason: 'r', now: sec(180) });
  assert.strictEqual(E.lostSoFar(p, sec(600)), 33600 + 1920);
});
t('late switch window is clipped at clock end', () => {
  const p = E.decide(started(), { choice: 'switch', reason: 'r', now: sec(560) }); // 40s left, window is 80s
  assert.strictEqual(E.lostSoFar(p, sec(600)), 33600 + 960);
});
t('ticker is monotonic', () => {
  const p = E.decide(started(), { choice: 'switch', reason: 'r', now: sec(100) });
  let prev = -1;
  for (let s = 0; s <= 600; s += 5) { const v = E.lostSoFar(p, sec(s)); assert.ok(v >= prev); prev = v; }
});
t('switch status message after window', () => {
  const p = E.decide(started(), { choice: 'switch', reason: 'r', now: sec(100) });
  assert.strictEqual(E.studentView(p, sec(150)).status.kind, 'switching');
  assert.strictEqual(E.studentView(p, sec(180)).status.text, cfg.switchCompleteMessage);
});
t('stay has no status message', () => {
  const p = E.decide(started(), { choice: 'stay', reason: 'r', now: sec(100) });
  assert.strictEqual(E.studentView(p, sec(200)).status, null);
});

// ---- Reading
t('docs opened during briefing count', () => {
  let p = E.createParticipant({ participantId: 'p' });
  p = E.openDoc(p, 'northline', T0 - 5000);
  p = E.begin(p, T0);
  p = E.openDoc(p, 'clearpath', sec(20));
  p = E.decide(p, { choice: 'stay', reason: 'Meridian in both', now: sec(30) });
  assert.deepStrictEqual(p.decision.docsBefore, { northline: true, clearpath: true });
});
t('docs opened after deciding do not count', () => {
  let p = E.decide(started(), { choice: 'switch', reason: 'r', now: sec(30) });
  p = E.openDoc(p, 'northline', sec(40));
  assert.deepStrictEqual(p.decision.docsBefore, { northline: false, clearpath: false });
});
t('first open is kept', () => {
  let p = E.openDoc(started(), 'northline', sec(10));
  p = E.openDoc(p, 'northline', sec(50));
  assert.strictEqual(p.docsOpened.northline, sec(10));
});
t('unknown document rejected', () => assert.throws(() => E.openDoc(started(), 'nope', T0), /unknown/));

// ---- Student view never leaks
t('student view has no reveal content', () => {
  const v = JSON.stringify(E.studentView(started(), sec(599)));
  assert.ok(!v.includes('Route 4 exchange'));
  assert.ok(!v.includes(cfg.reveal.caption));
  assert.ok(!v.includes('12:40'));
});
t('reveal locked during play', () => assert.throws(() => E.reveal(started(), sec(599)), /after the clock/));

// ---- Reveal
t('reveal for switcher', () => {
  const p = E.decide(E.openDoc(started(), 'clearpath', sec(5)), { choice: 'switch', reason: 'firmware ruled out', now: sec(300) });
  const r = E.reveal(p, sec(600));
  assert.strictEqual(r.decisionLine, 'You switched to ClearPath at report 7 (11:35). Your reason: firmware ruled out');
  assert.deepStrictEqual(r.reading, { northline: false, clearpath: true });
  assert.strictEqual(r.switchWindow.fromStory, '11:35');
  assert.strictEqual(r.lostTotal, 35520);
  assert.ok(!/\{\w+\}/.test(r.decisionLine));
});
t('reveal for no decision', () => {
  let p = E.openDoc(started(), 'northline', sec(590));
  const r = E.reveal(p, sec(600));
  assert.strictEqual(r.decisionLine, cfg.reveal.decisionLines.none);
  assert.strictEqual(r.readingLabel, cfg.reveal.readingLine.none);
  assert.deepStrictEqual(r.reading, { northline: true, clearpath: false });
  assert.strictEqual(r.switchWindow, null);
});
t('reveal carries no verdict or counterfactual', () => {
  const p = E.decide(started(), { choice: 'stay', reason: 'r', now: sec(10) });
  const s = JSON.stringify(E.reveal(p, sec(600))).toLowerCase();
  [/\bcorrect\b/, /\bright\b/, /\bwrong\b/, /\bscore/, /would have/, /if you had/].forEach(re => assert.ok(!re.test(s), String(re)));
});

// ---- Projector
t('projector aggregates and hides small groups', () => {
  const mk = (id, choice, atS, docs) => {
    let p = E.begin(E.createParticipant({ participantId: id }), T0);
    docs.forEach(d => { p = E.openDoc(p, d, sec(1)); });
    return choice ? E.decide(p, { choice, reason: 'secret reason text', now: sec(atS) }) : p;
  };
  const both = ['northline', 'clearpath'];
  const ps = [
    mk('a', 'switch', 50, []), mk('b', 'switch', 50, both), mk('c', 'switch', 200, []),
    mk('d', 'stay', 400, both), mk('e', 'stay', 400, both), mk('f', 'stay', 400, both),
    mk('g', null, 0, both),
  ];
  const during = E.projector(ps, sec(500));
  assert.strictEqual(during.counts.stillDeciding, 1);
  const after = E.projector(ps, sec(600));
  assert.deepStrictEqual(after.counts, { switched: 3, stayed: 3, noDecision: 1, stillDeciding: 0 });
  assert.strictEqual(after.byReport[1].switch, 2);
  assert.strictEqual(after.byReport[8].stay, 3);
  assert.strictEqual(after.openedBothPct.switched, 33);
  assert.strictEqual(after.openedBothPct.stayed, 100);
  assert.strictEqual(after.openedBothPct.noDecision, null);
  assert.strictEqual(after.openedBothPct.overall, 71);
  const s = JSON.stringify(after);
  assert.ok(!s.includes('secret reason text'));
  ['"a"', '"b"', 'participantId'].forEach(x => assert.ok(!s.includes(x)));
});

// ---- Build gate: real config passes, every rule catches a planted violation
t('gate ignores ordinary numbers after a lowercase word', () => {
  const c = clone(cfg); c.reports[0].text += ' Budget moved to 2026 figures.';
  assert.deepStrictEqual(checkConfig(c), []);
});
t('real config passes the gate', () => assert.deepStrictEqual(checkConfig(cfg), []));
const planted = [
  ['retired id', c => { c.sim.id = 'rapid-03-bench'; c.sim.number = 3; }, /retired/],
  ['id/number mismatch', c => { c.sim.number = 7; }, /does not match sim.number/],
  ['missing mode', c => { c.modes = ['individual']; }, /modes/],
  ['report order', c => { c.reports[3].atSeconds = 10; }, /does not arrive after/],
  ['report past clock', c => { c.reports[11].atSeconds = 600; }, /after the clock/],
  ['placeholder', c => { c.reports[2].text = 'TODO write this'; }, /placeholder/],
  ['banned word', c => { c.briefing[0] += ' We leverage two providers.'; }, /banned/],
  ['weekday', c => { c.reports[0].text = 'Tuesday morning, payments down.'; }, /weekday/],
  ['course code', c => { c.sim.teaches += ' (MIS 3000)'; }, /course/],
  ['course code with space', c => { c.reports[0].text += ' See MIS 3000.'; }, /course/],
  ['walkthrough gives the answer', c => { c.walkthrough[3].text.push('Look for Meridian.'); }, /walkthrough screen 4 names/],
  ['debrief out of order', c => { c.debrief.reverse(); }, /Disagreement/],
  ['answer in briefing', c => { c.briefing[1] += ' Both use Meridian.'; }, /gives the answer away/],
  ['dependency missing from a document', c => { c.documents[1].blocks[2].text = 'Regional traffic carried over our own backhaul.'; }, /clearpath has no highlighted line/],
  ['reveal template token', c => { c.reveal.decisionLines.stay = 'You stayed.'; }, /missing \{n\}/],
];
planted.forEach(([name, mut, re]) => t(`gate catches ${name}`, () => {
  const c = clone(cfg); mut(c);
  const errs = checkConfig(c);
  assert.ok(errs.some(e => re.test(e)), `expected ${re}, got ${JSON.stringify(errs)}`);
}));

t('gate catches deploymentEnabled false', () => assert.ok(checkVercel({ git: { deploymentEnabled: false } }).length === 1));
t('real vercel.json passes', () => assert.deepStrictEqual(checkVercel(require('../vercel.json')), []));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
