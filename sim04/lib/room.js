'use strict';
// Classroom room rules for Sim-04.
// Students join with an email and wait in Unassigned. The instructor sets a
// group size, divides randomly, and moves people between groups. Only the
// instructor's Start begins the clock. Any number of groups may play, even one;
// the projector fills unused definitions with labelled, engine-computed examples.
const config = require('../data/config');
const sheets = require('../data/sheets');
const engine = require('../engine/retention');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const shortName = email => String(email || '').split('@')[0].slice(0, 40) || 'participant';

function createSession({ code, owner, ownerKey = null, mode, groupSize, clockMinutes = config.clockMinutes, name, now }) {
  if (!['team', 'individual'].includes(mode)) throw new Error('Choose team or individual mode.');
  if (!Number.isSafeInteger(clockMinutes) || clockMinutes < 1 || clockMinutes > 120) {
    throw new Error('Clock minutes must be between 1 and 120.');
  }
  const size = mode === 'individual' ? 1 : checkSize(groupSize ?? config.defaultGroupSize);
  return {
    code, name: String(name || 'Whose Number Is Right?').slice(0, 80),
    owner, ownerKey, mode, groupSize: size, clockMinutes, createdAt: now,
    state: 'lobby', stage: 0, startedAt: null, nextSlot: 1,
    slots: [], participants: {}
  };
}
function checkSize(n) {
  const size = Number(n);
  if (!Number.isSafeInteger(size) || size < 1 || size > 50) throw new Error('Group size must be a whole number from 1 to 50.');
  return size;
}

function deadline(session) { return session.startedAt + session.clockMinutes * 60000; }
function secondsLeft(session, now) {
  return session.startedAt ? Math.max(0, Math.ceil((deadline(session) - now) / 1000)) : null;
}
function allLocked(session, now) {
  return !!session.startedAt && (now >= deadline(session) || session.slots.every(s => s.commit));
}
function clock(session, now) {
  const remaining = secondsLeft(session, now);
  return {
    remaining, warning: remaining !== null && remaining > 0 && remaining <= config.warningMinutes * 60,
    expired: remaining === 0, running: !!session.startedAt && remaining > 0 && session.stage === 0
  };
}
function slotFor(session, id) {
  const p = session.participants[id];
  return p && session.slots.find(s => s.id === p.slotId && s.memberIds.includes(id));
}
function newSlot(session) {
  const n = session.nextSlot++;
  const slot = { id: `slot-${n}`, label: `${session.mode === 'team' ? 'Team' : 'Participant'} ${n}`, sheetId: null, memberIds: [], commit: null };
  session.slots.push(slot);
  return slot;
}

function join(session, id, email, now) {
  if (session.stage === 3) throw new Error('The session is complete.');
  const clean = String(email || '').trim().toLowerCase().slice(0, 120);
  if (!EMAIL.test(clean)) throw new Error('Enter your email address.');
  const next = structuredClone(session);
  if (next.participants[id]) { next.participants[id].joinedAt ||= now; return next; }
  if (Object.values(next.participants).some(p => p.email === clean)) {
    throw new Error('This email has already joined this room. Continue in the browser you joined from.');
  }
  next.participants[id] = { id, email: clean, name: shortName(clean), joinedAt: now, slotId: null, reportedAt: null };
  return next;
}

// Random division, before the clock only. Sizes differ by at most one and none
// is larger than the chosen size: 23 people in groups of 4 make 4,4,4,4,4,3.
function divide(session, groupSize, random = Math.random) {
  if (session.state !== 'lobby') throw new Error('Groups can only be divided before the clock starts.');
  const size = session.mode === 'individual' ? 1 : checkSize(groupSize ?? session.groupSize);
  const ids = Object.keys(session.participants);
  if (!ids.length) throw new Error('Nobody has joined yet.');
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const next = structuredClone(session);
  next.groupSize = size; next.slots = []; next.nextSlot = 1;
  const count = Math.ceil(ids.length / size);
  for (let i = 0; i < count; i++) newSlot(next);
  ids.forEach((id, i) => { const s = next.slots[i % count]; s.memberIds.push(id); next.participants[id].slotId = s.id; });
  return next;
}

// Move one person. target is a slot id, 'unassigned' or 'new'.
// After the clock starts, only an unassigned (late) person may be placed, so
// nobody who has seen one definition is ever shown another.
function move(session, participantId, target) {
  const p = session.participants[participantId];
  if (!p) throw new Error('Choose a joined participant.');
  if (session.stage > 0 || session.state === 'complete') throw new Error('Groups are fixed once the numbers are shown.');
  const started = session.state !== 'lobby';
  if (started && (p.slotId || target === 'unassigned' || target === 'new')) {
    throw new Error('After the clock starts, you can only place someone who has not been in a group.');
  }
  const next = structuredClone(session);
  for (const s of next.slots) s.memberIds = s.memberIds.filter(id => id !== participantId);
  let slot = null;
  if (target === 'new') slot = newSlot(next);
  else if (target !== 'unassigned') {
    slot = next.slots.find(s => s.id === target);
    if (!slot) throw new Error('That group no longer exists.');
  }
  if (slot) slot.memberIds.push(participantId);
  next.participants[participantId].slotId = slot ? slot.id : null;
  if (!started) next.slots = next.slots.filter(s => s.memberIds.length || s === slot);
  return next;
}
function rename(session, slotId, label) {
  const next = structuredClone(session);
  const s = next.slots.find(x => x.id === slotId);
  if (!s) throw new Error('That group no longer exists.');
  s.label = String(label || '').trim().slice(0, 40) || s.label;
  return next;
}

// Empty groups are dropped and sheets go out in the spread-first order.
// One filled group is enough. Unassigned people may still be placed later.
function start(session, now) {
  if (session.state !== 'lobby') throw new Error('The session has already started.');
  const filled = session.slots.filter(s => s.memberIds.length);
  if (!filled.length) throw new Error('Put at least one person in a group before starting.');
  const assignment = engine.assignSheets(filled.length);
  const slots = filled.map((s, i) => ({ ...s, sheetId: assignment[i] }));
  return { ...session, slots, state: 'running', startedAt: now };
}

function commit(session, participantId, number, confidence, now) {
  const slot = slotFor(session, participantId);
  if (!slot) throw new Error('Wait for your instructor to put you in a group.');
  if (session.stage !== 0 || !session.startedAt || now >= deadline(session)) throw new Error('The number is locked.');
  if (slot.commit) throw new Error('This group has already committed its number.');
  const n = Number(number);
  if (number === '' || number === null || !Number.isFinite(n) || n < 0 || n > 100 || Math.abs(n * 10 - Math.round(n * 10)) > 1e-8) {
    throw new Error('Enter a percentage from 0.0 to 100.0, to one decimal place.');
  }
  if (!Number.isInteger(Number(confidence)) || Number(confidence) < 1 || Number(confidence) > 5) {
    throw new Error('Choose a confidence rating from 1 to 5.');
  }
  const next = structuredClone(session);
  next.slots.find(s => s.id === slot.id).commit = { number: n, confidence: Number(confidence), at: now };
  return next;
}
function advance(session, now) {
  if (session.stage === 0 && !allLocked(session, now)) throw new Error('Wait until every group commits or the clock reaches zero.');
  if (session.stage >= 3 || !session.startedAt) throw new Error('No further stage is available.');
  const next = { ...session, stage: session.stage + 1 };
  if (next.stage === 3) next.state = 'complete';
  return next;
}

function studentView(session, participantId, now) {
  const slot = slotFor(session, participantId);
  const p = session.participants[participantId];
  if (!p) throw new Error('Join the session first.');
  const started = session.state !== 'lobby';
  return {
    state: session.state, mode: session.mode, stage: session.stage, you: p.name, practice: !!session.practice,
    group: slot ? slot.label : null,
    groupmates: slot ? slot.memberIds.filter(id => id !== participantId).map(id => session.participants[id].name) : [],
    clockMinutes: session.clockMinutes,
    clock: clock(session, now),
    // No sheet before the clock starts, and none for anyone not yet in a group.
    data: slot && started ? engine.studentPayload(slot.sheetId) : null,
    commit: slot ? slot.commit && { number: slot.commit.number.toFixed(1), confidence: slot.commit.confidence } : null,
    canCommit: !!slot && session.stage === 0 && started && now < deadline(session) && !slot.commit
  };
}

// The faculty screen is projected, so it carries short names only (the part of
// the email before the @). Full emails appear only on the private check.
function console_(session, now) {
  const c = clock(session, now);
  const people = Object.values(session.participants);
  const base = {
    session: { code: session.code, name: session.name, mode: session.mode, groupSize: session.groupSize,
      state: session.state, stage: session.stage, clockMinutes: session.clockMinutes },
    clock: c,
    unassigned: people.filter(p => !p.slotId).map(p => ({ id: p.id, name: p.name })),
    groups: session.slots.map(s => ({ id: s.id, label: s.label,
      members: s.memberIds.map(id => ({ id, name: session.participants[id].name })),
      committed: !!s.commit, locked: !!s.commit || c.expired }))
  };
  if (session.stage >= 1) {
    const used = new Set(session.slots.map(s => s.sheetId));
    base.numbers = [
      ...session.slots.map(s => ({ id: s.id, label: s.label, example: false,
        number: s.commit ? s.commit.number.toFixed(1) : null, confidence: s.commit?.confidence || null })),
      ...config.assignmentOrder.filter(id => !used.has(id)).map(id => ({ id: 'example-' + id,
        label: `Example: ${sheets.reveal[id].department}`, example: true,
        number: engine.compute(id).value.toFixed(1), confidence: null }))
    ];
  }
  if (session.stage >= 2) {
    base.reveal = config.assignmentOrder.map(sheetId => {
      const groups = session.slots.filter(s => s.sheetId === sheetId).map(s => ({
        id: s.id, label: s.label, number: s.commit ? s.commit.number.toFixed(1) : null }));
      return { sheetId, lines: sheets.sheetLines(sheetId), contestedIndex: 3,
        department: sheets.reveal[sheetId].department, purpose: sheets.reveal[sheetId].purpose,
        derivation: engine.derivation(sheetId), example: !groups.length, groups,
        exampleNumber: groups.length ? null : engine.compute(sheetId).value.toFixed(1) };
    });
  }
  return base;
}
function privateCheck(session) {
  return {
    groups: session.slots.map(s => ({
      label: s.label, members: s.memberIds.map(id => session.participants[id].email),
      number: s.commit ? s.commit.number.toFixed(1) : null,
      ...(s.sheetId ? engine.checkCommit(s.sheetId, s.commit?.number ?? null) : { status: 'not_started' })
    })),
    unassigned: Object.values(session.participants).filter(p => !p.slotId).map(p => p.email)
  };
}
module.exports = { createSession, deadline, allLocked, clock, slotFor, join, divide, move, rename, start,
  commit, advance, studentView, projector: console_, privateCheck, shortName };
