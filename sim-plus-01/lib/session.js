'use strict';

const { Session } = require('../src/engine');

function serialize(session) {
  return {
    order: session.order,
    windowIndex: session.windowIndex,
    remaining: session.remaining,
    posture: session.posture,
    askCounts: [...session.askCounts],
    transcript: session.transcript,
    submission: session.submission || null,
    completedChart: session.completedChart || null,
    observationSeconds: session.observationSeconds ?? null,
    launch: session.launch || null
  };
}

function hydrate(raw) {
  const s = new Session();
  s.order = raw.order || null;
  s.windowIndex = Number(raw.windowIndex || 0);
  s.remaining = Number.isFinite(raw.remaining) ? raw.remaining : 900;
  s.posture = raw.posture || s.posture;
  s.askCounts = new Map(raw.askCounts || []);
  s.transcript = raw.transcript || [];
  s.submission = raw.submission || null;
  s.completedChart = raw.completedChart || null;
  s.observationSeconds = raw.observationSeconds ?? null;
  s.launch = raw.launch || null;
  return s;
}

module.exports = { serialize, hydrate };
