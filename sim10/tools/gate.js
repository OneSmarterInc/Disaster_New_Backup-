'use strict';
const fs = require('fs');
const path = require('path');
const config = require('../data/config');
const copy = require('../data/copy');
const content = require('../lib/content');
const { findHits, findContextHits } = require('../lib/denylist');

const PUBLIC = path.join(__dirname, '..', 'public');
const PLACEHOLDER = /\b(TODO|TBD|FIXME|XXX|PLACEHOLDER|lorem)\b|\{\{|\}\}/i;
const BAD_SRC = /TODO|NOT CAPTURED|^\s*$/i;

function strings(obj, out = []) {
  if (typeof obj === 'string') out.push(obj);
  else if (Array.isArray(obj)) obj.forEach((x) => strings(x, out));
  else if (obj && typeof obj === 'object') Object.values(obj).forEach((x) => strings(x, out));
  return out;
}

// Visible text of public files: HTML minus tags, plus string literals from
// .js files and inline <script> blocks (template expressions removed).
function jsLiterals(code, where, out) {
  for (let prev = ''; prev !== code;) { prev = code; code = code.replace(/\$\{[^{}]*\}/g, ' '); }
  code = code.replace(/\$[&0-9]/g, ' ');
  const lits = code.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) || [];
  for (const l of lits) out.push({ where, text: l.slice(1, -1).replace(/<[^>]*>/g, ' ') });
}

function publicTexts(dir = PUBLIC) {
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    if (f.endsWith('.html')) {
      out.push({ where: f, text: raw.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ') });
      for (const m of raw.matchAll(/<script>([\s\S]*?)<\/script>/g)) jsLiterals(m[1], `${f} (inline script)`, out);
    }
    if (f.endsWith('.js')) jsLiterals(raw, f, out);
  }
  return out;
}

function check(opts = {}) {
  const errors = [];
  const err = (check, msg) => errors.push(`[${check}] ${msg}`);
  const packs = opts.packs || { A: content.buildPack('A'), B: content.buildPack('B') };
  const pub = opts.publicTexts || publicTexts();
  const notesBefore = Object.fromEntries(['A', 'B'].map((c) => [c, copy.notes[c].beforeReveal]));

  // 1. placeholders
  for (const [cs, p] of Object.entries(packs)) strings(p).forEach((s) => PLACEHOLDER.test(s) && err('placeholder', `pack ${cs}: "${s.slice(0, 60)}"`));
  strings(copy.notes).concat(strings(copy.reveal)).forEach((s) => PLACEHOLDER.test(s) && err('placeholder', `copy: "${s.slice(0, 60)}"`));
  pub.forEach(({ where, text }) => PLACEHOLDER.test(text) && err('placeholder', `${where}: "${text.slice(0, 60)}"`));

  // 2. denylist on everything a student (or the projector) sees before reveal
  const deny = (where, s) => { const h = findHits(s); if (h.length) err('denylist', `${where}: [${h.join(', ')}] in "${s.slice(0, 70)}"`); };
  for (const [cs, p] of Object.entries(packs)) strings(p).forEach((s) => deny(`pack ${cs}`, s));
  for (const [cs, n] of Object.entries(notesBefore)) strings(n).forEach((s) => deny(`notes ${cs}`, s));
  pub.forEach(({ where, text }) => deny(where, text));

  // 3. provenance and 4. scaling
  for (const cs of ['A', 'B']) {
    const byTag = content.linesByTag(cs);
    const blanks = (config.allowBlank[cs] || {});
    for (const sec of config.layout[cs]) {
      for (const r of sec.rows) {
        const tags = typeof r === 'string' ? [r] : r.pair ? r.pair : [];
        if (r.derived) {
          const base = byTag[r.growthOf];
          for (const q of ['Q1', 'Q2']) {
            if (!base.prior_year || base.prior_year[q] == null) err('provenance', `${cs} ${r.derived} ${q}: no prior-year figure`);
            if (!base.src || BAD_SRC.test(base.src[q] || '')) err('provenance', `${cs} ${r.growthOf} ${q}: no filing reference`);
          }
        }
        for (const t of tags) {
          const line = byTag[t];
          if (!line) { err('provenance', `${cs} ${t}: not in source`); continue; }
          for (const q of ['Q1', 'Q2']) {
            if (line[q] == null) { if (!(blanks[t] && blanks[t][q])) err('provenance', `${cs} ${t} ${q}: blank with no reason in allowBlank`); continue; }
            if (!line.src || BAD_SRC.test(line.src[q] || '')) err('provenance', `${cs} ${t} ${q}: no filing reference`);
          }
        }
      }
    }
    for (const f of copy.play[cs].figures) if (!f.src || BAD_SRC.test(f.src)) err('provenance', `${cs} text figure ${f.tag}: no filing reference`);
    const rev = content.sources[cs].reveal;
    for (const tag of config.reveal[cs].rows) {
      const rl = rev.lines.find((l) => l.tag === tag);
      if (!rl) { err('provenance', `${cs} reveal ${tag}: not in reveal source`); continue; }
      for (const q of ['Q3', 'Q4', 'Q5', 'Q6']) if (rl[q] != null && (!rl.src || BAD_SRC.test(rl.src[q] || ''))) err('provenance', `${cs} reveal ${tag} ${q}: no filing reference`);
    }
    for (const tag of config.reveal[cs].outcome) {
      const o = rev.outcome.find((x) => x.tag === tag);
      if (!o) err('provenance', `${cs} outcome ${tag}: missing`);
      else if (/unverified/.test(o.src_grade || '')) err('provenance', `${cs} outcome ${tag}: unverified source cannot be shown`);
    }

    // 4. scaling: every displayed money value equals source x constant
    const pack = packs[cs];
    for (const sec of pack.sections) for (const b of sec.blocks) for (const row of (b.kind === 'pair' ? b.rows : [b.row])) {
      const line = byTag[row.tag];
      if (!line || !content.isMoney(line.unit)) continue;
      ['Q1', 'Q2'].forEach((q, i) => {
        if (line[q] == null) return;
        const want = content.fmtInt(content.scaled(cs, content.toK(line[q], line.unit)));
        if (row.values[i] !== want) err('scaling', `${cs} ${row.tag} ${q}: shows ${row.values[i]}, expected ${want}`);
      });
    }
    for (const f of copy.play[cs].figures) {
      const want = content.fmtInt(content.scaled(cs, f.k));
      const shown = (pack.sections.flatMap((s) => s.text || []).find((t) => t.tag === f.tag) || {}).text || '';
      if (!shown.includes(want)) err('scaling', `${cs} ${f.tag}: text does not show scaled ${want}`);
    }
    const constStr = String(config.scale[cs]);
    strings(pack).forEach((s) => s.includes(constStr) && err('scaling', `${cs}: scaling constant appears in the pack`));
    pub.forEach(({ where, text }) => text.includes(constStr) && err('scaling', `${where}: scaling constant appears`));

    // 5. line tags: picker matches everything rendered, reveal tags resolve
    const rendered = new Set();
    for (const sec of pack.sections) {
      for (const b of sec.blocks) (b.kind === 'pair' ? b.rows : [b.row]).forEach((r) => rendered.add(r.tag));
      (sec.statements || []).forEach((s) => rendered.add(s.tag));
      (sec.text || []).forEach((t) => rendered.add(t.tag));
    }
    const picked = pack.picker.map((p) => p.tag);
    if (new Set(picked).size !== picked.length) err('tags', `${cs}: duplicate tags in picker`);
    for (const t of rendered) if (!picked.includes(t)) err('tags', `${cs} ${t}: shown but not pickable`);
    for (const t of picked) if (!rendered.has(t)) err('tags', `${cs} ${t}: pickable but not shown`);
    for (const tag of config.reveal[cs].rows) {
      const rl = rev.lines.find((l) => l.tag === tag) || {};
      const targets = rl.maps_to || [tag];
      if (!targets.every((t) => picked.includes(t))) err('tags', `${cs} reveal ${tag}: does not map to a play-pack line`);
    }

    // 6. naming terms: each tied to a line in the pack
    for (const [term, tag] of notesBefore[cs].naming) if (!picked.includes(tag)) err('naming', `${cs} "${term}": line ${tag} not in pack`);
  }

  // 7. context: no course, semester, day or institution anywhere in our content
  const ctx = (where, s) => { const h = findContextHits(s); if (h.length) err('context', `${where}: [${h.join(', ')}] in "${s.slice(0, 70)}"`); };
  for (const [cs, p] of Object.entries(packs)) strings(p).forEach((s) => ctx(`pack ${cs}`, s));
  strings(copy.notes).concat(strings(copy.reveal)).forEach((s) => ctx('copy', s));
  pub.forEach(({ where, text }) => ctx(where, text));

  // 8. sim id
  const id = opts.simId || config.simId;
  if (!/^rapid-\d{2}-[a-z0-9-]+$/.test(id)) err('simid', `"${id}" is not a valid sim id`);
  if (config.retiredIds.includes(id)) err('simid', `"${id}" is retired`);
  if (config.takenIds.includes(id)) err('simid', `"${id}" belongs to another sim`);

  return errors;
}

module.exports = { check, publicTexts };

if (require.main === module) {
  const errors = check();
  if (errors.length) { console.error(`Gate FAILED (${errors.length}):\n` + errors.join('\n')); process.exit(1); }
  console.log('Gate passed: placeholders, denylist, provenance, scaling, tags, naming, context, sim id.');
}
