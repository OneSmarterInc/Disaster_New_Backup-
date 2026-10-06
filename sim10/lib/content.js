'use strict';
const path = require('path');
const fs = require('fs');
const config = require('../data/config');
const copy = require('../data/copy');

const SRC_DIR = path.join(__dirname, '..', 'data', 'sources');
const load = (f) => JSON.parse(fs.readFileSync(path.join(SRC_DIR, f), 'utf8'));
const sources = {
  A: { play: load('case-a-source.json'), reveal: load('case-a-reveal.json') },
  B: { play: load('case-b-source.json'), reveal: load('case-b-reveal.json') },
};

const MONEY_UNITS = { usd_k: 1, usd_m_as_reported: 1000, usd_m: 1000 };
const isMoney = (unit) => unit in MONEY_UNITS;
const toK = (v, unit) => (v == null ? null : v * MONEY_UNITS[unit]);

function fmtInt(n) {
  if (n == null) return '—';
  const s = Math.abs(Math.round(n)).toLocaleString('en-GB');
  return n < 0 ? `(${s})` : s;
}

function scaled(caseId, k) { return k == null ? null : Math.round(k * config.scale[caseId]); }

function displayValue(caseId, line, q) {
  const v = line[q];
  if (v == null) return { raw: null, text: '—' };
  if (isMoney(line.unit)) { const s = scaled(caseId, toK(v, line.unit)); return { raw: s, text: fmtInt(s) }; }
  if (line.unit === 'pct') return { raw: v, text: `${v}%` };
  return { raw: v, text: fmtInt(v) };
}

function linesByTag(caseId) {
  const m = {};
  for (const l of sources[caseId].play.lines) m[l.tag] = l;
  return m;
}

// Student-facing label: the source label, plus a period note for year-to-date lines.
function labelFor(line) {
  if (line.ytd_months) return `${line.label}`;
  return line.label;
}

function buildRow(caseId, line) {
  const notes = copy.play[caseId].lineNotes;
  const row = {
    tag: line.tag,
    label: labelFor(line),
    values: ['Q1', 'Q2'].map((q) => displayValue(caseId, line, q).text),
    note: notes[line.tag] || null,
  };
  if (line.ytd_months) row.periods = ['Q1', 'Q2'].map((q) => `${line.ytd_months[q]} months`);
  return row;
}

// Build the play pack for one case. Returns only what a student may see.
function buildPack(caseId) {
  const byTag = linesByTag(caseId);
  const c = copy.play[caseId];
  const money = (k) => fmtInt(scaled(caseId, k));
  const sections = [];
  const picker = [];
  const seen = new Set();
  const addPick = (tag, label, section) => { if (!seen.has(tag)) { seen.add(tag); picker.push({ tag, label, section }); } };

  for (const sec of config.layout[caseId]) {
    const out = { id: sec.id, title: sec.title, blocks: [] };
    for (const r of sec.rows) {
      if (typeof r === 'string') {
        const line = byTag[r];
        if (!line) throw new Error(`layout ${caseId}: unknown tag ${r}`);
        const row = buildRow(caseId, line);
        out.blocks.push({ kind: 'row', row });
        addPick(row.tag, row.label, sec.title);
      } else if (r.pair) {
        const rows = r.pair.map((t) => { if (!byTag[t]) throw new Error(`layout ${caseId}: unknown tag ${t}`); return buildRow(caseId, byTag[t]); });
        out.blocks.push({ kind: 'pair', rows, note: c.pairNotes[r.pair.join('|')] || null });
        rows.forEach((row) => addPick(row.tag, row.label, sec.title));
      } else if (r.derived) {
        const base = byTag[r.growthOf];
        const vals = ['Q1', 'Q2'].map((q) => Math.round((base[q] / base.prior_year[q] - 1) * 100));
        out.blocks.push({ kind: 'row', row: { tag: r.derived, label: r.label, values: vals.map((v) => `${v}%`), note: null } });
        addPick(r.derived, r.label, sec.title);
      }
    }
    if (sec.statements) {
      out.statements = sec.statements.map((tag) => ({ tag, text: c.statements[tag] }));
      out.statements.forEach((s) => addPick(s.tag, `Management comment: ${s.text.slice(0, 60)}…`, sec.title));
    }
    if (sec.text) {
      out.text = sec.text.map((tag) => ({ tag, text: c.text[tag](money) }));
      out.text.forEach((t) => addPick(t.tag, `Note: ${t.text.slice(0, 60)}…`, sec.title));
    }
    sections.push(out);
  }
  return {
    caseId,
    quarters: ['Quarter 1', 'Quarter 2'],
    briefing: c.briefing,
    glossary: copy.glossary,
    sections,
    picker,
  };
}

// ---- Reveal ----
// Value of a reveal row in a given quarter, in USD thousands (or native unit).
function revealRaw(caseId, rowTag, q) {
  const { play, reveal } = sources[caseId];
  const rline = reveal.lines.find((l) => l.tag === rowTag);
  const unit = (rline && rline.unit) || 'usd_k';
  if (q === 'Q1' || q === 'Q2') {
    const byTag = linesByTag(caseId);
    const direct = byTag[rowTag];
    if (direct) return isMoney(direct.unit) ? toK(direct[q], direct.unit) : direct[q];
    const maps = (rline && rline.maps_to) || [];
    if (rowTag === 'cf.operating_q') {
      const ytd = byTag['cf.operating_ytd'];
      if (q === 'Q1') return ytd.ytd_months.Q1 === 3 ? ytd.Q1 : null;
      return ytd.Q2 - ytd.Q1;
    }
    if (rowTag === 'is.revenue_acquired') return 0;
    if (maps.length > 1) {
      const parts = maps.map((t) => byTag[t] && byTag[t][q]);
      return parts.some((p) => p == null) ? null : parts.reduce((a, b) => a + b, 0);
    }
    return null;
  }
  if (!rline || rline[q] == null) return null;
  return isMoney(unit) ? toK(rline[q], unit) : rline[q];
}

function revealUnit(caseId, tag) {
  const r = sources[caseId].reveal.lines.find((l) => l.tag === tag);
  if (r && r.unit) return r.unit;
  const p = linesByTag(caseId)[tag];
  return p ? p.unit : 'usd_k';
}

function fmtMillions(k, decimals) {
  if (k == null) return '—';
  const m = k / 1000;
  const s = Math.abs(m).toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return m < 0 ? `(${s})` : s;
}

function revealLabel(caseId, tag) {
  const r = sources[caseId].reveal.lines.find((l) => l.tag === tag);
  if (r && r.label) return r.label;
  const p = linesByTag(caseId)[tag];
  return p ? p.label : tag;
}

function revealMatches(caseId, rowTag, citedTag) {
  if (!citedTag) return false;
  if (rowTag === citedTag) return true;
  const r = sources[caseId].reveal.lines.find((l) => l.tag === rowTag);
  return !!(r && r.maps_to && r.maps_to.includes(citedTag));
}

function buildReveal(caseId, stage, citedTag) {
  if (stage < 1) return null;
  const { reveal } = sources[caseId];
  const { name, period, asset } = copy.reveal[caseId];
  const out = { stage, caseId, identity: { name, period, asset } };
  if (stage >= 2) {
    const cfg = config.reveal[caseId];
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'];
    const fmt = (tag, q) => {
      const unit = revealUnit(caseId, tag);
      const v = revealRaw(caseId, tag, q);
      if (unit === 'per_100' || unit === 'pct' || unit === 'count') return v == null ? '—' : String(v);
      return fmtMillions(v, cfg.decimals);
    };
    const rows = cfg.rows.map((tag) => ({
      tag, label: revealLabel(caseId, tag),
      values: quarters.map((q) => fmt(tag, q)),
      yours: revealMatches(caseId, tag, citedTag),
    }));
    let extra = null;
    if (citedTag && !rows.some((r) => r.yours) && linesByTag(caseId)[citedTag]) {
      extra = { tag: citedTag, label: revealLabel(caseId, citedTag), values: quarters.map((q) => (q === 'Q1' || q === 'Q2' ? fmt(citedTag, q) : '—')), yours: true,
        note: 'Your line is not carried in the next four quarters shown here.' };
    }
    const periods = { Q1: sources[caseId].play.periods.Q1.real, Q2: sources[caseId].play.periods.Q2.real };
    for (const q of ['Q3', 'Q4', 'Q5', 'Q6']) periods[q] = reveal.periods[q].real;
    out.table = { unitNote: 'Real figures, US$ millions unless shown otherwise.', quarters: quarters.map((q) => periods[q]), rows, extra, basis: copy.reveal[caseId].basis };
    const skip = new Set(cfg.excludeFacts || []);
    out.facts = reveal.text_lines.filter((t) => !skip.has(t.tag)).map((t) => ({ period: periods[t.quarter], text: t.fact }));
  }
  if (stage >= 3) {
    out.outcome = config.reveal[caseId].outcome.map((tag) => {
      const o = reveal.outcome.find((x) => x.tag === tag);
      return { tag, text: o.fact, secondary: /secondary/.test(o.src_grade || '') };
    });
  }
  return out;
}

module.exports = { buildPack, buildReveal, sources, scaled, toK, isMoney, linesByTag, revealRaw, fmtInt };
