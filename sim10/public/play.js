'use strict';
const params = new URLSearchParams(location.search);
const CODE = (params.get('code') || '').toUpperCase();
const PID = sessionStorage.getItem(participantKey(CODE));
if (!CODE || !PID) location.replace(CODE ? `./?session=${encodeURIComponent(CODE)}` : './');

let view = null;          // last state from the server
let skew = 0;             // server clock minus local clock
let packCase = null;      // case whose pack is on screen
let dockKey = null;       // phase/mode signature of the dock as built
let phaseStart = null;    // for the progress track
let revealKey = null;
let dockMin = false;
const pending = {};       // debounced saves
const headers = { 'X-Pid': PID };
let polling = false;
$('#solo-next').addEventListener('click', async () => {
  const button = $('#solo-next');
  if (button.disabled || !view?.nextPart) return;
  button.disabled = true;
  try {
    await api('POST', 'api/solo/advance', { code: CODE, caseId: view.caseId, stage: view.soloStage }, headers);
    await poll();
  } catch (e) { $('#err').textContent = e.message; }
  finally { button.disabled = false; }
});

// ---------- polling and clock ----------
async function poll() {
  if (polling) return;
  polling = true;
  try {
    const v = await api('GET', `api/state?code=${encodeURIComponent(CODE)}`, null, headers);
    skew = v.serverNow - Date.now();
    render(v);
    $('#err').textContent = '';
  } catch (e) {
    if (e.status === 401) { $('#err').textContent = e.message; return; }
    if (e.status === 403 || e.status === 404) {
      sessionStorage.removeItem(participantKey(CODE));
      let saved = null; try { saved = JSON.parse(sessionStorage.getItem(soloKey()) || 'null'); } catch {}
      if (saved?.code === CODE) { sessionStorage.removeItem(soloKey()); location.href = './'; }
      else location.href = `./?session=${encodeURIComponent(CODE)}`;
      return;
    }
    $('#err').textContent = 'Connection lost. Retrying…';
  } finally { polling = false; }
}
setInterval(poll, 2500);
poll();

setInterval(() => {
  if (!view || !view.endsAt || view.phase === 'closed') { $('#time').textContent = ''; return; }
  const left = view.endsAt - (Date.now() + skew);
  $('#time').textContent = clockText(left);
  $('#time').classList.toggle('low', left < 60000);
  if (phaseStart && view.endsAt > phaseStart) $('#track').style.width = `${Math.min(100, 100 * (1 - left / (view.endsAt - phaseStart)))}%`;
  if (left <= 0) poll();
}, 500);

// ---------- render ----------
function render(v) {
  const phaseChanged = !view || view.phase !== v.phase || view.caseId !== v.caseId;
  if (phaseChanged) phaseStart = v.serverNow;
  view = v;
  $('#solo-next').hidden = !v.solo || !v.nextPart;
  $('#solo-next').textContent = v.nextPart || 'Show next part';
  $('#solo-done').hidden = !v.solo || v.phase !== 'closed' || !!v.nextPart;
  const nth = v.cases.indexOf(v.caseId) + 1;
  $('#case-label').textContent = v.cases.length > 1 ? `Company ${nth} of ${v.cases.length}` : 'Company 1';
  $('#phase-label').textContent = v.phase === 'read' ? `${PHASE_NAMES.read}: ${v.mode === 'team' ? 'private calls' : 'calls'} open when it ends` : PHASE_NAMES[v.phase];

  $('#waiting').hidden = v.phase !== 'waiting';
  $('#waiting-team').textContent = v.team ? `You're in Team ${v.team}.` : '';
  $('#pack-wrap').hidden = v.phase === 'waiting';
  if (v.phase === 'waiting') { $('#dock').hidden = true; $('#result').hidden = true; $('#reveal').hidden = true; return; }

  if (packCase !== v.caseId) {
    renderPack(v.pack); packCase = v.caseId; dockKey = null; revealKey = null; dockMin = false;
    $('#pack-wrap').open = true; $('#result').innerHTML = ''; $('#reveal').innerHTML = '';
    window.scrollTo(0, 0);
  }

  const closed = v.phase === 'closed';
  $('#pack-summary').hidden = !closed;
  if (closed && phaseChanged) $('#pack-wrap').open = false;
  renderResult(v);
  renderReveal(v);
  renderDock(v);
  maybeFinish(v);
  document.body.classList.toggle('citing', canCite(v));
  markCited(currentLine(v));
}

function canCite(v) {
  if (v.mode === 'individual') return v.phase === 'verdict';
  return v.phase === 'team' && !v.teamCommitted;
}
function currentLine(v) {
  if (v.result && v.result.line) return v.result.line;
  if (v.mode === 'individual') return (v.mine && v.mine.line) || null;
  if (v.teamCommitted) return v.teamCommitted.line;
  return (v.teamDraft && v.teamDraft.line) || null;
}

function renderPack(pack) {
  const g = pack.glossary;
  wireGlossaryOnce(g);
  $('#briefing').innerHTML = `<div class="briefing">${pack.briefing.map((p) => `<p>${esc(p)}</p>`).join('')}
    <div class="gloss"><span class="muted">Tap a term for its meaning:</span> ${Object.keys(g).map((t) => `<button type="button" class="term" data-term="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>`;
  const qh = pack.quarters.map((q) => `<th scope="col">${esc(q)}</th>`).join('');
  const rowHtml = (r, cls = '') => `<tr class="line ${cls}" data-tag="${esc(r.tag)}"><td>${withTerms(r.label, g)}</td>${r.values.map((v, i) => `<td class="v">${esc(v)}${r.periods ? `<small>${esc(r.periods[i])}</small>` : ''}</td>`).join('')}</tr>`
    + (r.note ? `<tr class="note"><td colspan="3">${withTerms(r.note, g)}</td></tr>` : '');
  $('#doc').innerHTML = pack.sections.map((s) => {
    let html = `<section><h2>${esc(s.title)}</h2>`;
    if (s.blocks.length) {
      html += `<div class="scroll"><table class="fig"><thead><tr><th scope="col">Line</th>${qh}</tr></thead><tbody>`;
      for (const b of s.blocks) {
        if (b.kind === 'row') html += rowHtml(b.row);
        else html += rowHtml(b.rows[0], 'pair-first') + rowHtml(b.rows[1]) + (b.note ? `<tr class="note"><td colspan="3">${withTerms(b.note, g)}</td></tr>` : '');
      }
      html += '</tbody></table></div>';
    }
    if (s.statements) html += `<div class="statements"><h3>What management said</h3>${s.statements.map((t) => `<p class="textline" data-tag="${esc(t.tag)}">${withTerms(t.text, g)}</p>`).join('')}</div>`;
    if (s.text) html += `<div class="textlines">${s.text.map((t) => `<p class="textline" data-tag="${esc(t.tag)}">${withTerms(t.text, g)}</p>`).join('')}</div>`;
    return html + '</section>';
  }).join('');
}

let glossWired = false;
function wireGlossaryOnce(g) { if (!glossWired) { wireGlossary(g); glossWired = true; } }

// Tap a line in the pack to cite it.
document.addEventListener('click', (e) => {
  if (!view || !canCite(view) || e.target.closest('.term')) return;
  const el = e.target.closest('[data-tag]');
  if (!el || !$('#doc').contains(el)) return;
  if (dockMin) { dockMin = false; dockKey = null; renderDock(view); }
  const sel = $('#f-line');
  if (!sel) return;
  sel.value = el.dataset.tag;
  sel.dispatchEvent(new Event('change'));
});

function markCited(tag) {
  document.querySelectorAll('#doc .cited').forEach((el) => el.classList.remove('cited'));
  if (tag) document.querySelectorAll(`#doc [data-tag="${CSS.escape(tag)}"]`).forEach((el) => el.classList.add('cited'));
}

// ---------- dock ----------
function pickerHtml(pack, value) {
  const groups = {};
  for (const p of pack.picker) (groups[p.section] ||= []).push(p);
  return `<select id="f-line"><option value="">Choose the line that drove your call</option>${Object.entries(groups).map(([sec, items]) =>
    `<optgroup label="${esc(sec)}">${items.map((p) => `<option value="${esc(p.tag)}"${p.tag === value ? ' selected' : ''}>${esc(p.label)}</option>`).join('')}</optgroup>`).join('')}</select>`;
}

function formHtml(v, data, opts) {
  const r = v.rules;
  return `
    <div class="calls" role="group" aria-label="Your call">
      ${['infra', 'bubble'].map((c) => `<button type="button" class="call" data-call="${c}" aria-pressed="${data.call === c}">${CALL_NAMES[c]}</button>`).join('')}
    </div>
    <div class="field"><label for="f-line">Which line drove your call? You can also tap a line in the figures.</label>${pickerHtml(v.pack, data.line)}</div>
    <div class="field"><label for="f-why">In one sentence, why that line?</label>
      <input type="text" id="f-why" maxlength="400" value="${esc(data.lineWhy || '')}"></div>
    <div class="field"><label for="f-mind">What would you have needed to see to make the opposite call?</label>
      <textarea id="f-mind" maxlength="2000">${esc(data.mind || '')}</textarea>
      <span class="count" id="mind-count"></span></div>
    ${opts.commit ? '<button type="button" class="btn" id="commit">Commit the team\u2019s call</button> <span class="muted">Anyone on the team can commit. It can\u2019t be changed after.</span>' : ''}
    <p class="saved" id="saved"></p>`;
}

function renderDock(v) {
  const dock = $('#dock'), inner = $('#dock-inner');
  let key; let body = ''; let title = '';
  if (v.phase === 'closed') { dock.hidden = true; dockKey = null; return; }
  if (v.phase === 'read') { dock.hidden = true; dockKey = null; return; }
  if (v.phase === 'verdict') {
    key = 'verdict'; title = 'Your call';
    body = formHtml(v, v.mine || {}, {});
  } else if (v.phase === 'private') {
    key = `private:${v.mine.private || ''}`; title = 'Your private call';
    body = `<p class="muted">Only you see this. Your team agrees one call next.</p>
      <div class="calls">${['infra', 'bubble'].map((c) => `<button type="button" class="call" data-private="${c}" aria-pressed="${v.mine.private === c}">${CALL_NAMES[c]}</button>`).join('')}</div>`;
  } else if (v.phase === 'team') {
    if (v.teamCommitted) {
      key = 'team:committed'; title = 'Your team\u2019s call is committed';
      body = `<p>${esc(CALL_NAMES[v.teamCommitted.call])}</p>`;
    } else {
      key = 'team:draft'; title = `Team ${v.team}: agree one call`;
      body = formHtml(v, v.teamDraft || {}, { commit: true });
    }
  }
  dock.hidden = false;
  if (key !== dockKey) {
    inner.innerHTML = `<div class="dock-head"><h2>${esc(title)}</h2><button type="button" class="btn quiet" id="dock-toggle">${dockMin ? 'Show' : 'Hide'}</button></div><div id="dock-body"${dockMin ? ' hidden' : ''}>${body}</div>`;
    dockKey = key;
    wireDock(v);
  } else if (v.phase === 'team' && !v.teamCommitted) {
    syncDraft(v.teamDraft || {});
  }
  updateMindCount();
}

function syncDraft(d) {
  // Teammates' edits flow in, except into the field this person is typing in.
  const active = document.activeElement;
  document.querySelectorAll('.call[data-call]').forEach((b) => b.setAttribute('aria-pressed', String(d.call === b.dataset.call)));
  const set = (id, val) => { const el = $(id); if (el && el !== active && !pending[id] && el.value !== (val || '')) el.value = val || ''; };
  set('#f-line', d.line); set('#f-why', d.lineWhy); set('#f-mind', d.mind);
}

function updateMindCount() {
  const m = $('#f-mind'); const c = $('#mind-count');
  if (!m || !c) return;
  const n = m.value.trim().length; const need = view.rules.minMind;
  c.textContent = n >= need ? 'Long enough.' : `${need - n} more characters needed.`;
  c.classList.toggle('ok', n >= need);
}

function wireDock(v) {
  $('#dock-toggle').onclick = () => { dockMin = !dockMin; dockKey = null; renderDock(view); };
  const save = (fields) => {
    const isTeam = view.mode === 'team';
    const path = isTeam ? 'api/team/draft' : 'api/verdict';
    const saved = $('#saved');
    return api('POST', path, { code: CODE, caseId: view.caseId, fields }, headers)
      .then((rec) => {
        if (isTeam) view.teamDraft = rec; else view.mine = rec;
        if (saved) saved.textContent = 'Saved.';
      })
      .catch((e) => { if (saved) saved.textContent = e.message; poll(); });
  };
  const debounced = (id, field) => {
    const el = $(id); if (!el) return;
    el.addEventListener('input', () => {
      updateMindCount();
      clearTimeout(pending[id]);
      const s = $('#saved'); if (s) s.textContent = 'Saving…';
      pending[id] = setTimeout(() => { delete pending[id]; save({ [field]: el.value }); }, 700);
    });
  };
  document.querySelectorAll('.call[data-call]').forEach((b) => b.onclick = () => {
    document.querySelectorAll('.call[data-call]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    save({ call: b.dataset.call });
  });
  document.querySelectorAll('.call[data-private]').forEach((b) => b.onclick = () => {
    api('POST', 'api/private', { code: CODE, caseId: view.caseId, call: b.dataset.private }, headers).then(poll).catch((e) => { $('#err').textContent = e.message; });
  });
  const line = $('#f-line');
  if (line) line.addEventListener('change', () => { markCited(line.value || null); save({ line: line.value || null }); });
  debounced('#f-why', 'lineWhy');
  debounced('#f-mind', 'mind');
  const commit = $('#commit');
  if (commit) commit.onclick = async () => {
    commit.disabled = true;
    await Promise.all(Object.keys(pending).map((id) => { clearTimeout(pending[id]); delete pending[id]; const el = $(id); return save({ [id === '#f-why' ? 'lineWhy' : 'mind']: el.value }); }));
    api('POST', 'api/team/commit', { code: CODE, caseId: view.caseId }, headers).then(poll).catch((e) => { commit.disabled = false; $('#saved').textContent = e.message; });
  };
}

// ---------- result and reveal ----------
function renderResult(v) {
  const el = $('#result');
  if (v.phase !== 'closed' || !v.result) { el.hidden = true; return; }
  const r = v.result; const who = v.mode === 'team' ? 'Your team\u2019s' : 'Your';
  const label = (tag) => (v.pack.picker.find((p) => p.tag === tag) || {}).label || tag;
  let html = '<div class="panel">';
  if (r.status === 'no_verdict') {
    html += `<h2>No verdict recorded</h2><p>${v.mode === 'team' ? 'Your team did not commit a call before the clock ran out.' : 'The clock ran out before a call was made.'}</p>`;
  } else {
    const blank = (b, text) => (r.blanks.includes(b) ? `<span class="blank">${text}</span>` : null);
    html += `<h2>${who} call: ${esc(CALL_NAMES[r.call])}</h2>
      <p><b>Line:</b> ${r.line ? esc(label(r.line)) : blank('line', 'left blank')}</p>
      <p><b>Why:</b> ${blank('reason', r.lineWhy ? `too short: \u201c${esc(r.lineWhy)}\u201d` : 'left blank') || esc(r.lineWhy)}</p>
      <p><b>What would have changed ${v.mode === 'team' ? 'your' : 'your'} mind:</b> ${blank('mind', r.mind ? `too short: \u201c${esc(r.mind)}\u201d` : 'left blank') || esc(r.mind)}</p>`;
  }
  if (!v.reveal) html += '<p class="muted">Your host will lead the discussion, then reveal what happened.</p>';
  html += '</div>';
  if (el.innerHTML !== html) el.innerHTML = html;
  el.hidden = false;
}

function shortPeriod(s) {
  const m = String(s).match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  return m ? `${m[2].slice(0, 3)} ${m[3]}` : s;
}

function renderReveal(v) {
  const el = $('#reveal');
  const r = v.reveal;
  if (!r) { el.hidden = true; return; }
  const key = `${v.caseId}:${r.stage}`;
  if (key === revealKey) return;
  revealKey = key;
  let html = `<div class="panel"><p class="muted">The company was</p><p class="reveal-name">${esc(r.identity.name)}</p>
    <p class="reveal-period">${esc(r.identity.period)}</p><p>${esc(r.identity.asset)}</p></div>`;
  if (r.table) {
    const t = r.table;
    const row = (x) => `<tr class="${x.yours ? 'yours' : ''}"><td>${esc(x.label)}${x.yours ? ' <span class="muted">(your line)</span>' : ''}</td>${x.values.map((val) => `<td class="v">${esc(val)}</td>`).join('')}</tr>`;
    html += `<section class="panel"><h2>The next four quarters</h2><p class="muted">${esc(t.unitNote)} The first two columns are the quarters you read, now unscaled.</p>
      <div class="scroll"><table class="fig"><thead><tr><th scope="col">Line</th>${t.quarters.map((q, i) => `<th scope="col" class="${i < 2 ? 'seen' : ''}">${esc(shortPeriod(q))}${i < 2 ? '<br>(you read)' : ''}</th>`).join('')}</tr></thead>
      <tbody>${t.rows.map(row).join('')}${t.extra ? row(t.extra) + `<tr class="note"><td colspan="7">${esc(t.extra.note)}</td></tr>` : ''}</tbody></table></div>
      <h3>What the company reported along the way</h3><ul class="facts">${r.facts.map((f) => `<li><span class="mono muted">${esc(shortPeriod(f.period))}</span> ${esc(f.text)}</li>`).join('')}</ul>
      <div class="basis">${t.basis.map((b) => `<p>${esc(b)}</p>`).join('')}</div></section>`;
  }
  if (r.outcome) {
    html += `<section class="panel"><h2>What happened</h2><ul class="outcome">${r.outcome.map((o) => `<li>${esc(o.text)}${o.secondary ? ' <span class="muted">(from a secondary source)</span>' : ''}</li>`).join('')}</ul></section>`;
  }
  el.innerHTML = html;
  el.hidden = false;
}

// Tell RapidSims this person finished, once the last company's outcome is shown.
let finishSent = false;
function maybeFinish(v) {
  const last = v.cases[v.cases.length - 1];
  if (finishSent || !launchToken() || v.caseId !== last || !v.reveal || v.reveal.stage < 3) return;
  finishSent = true;
  api('POST', 'api/finish', { code: CODE }, headers)
    .then(r => { finishSent = !!r.reported; })
    .catch(() => { finishSent = false; });
}
