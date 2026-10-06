const assert = require('assert');
const store = require('../lib/store.js');
const handler = require('../api/session.js');
const { createHmac } = require('node:crypto');

// Test-only implementation of the documented platform wire format. Keep this
// independent of the sim's verifier so a verifier defect cannot sign its own
// passing fixture. The real platform integration checks remain in platform/.
function launchToken({ userId, name, role, simId, mode, minutes = 60 }) {
  const now = Date.now();
  const payload = { sub: userId, name, role, sim: simId, mode: mode || 'play',
    course: null, iat: now, exp: now + minutes * 60000 };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', process.env.LAUNCH_SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

const originalEnv = {
  FACULTY_CODES: process.env.FACULTY_CODES,
  FACULTY_CODE: process.env.FACULTY_CODE,
  LAUNCH_SECRET: process.env.LAUNCH_SECRET
};
const originalStore = {
  configured: store.configured,
  putSession: store.putSession,
  getSession: store.getSession,
  getParticipants: store.getParticipants,
  getRuns: store.getRuns,
  setParticipant: store.setParticipant,
  addParticipant: store.addParticipant,
  setRun: store.setRun
};

const sessions = new Map();
const participants = new Map();
const runs = new Map();

store.configured = () => true;
store.putSession = async (code, value) => { sessions.set(code, { ...value }); return value; };
store.getSession = async (code) => sessions.get(code) || null;
store.getParticipants = async (code) => participants.get(code) || {};
store.getRuns = async (code) => runs.get(code) || {};
store.setParticipant = async () => {};
store.addParticipant = async () => {};
store.setRun = async () => {};

async function invoke(body, headers = {}) {
  const req = { method: 'POST', headers, body };
  const res = {
    statusCode: 200,
    payload: null,
    status(n) { this.statusCode = n; return this; },
    json(payload) { this.payload = payload; return payload; },
    end() { return null; }
  };
  await handler(req, res);
  return { status: res.statusCode, body: res.payload };
}

(async () => {
  try {
    delete process.env.FACULTY_CODES;
    delete process.env.FACULTY_CODE;
    delete process.env.LAUNCH_SECRET;

    let r = await invoke({ action: 'create', name: 'Audit', mode: 'individual' });
    assert.equal(r.status, 401, 'anonymous create must fail closed when no roster is configured');
    assert.equal(r.body.error, 'faculty_authorization_required');

    process.env.LAUNCH_SECRET = 'shared-test-secret';
    const token = launchToken({
      userId: 'faculty-1', name: 'Instructor', role: 'faculty',
      simId: 'rapid-03-midland', mode: 'session', minutes: 60
    });
    r = await invoke({ action: 'create', name: 'Platform team smoke', mode: 'team' }, { 'x-launch-token': token });
    assert.equal(r.status, 200, 'signed platform faculty token should create a team session');
    assert.equal(r.body.session.mode, 'team');
    r = await invoke({ action: 'create', name: 'Platform body-token smoke', mode: 'team', launchToken: token });
    assert.equal(r.status, 200, 'instructor body fallback should accept the same signed token');
    assert.equal(r.body.session.mode, 'team');

    for (const [label, invalid] of [
      ['student role', launchToken({ userId: 'student-1', role: 'student', simId: 'rapid-03-midland' })],
      ['another simulation', launchToken({ userId: 'faculty-1', role: 'faculty', simId: 'another-sim' })],
      ['expired token', launchToken({ userId: 'faculty-1', role: 'faculty', simId: 'rapid-03-midland', minutes: -1 })],
      ['invalid signature', token + 'tampered']
    ]) {
      r = await invoke({ action: 'create', mode: 'team' }, { 'x-launch-token': invalid });
      assert.equal(r.status, 401, `${label} must not authorize a faculty session`);
    }

    delete process.env.LAUNCH_SECRET;
    process.env.FACULTY_CODES = 'Instructor:faculty-secret';

    r = await invoke({ action: 'create', name: 'Audit', mode: 'individual', facultyCode: 'wrong' });
    assert.equal(r.status, 401, 'wrong standalone faculty code must be refused');

    r = await invoke({ action: 'create', name: 'Audit', mode: 'individual', facultyCode: 'faculty-secret' });
    assert.equal(r.status, 200, 'configured standalone faculty code should work');
    const code = r.body.session.code;

    r = await invoke({ action: 'faculty_state', code });
    assert.equal(r.status, 401, 'knowing the projected session code must not expose instructor state');

    r = await invoke({ action: 'control', code, set: 'close' });
    assert.equal(r.status, 401, 'knowing the projected session code must not allow session control');

    r = await invoke({ action: 'calibrate', code, thresholds: {} });
    assert.equal(r.status, 401, 'knowing the projected session code must not allow calibration');

    console.log('RapidSim 03 faculty authorization checks passed.');
  } finally {
    for (const [k, v] of Object.entries(originalEnv)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    Object.assign(store, originalStore);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
