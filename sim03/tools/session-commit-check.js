const assert = require('assert');
const store = require('../lib/store.js');
const handler = require('../api/session.js');

const originalStore = {
  configured: store.configured,
  getSession: store.getSession,
  getParticipants: store.getParticipants,
  getRuns: store.getRuns,
  setRun: store.setRun
};

const sessions = new Map();
const participants = new Map();
const runs = new Map();
const code = 'ABCDE';
const pid = 'p1';
const rid = `individual:${pid}`;

sessions.set(code, {
  code,
  owner: 'Instructor',
  mode: 'individual',
  state: 'running',
  paused: false,
  thresholds: {},
  createdAt: Date.now()
});
participants.set(code, {
  [pid]: { id: pid, name: 'Student', groupId: rid, isCaptain: true, joinedAt: Date.now() }
});
runs.set(code, {});

store.configured = () => true;
store.getSession = async c => sessions.get(c) || null;
store.getParticipants = async c => participants.get(c) || {};
store.getRuns = async c => runs.get(c) || {};
store.setRun = async (c, id, value) => {
  const all = runs.get(c) || {};
  all[id] = { ...value };
  runs.set(c, all);
};

async function invoke(body) {
  const req = { method: 'POST', headers: {}, body };
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

const y1a = { run: 3, uptime: 2, capacity: 1, connect: 2, features: 1 };
const y1b = { run: 3, uptime: 1, capacity: 2, connect: 2, features: 1 };
const y2a = { run: 3, uptime: 1, capacity: 1, connect: 2, features: 2 };
const y2b = { run: 3, uptime: 2, capacity: 1, connect: 1, features: 2 };

(async () => {
  try {
    let r = await invoke({ action: 'submit', code, participantId: pid, strategicView: 'Become a service business.' });
    assert.equal(r.status, 200);

    r = await invoke({ action: 'submit', code, participantId: pid, strategicView: 'Rewrite history.' });
    assert.equal(r.status, 409);
    assert.equal(r.body.error, 'strategic_view_locked');

    r = await invoke({ action: 'submit', code, participantId: pid, year1: y1a });
    assert.equal(r.status, 200);

    r = await invoke({ action: 'submit', code, participantId: pid, year1: y1b });
    assert.equal(r.status, 409);
    assert.equal(r.body.error, 'year1_locked');

    r = await invoke({ action: 'submit', code, participantId: pid, year1: y1a });
    assert.equal(r.status, 200, 'repeating the same committed allocation should be idempotent');

    r = await invoke({ action: 'submit', code, participantId: pid, year2: y2a });
    assert.equal(r.status, 200);

    r = await invoke({ action: 'submit', code, participantId: pid, year2: y2b });
    assert.equal(r.status, 409);
    assert.equal(r.body.error, 'year2_locked');

    r = await invoke({ action: 'submit', code, participantId: pid, reflection1: 'A', reflection2: 'B', done: true });
    assert.equal(r.status, 200);

    r = await invoke({ action: 'submit', code, participantId: pid, reflection1: 'Changed after completion' });
    assert.equal(r.status, 409);
    assert.equal(r.body.error, 'run_already_completed');

    console.log('RapidSim 03 committed-decision checks passed.');
  } finally {
    Object.assign(store, originalStore);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
