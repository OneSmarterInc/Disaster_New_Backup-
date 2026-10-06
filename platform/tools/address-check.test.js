const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { scan } = require('./address-check.js');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'address-guard-'));
const write = (file, content) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
};
const entry = "location.replace('https://rapidsims.flexee.org/open.html?' + entry.toString());";
try {
  write('sim07/public/index.html', entry);
  write('sim05/public/launch.html', entry.replaceAll("'", '"'));
  write('simplus02/public/index.html', entry);
  write('simplus02/public/console.html', entry);
  write('sim04/test/invitation.test.js', "const fixture = 'https://fixture.vercel.app';");
  write('sim08/tools/platform-launch-check.js', "const fixture = 'https://fixture.vercel.app';");
  write('tools/test-entry-flow.js', "const fixture = 'https://fixture.flexee.org';");
  assert.deepEqual(scan(root), [], 'canonical account entry and test fixtures are allowed');

  write('platform/public/invite.js', "const invitation = 'https://old.vercel.app/join';");
  write('sim05/public/client.js', "fetch('https://old.flexee.org/api/session');");
  write('sim07/public/index.html', entry + " const invite = 'https://old.vercel.app/join';");
  write('sim08/public/launch.html', entry.replace('rapidsims.flexee.org', 'old.vercel.app'));
  write('platform/public/open.js', entry);
  const violations = scan(root);
  assert.equal(violations.length, 5, 'hard-coded app addresses still fail the guard');
  for (const file of ['platform/public/invite.js', 'sim05/public/client.js', 'sim07/public/index.html', 'sim08/public/launch.html', 'platform/public/open.js']) {
    assert.ok(violations.some(v => v.startsWith(file + ':')), file + ' is rejected');
  }
  console.log('PASS address guard: canonical sign-in, fixtures, app links and invitation regressions');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
