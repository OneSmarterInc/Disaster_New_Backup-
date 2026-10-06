'use strict';
// Sim-06 engine. Pure functions over plain state objects; storage and HTTP live elsewhere.
// All times are epoch milliseconds passed in by the caller, so tests control the clock.

const defaultConfig = require('../data/config');

function makeEngine(cfg = defaultConfig) {
  const PLAY_MS = cfg.clock.playSeconds * 1000;
  const STORY_PER_REAL_SEC = cfg.clock.storyMinutesPerRealMinute / 60; // story minutes per real second
  const [startH, startM] = cfg.clock.storyStart.split(':').map(Number);
  const DOC_IDS = cfg.documents.map(d => d.id);

  function createSession({ sessionId, mode, now }) {
    if (!cfg.modes.includes(mode)) {
      throw new Error(`mode is required and must be one of: ${cfg.modes.join(', ')}`);
    }
    return { sessionId, simId: cfg.sim.id, mode, createdAt: now };
  }

  // In team mode a "participant" is the team; the storage layer must make decide() a
  // conditional write so the first press wins.
  function createParticipant({ participantId }) {
    const docsOpened = {};
    DOC_IDS.forEach(id => { docsOpened[id] = null; });
    return { participantId, begunAt: null, docsOpened, decision: null };
  }

  function begin(p, now) {
    if (p.begunAt !== null) return p;
    return { ...p, begunAt: now };
  }

  function elapsedMs(p, now) {
    if (p.begunAt === null) return 0;
    return Math.min(Math.max(now - p.begunAt, 0), PLAY_MS);
  }

  function isOver(p, now) {
    return p.begunAt !== null && now - p.begunAt >= PLAY_MS;
  }

  function storyTime(realMs) {
    const mins = startH * 60 + startM + Math.floor((realMs / 1000) * STORY_PER_REAL_SEC);
    return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
  }

  function visibleReports(p, now) {
    if (p.begunAt === null) return [];
    const e = elapsedMs(p, now);
    return cfg.reports.filter(r => r.atSeconds * 1000 <= e);
  }

  // Documents can be opened during the briefing or during play; only the first open counts.
  function openDoc(p, docId, now) {
    if (!DOC_IDS.includes(docId)) throw new Error(`unknown document: ${docId}`);
    if (p.docsOpened[docId] !== null) return p;
    return { ...p, docsOpened: { ...p.docsOpened, [docId]: now } };
  }

  function decide(p, { choice, reason, now }) {
    if (p.begunAt === null) throw new Error('not begun');
    if (p.decision !== null) throw new Error('decision already made');
    if (isOver(p, now)) throw new Error('clock has ended');
    if (choice !== 'switch' && choice !== 'stay') throw new Error('choice must be switch or stay');
    const text = String(reason || '').trim();
    if (!text) throw new Error('reason is required');
    if (text.length > cfg.reasonMaxLength) throw new Error(`reason must be ${cfg.reasonMaxLength} characters or fewer`);
    const e = elapsedMs(p, now);
    const shown = visibleReports(p, now);
    return {
      ...p,
      decision: {
        choice,
        reason: text,
        atMs: e,
        atReport: shown.length ? shown[shown.length - 1].n : 1,
        storyTime: storyTime(e),
        docsBefore: readingAt(p, now),
      },
    };
  }

  function readingAt(p, cutoff) {
    const out = {};
    DOC_IDS.forEach(id => { out[id] = p.docsOpened[id] !== null && p.docsOpened[id] <= cutoff; });
    return out;
  }

  function outcome(p) {
    return p.decision ? p.decision.choice : 'none';
  }

  // Switch window runs from the decision for switchWindowStoryMinutes, clipped to the clock.
  function switchWindowMs(p) {
    if (!p.decision || p.decision.choice !== 'switch') return null;
    const len = (cfg.economics.switchWindowStoryMinutes / STORY_PER_REAL_SEC) * 1000;
    return { from: p.decision.atMs, to: Math.min(p.decision.atMs + len, PLAY_MS) };
  }

  function lostSoFar(p, now) {
    const e = elapsedMs(p, now);
    const storyMin = (e / 1000) * STORY_PER_REAL_SEC;
    let lost = storyMin * cfg.economics.outagePerStoryMinute;
    const w = switchWindowMs(p);
    if (w && e > w.from) {
      const inWindowMin = ((Math.min(e, w.to) - w.from) / 1000) * STORY_PER_REAL_SEC;
      lost += inWindowMin * (cfg.economics.normalPerStoryMinute - cfg.economics.outagePerStoryMinute);
    }
    return Math.round(lost);
  }

  function statusMessage(p, now) {
    const w = switchWindowMs(p);
    if (!w) return null;
    const e = elapsedMs(p, now);
    if (e < w.to) return { kind: 'switching', untilMs: w.to };
    return { kind: 'switched', text: cfg.switchCompleteMessage };
  }

  // What the student sees during play. Never includes anyone else's state.
  function studentView(p, now) {
    return {
      phase: p.begunAt === null ? 'briefing' : isOver(p, now) ? 'ended' : 'playing',
      elapsedMs: elapsedMs(p, now),
      storyTime: storyTime(elapsedMs(p, now)),
      reports: visibleReports(p, now),
      lost: lostSoFar(p, now),
      decision: p.decision ? { choice: p.decision.choice, atReport: p.decision.atReport } : null,
      status: statusMessage(p, now),
    };
  }

  function fill(tpl, vals) {
    return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in vals ? vals[k] : `{${k}}`));
  }

  function reveal(p, now) {
    if (!isOver(p, now)) throw new Error('reveal is only available after the clock ends');
    const o = outcome(p);
    const d = p.decision;
    const line = o === 'none'
      ? cfg.reveal.decisionLines.none
      : fill(cfg.reveal.decisionLines[o], { n: d.atReport, time: d.storyTime, reason: d.reason });
    const reading = d ? d.docsBefore : readingAt(p, p.begunAt + PLAY_MS);
    const w = switchWindowMs(p);
    return {
      map: cfg.reveal.map,
      caption: cfg.reveal.caption,
      documents: cfg.documents,
      decisionLine: line,
      readingLabel: o === 'none' ? cfg.reveal.readingLine.none : cfg.reveal.readingLine.decided,
      reading,
      lostTotal: lostSoFar(p, p.begunAt + PLAY_MS),
      switchWindow: w ? { fromStory: storyTime(w.from), toStory: storyTime(w.to) } : null,
    };
  }

  // Instructor projector. Aggregates only; no reason text, no identifiers.
  function projector(participants, now) {
    const states = { switch: [], stay: [], none: [], undecided: [] };
    participants.forEach(p => {
      if (p.decision) states[p.decision.choice].push(p);
      else if (isOver(p, now)) states.none.push(p);
      else states.undecided.push(p);
    });
    const byReport = cfg.reports.map(r => ({
      n: r.n,
      switch: states.switch.filter(p => p.decision.atReport === r.n).length,
      stay: states.stay.filter(p => p.decision.atReport === r.n).length,
    }));
    const openedBoth = p => {
      const rd = p.decision ? p.decision.docsBefore : readingAt(p, p.begunAt + PLAY_MS);
      return DOC_IDS.every(id => rd[id]);
    };
    const share = group => {
      if (group.length < cfg.projectorMinGroupForReading) return null;
      return Math.round((100 * group.filter(openedBoth).length) / group.length);
    };
    const settled = [...states.switch, ...states.stay, ...states.none];
    return {
      counts: {
        switched: states.switch.length,
        stayed: states.stay.length,
        noDecision: states.none.length,
        stillDeciding: states.undecided.length,
      },
      byReport,
      openedBothPct: {
        overall: share(settled),
        switched: share(states.switch),
        stayed: share(states.stay),
        noDecision: share(states.none),
      },
    };
  }

  return {
    createSession, createParticipant, begin, openDoc, decide,
    visibleReports, lostSoFar, studentView, reveal, projector, storyTime, isOver,
    PLAY_MS,
  };
}

module.exports = { makeEngine, ...makeEngine() };
