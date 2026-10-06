const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const script = path.join(__dirname, 'team-runner-browser-check.js');
for (const absent of ['redis', 'playwright']) {
  for (const required of [false, true]) {
    const code = `
      const Module = require('node:module');
      const original = Module._resolveFilename;
      Module._resolveFilename = function(name, ...args) {
        if (name === ${JSON.stringify(absent)}) {
          const error = new Error('deliberately absent test prerequisite');
          error.code = 'MODULE_NOT_FOUND'; throw error;
        }
        // Mark the other browser prerequisite resolvable; it must not be loaded
        // after the preflight has already found an absent prerequisite.
        if (name === 'playwright' || name === 'redis') return ${JSON.stringify(script)};
        return original.call(this, name, ...args);
      };
      process.env.AGENT_BROWSER_BIN = ${JSON.stringify(script)};
      process.env.SIM03_BROWSER_REQUIRED = ${JSON.stringify(required ? '1' : '0')};
      require(${JSON.stringify(script)});
    `;
    const result = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8', timeout: 10000 });
    assert.ifError(result.error);
    assert.equal(result.status, required ? 1 : 0);
    const output = result.stdout + result.stderr;
    assert.ok(output.includes(`${required ? 'FAIL' : 'SKIP'}: RapidSim 03 browser/Redis check NOT RUN`));
    assert.ok(output.includes(`missing npm package ${absent}`));
    assert.equal(output.includes('BROWSER_REDIS_TEST_PASSED'), false);
    assert.equal(output.includes('Cannot find module'), false);
  }
}
console.log('RapidSim 03 browser preflight checks passed (missing Redis/Playwright skips locally and fails the required CI gate).');
