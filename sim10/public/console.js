'use strict';
const CODE = (new URLSearchParams(location.search).get('code') || '').toUpperCase();
const HOST = localStorage.getItem(`s10host:${CODE}`);
const headers = { 'X-Host-Key': HOST || '' };
let state = null; let skew = 0; let viewing = null; let lastBoard = ''; let lastNotes = '';

$('#code').textContent = CODE;
$('#join-url').textContent = new URL('.', document.baseURI).href.replace(/^https?:\/\//, '');

async function poll() {
  try {
    const s = await api('GET', `api/console?code=${encodeURIComponent(CODE)}`, null, headers);
    skew = s.serverNow - Date.now(); state = s;
    if (s.joinUrl) $('#join-url').textContent = 'Through RapidSims, with this code';
    if (!viewing || !s.cases.includes(viewing)) viewing = s.activeCase;
    render(); $('#err').textContent = '';
  } catch (e) {
    $('#err').textContent = e.status === 403 ? 'This browser does not hold the host key for this session. Open the console from the browser that created it.' : 'Connection lost. Retrying…';
  }
}
setInterval(poll, 2000); poll();

setInterval(() => {
  const c = state && state.byCase[viewing];
  if (!c || !c.endsAt || c.phase === 'closed') { $('#time').textContent = ''; return; }
  const left = c.endsAt - (Date.now() + skew);
  $('#time').textContent = clockText(left); $('#time').classList.toggle('low', left < 60000);
  if (left <= 0) poll();
}, 500);

async function act(path, body) {
  try { await api('POST', path, { code: CODE, caseId: viewing, ...body }, headers); await poll(); }
  catch (e) { $('#err').textContent = e.message; }
}

const STAGE_BTN = ['Reveal the company', 'Reveal the next four quarters', 'Reveal what happened'];

function render() {
  const s = state; const c = s.byCase[viewing];
  const nth = s.cases.indexOf(viewing) + 1;
  $('#case-label').textContent = `Company ${nth} of ${s.cases.length} \u00b7 ${s.mode === 'team' ? `${s.teams} teams` : 'individual'}`;
  $('#phase-label').textContent = PHASE_NAMES[c.phase];
  $('#tabs').innerHTML = s.cases.length > 1 ? s.cases.map((cs, i) => `<button class="btn quiet" data-tab="${cs}" aria-pressed="${cs === viewing}">Company ${i + 1}</button>`).join('') : '';
  document.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { viewing = b.dataset.tab; lastBoard = ''; render(); });

  const ctl = [];
  if (c.canStart) ctl.push(`<button class="btn" data-act="start">Start the clock for company ${nth}</button>`);
  else if (c.phase === 'waiting' && viewing === 'B') ctl.push('<span class="muted">Company 2 can start once the company 1 reveal is complete.</span>');
  const b = s.byCase.B;
  if (viewing === 'A' && b && b.canStart) ctl.push('<button class="btn" data-act="startB">Start the clock for company 2</button>');
  if (c.phase === 'closed' && c.reveal < 3) ctl.push(`<button class="btn" data-act="reveal">${STAGE_BTN[c.reveal]}</button>`);
  if (c.phase === 'closed' && c.heldCount) ctl.push(`<button class="btn quiet" data-act="held">${s.showHeld ? 'Hide' : 'Show'} held responses</button>`);
  $('#controls').innerHTML = ctl.join(' ');
  document.querySelectorAll('[data-act]').forEach((btn) => btn.onclick = () => {
    const a = btn.dataset.act;
    if (a === 'start') act('api/host/start');
    if (a === 'startB') { viewing = 'B'; lastBoard = ''; act('api/host/start'); }
    if (a === 'reveal') act('api/host/reveal');
    if (a === 'held') act('api/host/project', { showHeld: !s.showHeld });
  });

  const html = board(s, c);
  if (html !== lastBoard) { $('#board').innerHTML = html; lastBoard = html; wireBoard(c); }
  const notes = notesHtml(c);
  if (notes !== lastNotes) { $('#notes-body').innerHTML = notes; lastNotes = notes; }
}

function said(it, title) {
  return `<div class="said"><h3>${esc(title || CALL_NAMES[it.call])}</h3>
    <p><b>Line:</b> ${esc(it.lineLabel || 'none given')}</p>
    <p><b>Why:</b> ${esc(it.lineWhy || '(blank)')}</p>
    <p style="margin:0"><b>Would have switched if:</b> ${esc(it.mind || '(blank)')}</p></div>`;
}

function board(s, c) {
  let h = '';
  if (c.phase === 'waiting') return `<section class="panel"><h2>${c.joined} joined</h2><p class="muted">Start the clock when the room is ready.</p></section>`;
  if (c.phase !== 'closed') {
    const n = s.mode === 'individual'
      ? `<p class="n mono" style="font-size:3rem;color:var(--amber);margin:0">${c.submitted} of ${c.joined}</p><p>have made a call</p>`
      : `<p class="mono" style="font-size:3rem;color:var(--amber);margin:0">${c.teamsCommitted} of ${s.teams}</p><p>teams have committed \u00b7 ${c.privateCalls} private calls in</p>`;
    return `<section class="panel">${n}</section>`;
  }
  h += `<section class="panel"><h2>The room's calls</h2><div class="split">
      <div><p class="n">${c.split.infra}</p><p>${CALL_NAMES.infra}</p></div>
      <div><p class="n">${c.split.bubble}</p><p>${CALL_NAMES.bubble}</p></div></div>
      <p class="muted">No verdict: ${c.split.noVerdict}${c.heldCount ? ` \u00b7 ${c.heldCount} held back because they may name the company` : ''}</p>
      ${c.movement ? `<p>Teams that moved away from their members' private calls: <b>${c.movement.moved}</b> \u00b7 held: ${c.movement.held} \u00b7 split at the start: ${c.movement.split} \u00b7 no verdict: ${c.movement.noVerdict}</p>` : ''}</section>`;

  const proj = c.projected || {};
  if (proj.pair != null && c.pairs[proj.pair]) {
    const p = c.pairs[proj.pair];
    h += `<section class="panel projected"><h2>Same line, opposite calls</h2><div class="pair">${said(p.infra)}${said(p.bubble)}</div>
      <p><button class="btn quiet" data-unproject="pair">Stop projecting</button></p></section>`;
  }
  if (c.unanimous) {
    const opp = (c.opposingCandidates || []).find((x) => x.id === proj.opposing);
    h += `<section class="panel"><h2>Everyone called it ${esc(CALL_NAMES[c.unanimous].toLowerCase())}</h2>
      <p>Here is the opposing case, built from the room's own answers to \u201cwhat would have changed your mind\u201d.</p>
      ${opp ? `<div class="projected">${said(opp, 'The opposing case')}</div><p><button class="btn quiet" data-unproject="opposing">Stop projecting</button></p>` : ''}
      <div class="pairs">${(c.opposingCandidates || []).map((x) => `<div class="said"><p>${esc(x.mind)}</p><button class="btn quiet" data-opposing="${x.id}">Project this</button></div>`).join('') || '<p class="muted">No answers were long enough to use. The written case is in your notes.</p>'}</div></section>`;
  }
  h += `<section class="panel"><h2>Lines cited, by call</h2><div class="scroll"><table class="fig"><thead><tr><th scope="col">Line</th><th scope="col">Infrastructure</th><th scope="col">Bubble</th></tr></thead><tbody>
    ${c.linesByCall.map((l) => `<tr><td>${esc(l.label)}</td><td class="v">${l.infra}</td><td class="v">${l.bubble}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No lines cited.</td></tr>'}</tbody></table></div></section>`;
  if (c.pairs.length) {
    h += `<section class="panel"><h2>Pairs to put side by side</h2><div class="pairs">${c.pairs.map((p, i) =>
      `<div><p><b>${esc(p.infra.lineLabel)}</b> <button class="btn quiet" data-pair="${i}">Project</button></p></div>`).join('')}</div></section>`;
  } else if (!c.unanimous) h += '<section class="panel"><p class="muted">No two answers cited the same line with opposite calls.</p></section>';

  const r = c.reveal_preview;
  if (r) {
    h += `<section class="panel"><p class="muted">Revealed to students</p><p class="reveal-name">${esc(r.identity.name)}</p><p class="reveal-period">${esc(r.identity.period)}</p><p>${esc(r.identity.asset)}</p>`;
    if (r.table) h += `<div class="scroll"><table class="fig"><thead><tr><th>Line</th>${r.table.quarters.map((q) => `<th>${esc(String(q).replace(/^three months ended /, ''))}</th>`).join('')}</tr></thead><tbody>${r.table.rows.map((x) => `<tr><td>${esc(x.label)}</td>${x.values.map((v) => `<td class="v">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    if (r.outcome) h += `<h3>What happened</h3><ul class="outcome">${r.outcome.map((o) => `<li>${esc(o.text)}</li>`).join('')}</ul>`;
    h += '</section>';
  }
  return h;
}

function wireBoard() {
  document.querySelectorAll('[data-pair]').forEach((b) => b.onclick = () => act('api/host/project', { pair: Number(b.dataset.pair) }));
  document.querySelectorAll('[data-opposing]').forEach((b) => b.onclick = () => act('api/host/project', { opposing: Number(b.dataset.opposing) }));
  document.querySelectorAll('[data-unproject]').forEach((b) => b.onclick = () => act('api/host/project', { [b.dataset.unproject]: null }));
}

function notesHtml(c) {
  const n = c.notes;
  let h = `<h3>Disagreement</h3><ul>${n.disagreement.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <h3>Naming</h3><ul>${n.naming.map((x) => `<li><b>${esc(x.term)}</b>: ${esc(x.line)}</li>`).join('')}</ul>
    <h3>The turn</h3><p>${esc(n.turn)}</p>`;
  if (c.minorityCase) h += `<h3>Backup: the written case for the other call</h3><p>${esc(c.minorityCase)}</p>`;
  if (c.afterNotes) h += `<h3>After the reveal</h3><ul>${c.afterNotes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  return h;
}
