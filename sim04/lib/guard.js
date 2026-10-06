'use strict';
const { verifyLaunch } = require('./launch');

function body(req) {
  if (typeof req.body === 'string') { try { return JSON.parse(req.body) || {}; } catch { return {}; } }
  return req.body && typeof req.body === 'object' ? req.body : {};
}
function access(req, b) {
  const lt = req.headers?.['x-launch-token'] || b?.launchToken;
  if (lt) {
    const p = verifyLaunch(String(lt));
    return p && p.sub && ['student', 'faculty', 'faculty_preview'].includes(p.role)
      ? { platform: true, id: `platform:${p.sub}`, name: p.name || 'Participant', email: p.email || null, courseId: p.course || null, role: p.role, mode: p.mode }
      : null;
  }
  return process.env.ACCESS_CODE && req.headers?.['x-access-code'] === process.env.ACCESS_CODE
    ? { platform: false } : null;
}
function faculty(req, b) {
  const p = access(req, b);
  if (p?.platform) return ['faculty', 'faculty_preview'].includes(p.role) ? p : null;
  const given = String(b.facultyCode || req.headers?.['x-faculty-code'] || '').trim();
  if (!given) return null;
  // Personal codes only, as "Name:code" pairs. A shared FACULTY_CODE is not
  // accepted: every room belongs to the one code that created it.
  const matched = facultyCodes().find(entry => entry.code === given);
  return matched ? { platform: false, name: matched.name, key: keyOf(matched.code) } : null;
}
function facultyCodes() {
  return String(process.env.FACULTY_CODES || '').split(',').map(s => s.trim()).filter(Boolean)
    .map(entry => ({ name: entry.slice(0, entry.lastIndexOf(':')).trim() || 'Instructor',
      code: entry.slice(entry.lastIndexOf(':') + 1).trim() }))
    .filter(entry => entry.code.length >= 6);
}
function keyOf(code) {
  return require('node:crypto').createHash('sha256').update('sim04-owner:' + code).digest('hex');
}
function owns(who, session) {
  if (!who || who.platform !== session.platformAuth) return false;
  if (session.platformAuth) return session.ownerId === who.id && (!session.courseId || session.courseId === who.courseId);
  return !!session.ownerKey && session.ownerKey === who.key;
}
function participant(req, b, session) {
  // A direct-route practice room is played by its owner with their faculty code.
  if (session.practice && !session.platformAuth) {
    const f = faculty(req, b);
    if (!f || !owns(f, session)) return null;
    const id = String(b.participantId || '');
    return { platform: false, id: session.participants[id] ? id : null };
  }
  const p = access(req, b);
  if (!p || p.platform !== session.platformAuth) return null;
  if (session.platformAuth && session.courseId && p.courseId !== session.courseId) return null;
  if (p.platform) return p;
  const id = String(b.participantId || '');
  return id && session.participants[id] ? { ...p, id } : { ...p, id: null };
}
module.exports = { body, access, faculty, owns, participant, facultyCodes };
