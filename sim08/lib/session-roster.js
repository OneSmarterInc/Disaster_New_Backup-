// Import the approved COURSE roster into one authenticated TEAM session.
// Approval, team assignment and actual attendance remain separate concepts.
const { courseEnrolments } = require('./course-enrolments.js');
const store = require('./store.js');

async function syncCourseRoster(req, body, session) {
  const roster = await courseEnrolments(req, body, session);
  if (!roster.available || session.mode !== 'team' || session.state === 'closed') return roster;
  const seen = new Set();
  const approved = roster.students.filter(student => {
    if (student.accessReleased !== true) return false;
    const id = String(student.participantId || '');
    if (!/^platform:[A-Za-z0-9_-]+$/.test(id) || !String(student.name || '').trim()) {
      const error = new Error('The course returned an invalid student record. No students were imported.');
      error.status = 503; throw error;
    }
    if (seen.has(id)) return false;
    seen.add(id); return true;
  });
  const addedAt = Date.now();
  const records = approved.map(student => ({
    id: student.participantId, name: String(student.name).trim().slice(0, 60),
    groupId: null, teamLabel: '', isCaptain: false,
    source: 'course', addedAt, joinedAt: null
  }));
  // HSETNX inside one transaction: repeats and concurrent joins never overwrite
  // a saved group, runner, attendance marker or completed result.
  const added = await store.ensureParticipants(session.code, records, session);
  if (added < 0) {
    const error = new Error('The session changed while students were refreshed. Please refresh again.');
    error.status = 409; throw error;
  }
  return { ...roster, added };
}

function approvedIds(roster) {
  return roster?.available ? new Set(roster.students.filter(p => p.accessReleased === true).map(p => p.participantId)) : null;
}

module.exports = { syncCourseRoster, approvedIds };
