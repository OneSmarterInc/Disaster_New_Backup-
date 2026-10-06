// Team leadership and simulation control are separate. There is one runner ID
// on the shared run, never one independently writable flag per participant.
function membersOf(participants, groupId) {
  return Object.values(participants).filter(p => p && groupId && p.groupId === groupId);
}
function leadOf(participants, groupId) {
  return membersOf(participants, groupId).filter(p => p.isCaptain)
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0) || a.id.localeCompare(b.id))[0] || null;
}
function runnerOf(participants, groupId, run) {
  const selected = run && participants[run.runnerId];
  if (selected && groupId && selected.groupId === groupId) return selected;
  return leadOf(participants, groupId);
}
function revisionOf(run) { return Number(run && run.runnerRevision) || 0; }
function screenOf(run) {
  if (!run) return 0;
  if (Number.isInteger(run.screen)) return run.screen;
  if (Number(run.phase) >= 3) return 10;
  return run.year2 ? 7 : run.year1 ? 5 : run.strategicView ? 4 : 0;
}
module.exports = { membersOf, leadOf, runnerOf, revisionOf, screenOf };
