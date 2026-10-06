#!/usr/bin/env node
// Does every simulation actually speak the platform's protocol?
//
// The platform has no hardcoded knowledge of any sim — publishing, assigning to
// a course, student visibility and completion reporting are all driven from the
// database, so a sim that registers correctly gets every one of those flows for
// free. That is a good design and it has one consequence worth defending: the
// entire integration rests on four signed messages, and if any of them is wrong
// the failure is silent. A sim that cannot report completions still plays
// perfectly. Faculty just never see that anyone finished.
//
// So this walks the four hops for each sim without touching a database:
//
//   register  sim -> platform    puts it in the catalogue
//   launch    platform -> sim    carries who is playing and in which course
//   complete  sim -> platform    what faculty see on their roster
//   mismatch  a wrong secret must be refused, or none of the above means anything

const path = require('path');

const SIMS = [
  { dir: 'sim',    name: 'RapidSim 01' },
  { dir: 'sim-02', name: 'RapidSim 02' },
  { dir: 'sim03', name: 'RapidSim 03 — Midland' },
  { dir: 'sim-plus-01', name: 'RapidSim+ 01 — Wexford' }
];

const root = path.join(__dirname, '..', '..');
let bad = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) bad++; };

const fresh = (p) => { delete require.cache[require.resolve(p)]; return require(p); };

for (const { dir, name } of SIMS) {
  console.log(`\n${name} (${dir}/)`);

  process.env.LAUNCH_SECRET = 'shared-test-secret';
  const platform = fresh(path.join(root, 'platform', 'lib', 'launch.js'));
  const sim = fresh(path.join(root, dir, 'lib', 'launch.js'));
  const S = require(path.join(root, dir, 'lib', dir === 'sim-plus-01' ? 'meta.js' : 'scenario.js'));

  // 1. Registration — how it reaches the catalogue and the admin list at all.
  const reg = sim.signBack({
    kind: 'register', sim: S.META.id, title: S.META.title,
    minutes: S.META.minutes, launchUrl: 'https://example.invalid',
    detail: S.META.detail, iat: Date.now(), exp: Date.now() + 60000
  });
  const gotReg = reg && platform.verify(reg);
  ok(!!gotReg, 'the platform verifies its registration');
  ok(gotReg && gotReg.sim === S.META.id, 'registration carries the sim id the catalogue keys on');
  ok(!!(S.META.title && S.META.minutes), 'META has the fields registration stores');

  // 2. Launch — a student arriving from a course.
  const lt = platform.sign({
    sub: 'usr_test', sim: S.META.id, course: 'crs_test', role: 'student',
    iat: Date.now(), exp: Date.now() + 300000
  });
  const accepted = lt && sim.verifyLaunch(lt);
  ok(!!accepted, 'the sim accepts a launch signed by the platform');
  ok(accepted && accepted.sub === 'usr_test', 'the sim learns who is playing');
  ok(accepted && accepted.course === 'crs_test',
     'the sim learns the course, without which a completion cannot reach faculty');

  // 3. Completion — what appears on a faculty roster.
  const done = sim.signBack({
    sub: 'usr_test', sim: S.META.id, course: 'crs_test', duration: 640,
    summary: 'test', metrics: { verdict: 'test' },
    iat: Date.now(), exp: Date.now() + 300000
  });
  const gotDone = done && platform.verify(done);
  ok(!!gotDone, 'the platform verifies the completion it sends back');
  ok(gotDone && gotDone.sub && gotDone.sim, 'the completion has what /api/complete requires');
  ok(gotDone && gotDone.course === 'crs_test', 'the completion is attributed to the course');

  // 4. The negative case. Without this the three above prove nothing.
  process.env.LAUNCH_SECRET = 'a-different-secret';
  const sim2 = fresh(path.join(root, dir, 'lib', 'launch.js'));
  ok(!sim2.verifyLaunch(lt), 'a launch signed with a different secret is refused');
}

// The platform must route every sim it can launch, or a published sim sends
// students to a 404 on the platform's own domain.
console.log('\nrouting');
const cfg = require(path.join(root, 'platform', 'vercel.json'));
for (const n of ['sim01', 'sim02', 'sim03', 'simplus01']) {
  const routed = cfg.rewrites.filter(r => r.source.startsWith('/' + n));
  ok(routed.length >= 2, `/${n} is routed`);
  // A registered address ending in "/" produces launch links at /simNN/ ,
  // which is a different path and matched nothing. A student clicking through
  // from a course got a 404 while the sim itself was perfectly healthy.
  ok(routed.some(r => r.source === '/' + n + '/'),
     `/${n}/ with a trailing slash is routed`);
  ok(routed.every(r => /^https:\/\/[a-z0-9.-]+\//.test(r.destination)),
     `/${n} points at a real address`);
  ok(cfg.headers.some(h => h.source.startsWith('/' + n)), `/${n} carries the noindex header`);
}

// The launch URL a student actually clicks. This is where the trailing slash
// came from, and it is worth asserting rather than eyeballing.
console.log('\nlaunch links');
const buildUrl = (stored) => stored.replace(/\/+$/, '') + '#lt=TOKEN';
for (const stored of ['https://rapidsims.flexee.org/sim03',
                      'https://rapidsims.flexee.org/sim03/']) {
  const url = buildUrl(stored);
  ok(!url.includes('/#'), `no slash before the fragment for ${stored}`);
  const routePath = url.split('#')[0].replace('https://rapidsims.flexee.org', '');
  ok(cfg.rewrites.some(r => r.source === routePath),
     `the resulting path ${routePath} matches a rewrite exactly`);
}

console.log(bad ? `\n${bad} failed\n` : '\nall sims speak the platform protocol\n');
process.exit(bad ? 1 : 0);
