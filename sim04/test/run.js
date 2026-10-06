'use strict';
const { spawnSync } = require('node:child_process');
for (const file of ['gate-data.test.js', 'flow.test.js', 'access-ui.test.js', 'platform-launch.test.js',
  'platform-invite.test.js', 'store-course-index.test.js', 'course-session-ui.test.js', 'room-fill.test.js',
  'private-check-ui.test.js', 'faculty-entry-ui.test.js']) {
  const result = spawnSync(process.execPath, [require('node:path').join(__dirname, file)], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
