'use strict';
const { verifyLaunch } = require('./launch');
const crypto = require('crypto');
const C = require('../data/config');

function launchFor(req, b = {}) {
  const p = verifyLaunch(String(req.headers['x-launch-token'] || b.launchToken || ''));
  return p && p.sim === C.id && typeof p.sub === 'string' && p.sub &&
    ['student', 'faculty', 'faculty_preview'].includes(p.role) ? p : null;
}

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}

// FACULTY_CODES = "Name:code,Name2:code2". A platform launch with a faculty role also counts.
function faculty(req, b) {
  const lt = launchFor(req, b);
  if (lt && ['faculty', 'faculty_preview'].includes(lt.role)) {
    return { name: lt.name || 'Faculty', launch: lt, owner: { sub: lt.sub, course: lt.course || null } };
  }
  if (req.headers['x-launch-token'] || b.launchToken) return null;
  const code = String(req.headers['x-faculty-code'] || '');
  if (code) {
    for (const pair of String(process.env.FACULTY_CODES || '').split(',')) {
      const i = pair.lastIndexOf(':');
      if (i > 0 && pair.slice(i + 1).trim() === code) return { name: pair.slice(0, i).trim(), owner: { codeHash: crypto.createHash('sha256').update(code).digest('hex') } };
    }
  }
  return null;
}

// Students enter with a platform launch token, or the shared ACCESS_CODE for standalone runs.
function entrant(req, b) {
  const lt = launchFor(req, b);
  if (lt) return { launch: lt };
  if (req.headers['x-launch-token'] || b.launchToken) return null;
  const required = process.env.ACCESS_CODE;
  if (required && req.headers['x-access-code'] === required) return { launch: null };
  return null;
}

function owns(sess, who) {
  return !!sess.owner && JSON.stringify(sess.owner) === JSON.stringify(who.owner);
}

function participant(req, b, sess, me) {
  if (!me || me.key !== String(req.headers['x-participant-key'] || b.participantKey || '')) return false;
  const launch = launchFor(req, b);
  if (me.launch) return !!launch && launch.sub === me.launch.sub &&
    (launch.course || null) === (me.launch.course || null) && (!sess.courseId || launch.course === sess.courseId);
  return !sess.platformAuth && !(req.headers['x-launch-token'] || b.launchToken);
}

module.exports = { body, faculty, entrant, launchFor, owns, participant };
