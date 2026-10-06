const copy = x => x == null ? x : structuredClone(x);
const same = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);
function installRosterTransactions(store, sessions, participants) {
  store.compareAndSetSession = async (code, previous, next) => {
    if (!same(sessions.get(code), previous)) return false;
    sessions.set(code, copy(next)); return true;
  };
  store.ensureParticipants = async (code, people, session) => {
    if (!same(sessions.get(code), session)) return -1;
    const all = participants.get(code) || {}; let added = 0;
    for (const p of people) if (!all[p.id]) { all[p.id] = copy(p); added++; }
    participants.set(code, all); return added;
  };
  store.compareAndSetParticipant = async (code, id, previous, next, session) => {
    const all = participants.get(code) || {};
    if (!same(sessions.get(code), session) || !same(all[id], previous)) return false;
    all[id] = copy(next); participants.set(code, all); return true;
  };
  store.compareAndSetRoster = async (code, previous, next, session) => {
    if (!same(sessions.get(code), session) || !same(participants.get(code) || {}, previous)) return false;
    participants.set(code, copy(next)); return true;
  };
}
module.exports = { installRosterTransactions };
