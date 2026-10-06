'use strict';
const BASE = (location.pathname.match(/^\/sim-?\d+/) || [''])[0];
const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const token = new URLSearchParams(location.hash.slice(1)).get('lt') || sessionStorage.getItem('m04-faculty-lt');
if (token) sessionStorage.setItem('m04-faculty-lt', token);
let facultyCode = sessionStorage.getItem('m04-faculty-code') || '';
let code = (query.get('session') || sessionStorage.getItem('m04-faculty-room') || '').trim().toUpperCase();
let state = null, lastSignature = '', pollAt = 0, divideTouched = false;
function headers() { return { 'content-type': 'application/json', ...(token ? { 'x-launch-token': token } : { 'x-faculty-code': facultyCode }) }; }
async function api(action, extra = {}) {
  const r = await fetch(BASE + '/api/session', { method: 'POST', headers: headers(), cache: 'no-store', body: JSON.stringify({ action, code, facultyCode, ...extra }) });
  const body = await r.json();
  if (!r.ok) throw new Error(body.message || body.error || 'Please try again.');
  return body;
}
// Rooms this browser created or opened, so an instructor never has to remember a code.
function remembered() { try { return JSON.parse(localStorage.getItem('m04-my-rooms') || '[]'); } catch { return []; } }
function remember(c, list = remembered()) {
  try { localStorage.setItem('m04-my-rooms', JSON.stringify([c, ...list.filter(x => x !== c)].slice(0, 12))); } catch {}
}
function forget(c) { try { localStorage.setItem('m04-my-rooms', JSON.stringify(remembered().filter(x => x !== c))); } catch {} }
async function listRooms() {
  const box = $('myRooms'); if (!box) return;
  const rows = [];
  for (const c of remembered()) {
    try {
      const d = await api('faculty_state', { code: c });
      const people = d.projector.unassigned.length + d.projector.groups.reduce((n, g) => n + g.members.length, 0);
      const stateText = d.session.stage === 3 ? 'complete' : d.session.state === 'lobby' ? 'not started' : 'running';
      rows.push({ c, text: `${c} · ${d.session.name} · ${d.session.mode} · ${people} joined · ${stateText}` });
    } catch { forget(c); }
  }
  box.replaceChildren(...(rows.length ? [el('div', 'eyebrow', 'Your rooms')] : []), ...rows.map(r => {
    const b = el('button', 'button secondary small', r.text); b.type = 'button'; b.onclick = () => openRoom(r.c); return b;
  }));
}
function say(text, success = false) { $('message').textContent = text || ''; $('message').classList.toggle('success', success); }
function time() {
  if (!state) return;
  let seconds = state.projector.clock.remaining;
  if (seconds !== null) seconds = Math.max(0, seconds - Math.floor((Date.now() - pollAt) / 1000));
  $('clock').textContent = seconds === null ? '--:--' : `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('clock').classList.toggle('warn', seconds !== null && seconds <= (state.warningMinutes ?? 2) * 60);
}
function el(name, className, text) {
  const node = document.createElement(name); if (className) node.className = className;
  if (text != null) node.textContent = text; return node;
}
function statusList(groups) {
  const grid = el('div', 'status-list');
  for (const g of groups) {
    const item = el('div', 'status-item');
    item.append(el('strong', '', g.label), el('small', 'muted mono', g.members.map(m => m.name).join(', ')),
      el('span', g.committed ? 'success mono' : 'muted mono',
      g.committed ? 'Committed' : g.locked ? 'Time ended · no number' : 'Not committed'));
    grid.append(item);
  }
  return grid;
}
// One person, draggable on a desktop, with a Move menu for phones and tablets.
function chip(person, targets, here) {
  const node = el('div', 'chip'); node.draggable = true;
  node.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', person.id));
  const menu = el('select', 'chip-move'); menu.setAttribute('aria-label', 'Move ' + person.name);
  const head = document.createElement('option'); head.value = ''; head.textContent = 'Move'; menu.append(head);
  for (const t of targets) if (t.id !== here) {
    const o = document.createElement('option'); o.value = t.id; o.textContent = t.label; menu.append(o);
  }
  menu.onchange = () => menu.value && moveTo(person.id, menu.value);
  node.append(el('span', 'mono', person.name), menu);
  return node;
}
function column(title, id, people, targets, note) {
  const col = el('div', 'column');
  col.append(el('div', 'eyebrow', title + (people ? ` · ${people.length}` : '')));
  if (note) col.append(el('p', 'note', note));
  (people || []).forEach(p => col.append(chip(p, targets, id)));
  col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
  col.addEventListener('dragleave', () => col.classList.remove('over'));
  col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('over'); moveTo(e.dataTransfer.getData('text/plain'), id); });
  return col;
}
async function moveTo(participantId, target) {
  try { await api('move', { participantId, target }); lastSignature = ''; await refresh(); } catch (e) { say(e.message); }
}
function reportList(numbers) {
  const grid = el('div', 'status-list');
  for (const n of numbers) {
    const item = el('div', 'status-item');
    if (n.example) item.classList.add('example');
    item.append(el('strong', '', n.label), el('span', 'clock', n.number === null ? 'No number reported' : `${n.number}%`));
    if (n.example) item.append(el('small', 'muted mono', 'Worked example, not a group'));
    if (n.confidence) item.append(el('small', 'muted mono', `Confidence ${n.confidence}/5`));
    grid.append(item);
  }
  return grid;
}
function revealCard(group) {
  const card = el('article', 'reveal-card');
  if (group.example) card.classList.add('example');
  card.append(el('div', 'department', `${group.department} · Definition ${group.sheetId}`),
    el('h3', '', group.example ? 'Worked example' : group.groups.map(g => g.label).join(', ')), el('p', 'muted', group.purpose));
  const list = el('ol', 'definition');
  group.lines.forEach((line, i) => list.append(el('li', i === group.contestedIndex ? 'contested' : '', line)));
  card.append(list, el('p', 'eyebrow', 'Worked derivation'));
  for (const step of group.derivation) card.append(el('p', 'quiet', step));
  const result = group.example ? `Example figure: ${group.exampleNumber}%`
    : group.groups.map(g => `${g.label}: ${g.number === null ? 'No number reported' : g.number + '%'}`).join(' · ');
  card.append(el('p', 'mono', result));
  return card;
}
function comparison() {
  const a = $('compareA').value, b = $('compareB').value;
  const cards = state.projector.reveal || [];
  const find = id => id.startsWith('example-') ? cards.find(r => r.sheetId === id.slice(8))
    : cards.find(r => r.groups.some(g => g.id === id));
  $('comparison').replaceChildren(...[find(a), find(b)].filter(Boolean).map(revealCard));
}
function draw(data) {
  state = data; pollAt = Date.now();
  const s = data.session, p = data.projector;
  $('app').hidden = false; $('create').hidden = true; $('reopen').hidden = true;
  $('codeText').textContent = s.code; $('roomName').textContent = s.name;
  $('stage').textContent = ['Waiting to start', 'Numbers revealed', 'Definitions revealed', 'Complete'][s.stage] || 'In progress';
  if (s.stage === 0 && s.state === 'running') $('stage').textContent = 'Calculating';
  $('setup').hidden = s.state !== 'lobby';
  $('compareSection').hidden = s.stage < 2;
  $('completeSection').hidden = s.stage < 3;
  $('privateCheck').href = 'private-check.html?session=' + encodeURIComponent(s.code)
    + (token ? '#lt=' + encodeURIComponent(token) : '');
  $('joinUrl').value = data.joinUrl || 'Set SIM_URL to enable invitations';
  const signature = JSON.stringify([s, p.groups, p.unassigned, p.numbers, p.reveal]);
  if (signature === lastSignature) { time(); return; }
  lastSignature = signature;
  if (s.state === 'lobby') {
    $('start').textContent = `Start ${s.clockMinutes}-minute clock`;
    $('divideRow').hidden = s.mode === 'individual';
    if (!divideTouched) $('divideSize').value = s.groupSize;
    const targets = [{ id: 'unassigned', label: 'Unassigned' }, ...p.groups.map(g => ({ id: g.id, label: g.label })),
      { id: 'new', label: 'New group' }];
    const board = $('roster'); board.replaceChildren(
      column('Unassigned', 'unassigned', p.unassigned, targets,
        p.unassigned.length || p.groups.length ? '' : 'Nobody has joined yet. Share the invitation link.'),
      ...p.groups.map(g => column(g.label, g.id, g.members, targets)),
      column('New group', 'new', [], targets, 'Drop someone here to start a new group.'));
    const people = p.unassigned.length + p.groups.reduce((n, g) => n + g.members.length, 0);
    $('start').disabled = !p.groups.length;
    $('startNote').textContent = !people ? '' : p.unassigned.length
      ? `${p.groups.length} group(s) ready. ${p.unassigned.length} not yet in a group will wait until you place them.`
      : `${p.groups.length} group(s) ready.`;
  }
  $('late').hidden = s.state === 'lobby' || s.stage > 0 || !p.unassigned.length;
  if (!$('late').hidden) {
    const targets = p.groups.map(g => ({ id: g.id, label: g.label }));
    $('lateList').replaceChildren(column('Not yet in a group', 'unassigned', p.unassigned, targets),
      ...p.groups.map(g => column(g.label, g.id, g.members, [])));
  }
  const advance = $('advance'); advance.hidden = s.state === 'lobby' || s.stage === 3;
  advance.textContent = ['Reveal numbers', 'Reveal definitions', 'Complete session'][s.stage];
  advance.disabled = s.stage === 0 && !p.groups.every(g => g.locked);
  $('projectorStage').textContent = s.stage === 0 ? 'Projector · pre-reveal' : `Projector · Stage ${Math.min(s.stage, 2)}`;
  $('projectorTitle').textContent = ['Commitment status', 'One room, several numbers', 'What each number measures', 'What each number measures'][s.stage];
  $('projectorNote').textContent = s.stage === 0
    ? 'Only group names and commitment status are shown. The figures stay hidden until every report is locked.'
    : s.stage === 1 ? 'Every locked number, shown at once.'
    : 'The contested line, department, purpose, and calculation are shown together.';
  const body = $('projectorBody'); body.replaceChildren();
  if (s.stage === 0) body.append(statusList(p.groups));
  else if (s.stage === 1) body.append(reportList(p.numbers));
  else {
    const grid = el('div', 'grid'); p.reveal.forEach(r => grid.append(revealCard(r))); body.append(grid);
    const previousA = $('compareA').value, previousB = $('compareB').value;
    for (const id of ['compareA', 'compareB']) {
      const select = $(id); select.replaceChildren();
      p.numbers.forEach(n => { const option = document.createElement('option'); option.value = n.id; option.textContent = n.label; select.append(option); });
    }
    $('compareA').value = previousA || p.numbers[0]?.id || '';
    $('compareB').value = previousB || p.numbers[1]?.id || '';
    comparison();
  }
  time();
}
async function refresh() { if (!code) return; try { draw(await api('faculty_state')); } catch (e) { say(e.message); } }
function openRoom(value) {
  code = value.trim().toUpperCase(); sessionStorage.setItem('m04-faculty-room', code); remember(code);
  history.replaceState(null, '', location.pathname + '?session=' + encodeURIComponent(code));
  refresh();
}
$('createForm').addEventListener('submit', async e => {
  e.preventDefault(); const mode = document.querySelector('input[name=mode]:checked')?.value;
  if (!mode) { say('Choose team or individual mode.'); return; }
  try { const response = await api('create', { mode, groupSize: Number($('groupSize').value), clockMinutes: Number($('minutes').value) }); openRoom(response.session.code); say('Room created. Share the invitation link.', true); }
  catch (err) { say(err.message); }
});
$('openRoom').onclick = () => openRoom($('roomCode').value);
$('preview').onclick = async () => {
  try {
    const r = await api('practice');
    sessionStorage.setItem('m04-participant:' + r.session.code, r.participantId);
    remember(r.session.code);
    location.href = 'index.html?session=' + encodeURIComponent(r.session.code) + '&practice=1'
      + (token ? '#lt=' + encodeURIComponent(token) : '');
  } catch (e) { say(e.message); }
};
$('divideSize').oninput = () => { divideTouched = true; };
$('divide').onclick = async () => {
  try { await api('divide', { groupSize: Number($('divideSize').value) }); lastSignature = ''; await refresh(); say('Groups divided at random. Drag anyone to adjust.', true); }
  catch (e) { say(e.message); }
};
$('createForm').addEventListener('change', () => {
  $('groupSize').closest('.field').hidden = document.querySelector('input[name=mode]:checked')?.value === 'individual';
});
$('start').onclick = async () => { try { await api('start'); await refresh(); say('Clock started.', true); } catch (e) { say(e.message); } };
$('advance').onclick = async () => {
  try { const result = await api('advance'); await refresh();
    if (result.completion) $('completionText').textContent = `${result.completion.sent} completion report(s) sent. ${result.completion.failed ? 'Some reports could not be delivered; use Retry completion delivery.' : ''}`;
  } catch (e) { say(e.message); }
};
$('retryReport').onclick = async () => { try { const r = await api('report'); $('completionText').textContent = `${r.completion.sent} additional report(s) sent; ${r.completion.failed} failed.`; } catch (e) { say(e.message); } };
$('copyLink').onclick = async () => { try { await navigator.clipboard.writeText($('joinUrl').value); say('Invitation link copied.', true); } catch { $('joinUrl').select(); say('Select and copy the invitation link.'); } };
$('compareA').onchange = comparison; $('compareB').onchange = comparison;
async function authorize() {
  try {
    await api('faculty_access');
    if (facultyCode) sessionStorage.setItem('m04-faculty-code', facultyCode);
    $('signIn').hidden = true; $('create').hidden = false; $('reopen').hidden = false;
    say('');
    if (code) await refresh(); else listRooms();
  } catch (e) {
    facultyCode = ''; sessionStorage.removeItem('m04-faculty-code');
    $('signIn').hidden = false; $('create').hidden = true; $('reopen').hidden = true;
    say(e.message);
  }
}
$('saveCode').onclick = async () => { facultyCode = $('facultyCode').value.trim(); await authorize(); };
$('facultyCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('saveCode').click(); });
if (code) $('roomCode').value = code;
if (token || facultyCode) authorize(); else $('signIn').hidden = false;
setInterval(time, 1000); setInterval(refresh, 4000);
