'use strict';

const { classify } = require('./classifier');
const { RAY, TERRY, RUTH } = require('../data/contracts');
const { WINDOW_SECONDS, WINDOWS, isFeasible, feasibleOrderings } = require('../data/calendar');

const SOURCES = { ray: RAY, terry: TERRY, ruth: RUTH };

function nextPosture(character, current, bucket) {
  const rules = character.posture;
  if (!rules) return null;
  if (rules.terminal.includes(current)) return current;
  if (rules.closes.includes(bucket)) return 'CLOSED';
  if (current === 'GUARDED' && rules.opens.includes(bucket)) return 'OPEN';
  return current;
}

function resolveAnswer(character, posture, bucket, askCounts) {
  let table = character.answers;
  if (posture) table = table[posture];
  const key = table.ANY ? 'ANY' : bucket;
  const variants = table[key] || table.UNMATCHED;
  if (!variants) return null;
  const countKey = `${character.id}:${posture || '-'}:${key}`;
  const n = askCounts.get(countKey) || 0;
  askCounts.set(countKey, n + 1);
  const rotates = key === 'UNMATCHED' || key === 'SOCIAL_OPENING';
  const index = rotates ? n % variants.length : Math.min(n, variants.length - 1);
  return { text: variants[index], index, key };
}

class Session {
  constructor() {
    this.order = null;
    this.windowIndex = 0;
    this.remaining = WINDOW_SECONDS;
    this.posture = { ruth: RUTH.posture.initial };
    this.askCounts = new Map();
    this.transcript = [];
    this.observationSeconds = null;
    this.completedChart = null;
    this.submission = null;
    this.launch = null;
  }

  chooseOrder(order) {
    if (this.order) throw new Error('order already chosen');
    if (!isFeasible(order)) {
      throw new Error(`ordering [${order.join(', ')}] is not permitted by the calendar. Legal: ${feasibleOrderings().map((o) => o.join('>')).join('  |  ')}`);
    }
    this.order = order;
    return this;
  }

  get currentSourceId() {
    if (!this.order) throw new Error('no order chosen');
    return this.order[this.windowIndex] || null;
  }

  get isWindowOpen() { return this.currentSourceId !== null && this.remaining > 0; }

  ask(text) {
    if (!this.order) throw new Error('no order chosen');
    const sourceId = this.currentSourceId;
    if (!sourceId) return { error: 'SESSION_OVER' };
    if (this.remaining <= 0) return { error: 'WINDOW_CLOSED', sourceId };
    const character = SOURCES[sourceId];
    const { bucket, cost, matchedBy } = classify(text);
    const postureBefore = this.posture[sourceId] ?? null;
    const postureAfter = nextPosture(character, postureBefore, bucket);
    if (postureAfter !== null) this.posture[sourceId] = postureAfter;
    const resolved = resolveAnswer(character, postureAfter, bucket, this.askCounts);
    const spent = Math.min(cost, this.remaining);
    this.remaining -= spent;
    const entry = { window: WINDOWS[this.windowIndex].id, sourceId, sourceName: character.name, question: text, bucket, matchedBy, cost, spent, remaining: this.remaining, postureBefore, postureAfter, postureChanged: postureBefore !== postureAfter, answer: resolved.text, variant: resolved.index, answerKey: resolved.key };
    this.transcript.push(entry);
    return entry;
  }

  advanceWindow() {
    if (this.windowIndex >= WINDOWS.length - 1) { this.windowIndex = WINDOWS.length; return { done: true }; }
    this.windowIndex += 1;
    this.remaining = WINDOW_SECONDS;
    return { done: false, window: WINDOWS[this.windowIndex], sourceId: this.currentSourceId };
  }

  summary() {
    const byWindow = WINDOWS.map((w) => {
      const rows = this.transcript.filter((t) => t.window === w.id);
      const last = rows[rows.length - 1];
      return { window: w.id, label: w.label, source: rows.length ? rows[0].sourceName : null, questions: rows.length, openerBucket: rows.length ? rows[0].bucket : null, openerCost: rows.length ? rows[0].cost : null, secondsUnused: last ? last.remaining : WINDOW_SECONDS, postureEnd: last ? last.postureAfter : null, closedBy: rows.find((r) => r.postureAfter === 'CLOSED') || null };
    });
    return { order: this.order, senderPerspectiveAskedIn: [...new Set(this.transcript.filter((t) => t.bucket === 'SENDER_PERSPECTIVE').map((t) => t.sourceName))], genericOpeners: this.transcript.filter((t, i, a) => t.bucket === 'GENERIC_DESCRIPTIVE' && (i === 0 || a[i - 1].window !== t.window)).length, byWindow };
  }
}

module.exports = { Session, nextPosture, resolveAnswer, SOURCES };
