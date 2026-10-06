'use strict';
const BASE = (location.pathname.match(/^\/sim-?\d+/) || [''])[0];
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const guest = params.get('guest') === '1';
const facultyPractice = params.get('practice') === '1';
let code = (params.get('session') || '').trim().toUpperCase();
let launch = guest ? null : new URLSearchParams(location.hash.slice(1)).get('lt') || null;
if (launch) sessionStorage.setItem('m04-lt:' + code, launch);
else if (!guest) launch = sessionStorage.getItem('m04-lt:' + code);
function launchClaims() {
  if (!launch) return null;
  try {
    const part = launch.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')));
  } catch { return null; }
}
if (launch && !code && launchClaims()?.role === 'student') {
  $('entryHelp').textContent = launchClaims()?.course
    ? 'Your student access is confirmed. Looking for an open Sim04 session in this course…'
    : 'Your student sign-in is valid. Open the class session link from your instructor to join without typing a room code.';
}
let participantId = sessionStorage.getItem('m04-participant:' + code) || null;
let config = null, view = null, pollAt = 0, renderedPack = false, renderedCommit = '';

function headers() {
  return { 'content-type': 'application/json', ...(launch ? { 'x-launch-token': launch }
    : facultyPractice ? { 'x-faculty-code': sessionStorage.getItem('m04-faculty-code') || '' }
    : { 'x-access-code': sessionStorage.getItem('m04-access') || '' }) };
}
async function api(path, payload) {
  const response = await fetch(BASE + '/api/' + path, {
    method: payload ? 'POST' : 'GET', headers: headers(),
    ...(payload ? { body: JSON.stringify(payload) } : {}), cache: 'no-store'
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || result.error || 'Please try again.');
  return result;
}
function warnAt() { return (config?.warningMinutes ?? 2) * 60; }
function error(id, message) { $(id).textContent = message || ''; }
function time() {
  if (!view) return;
  let remaining = view.clock.remaining;
  if (remaining !== null) remaining = Math.max(0, remaining - Math.floor((Date.now() - pollAt) / 1000));
  $('clock').textContent = remaining === null ? 'Not started' : `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  $('clock').classList.toggle('warn', remaining !== null && remaining <= warnAt());
  const pill = $('statePill');
  pill.textContent = view.commit ? 'Report locked' : remaining === 0 ? 'Time ended' : view.canCommit ? 'Decision open' : view.state === 'lobby' ? 'Awaiting instructor' : 'Waiting';
  pill.classList.toggle('good', !!view.commit);
  pill.classList.toggle('warn', !view.commit && remaining !== null && remaining <= warnAt());
}
function table(target, records, columns) {
  const sort = { key: columns[0], direction: 1 };
  function paint() {
    const table = document.createElement('table'), thead = table.createTHead(), row = thead.insertRow();
    for (const key of columns) {
      const th = document.createElement('th'), button = document.createElement('button');
      button.type = 'button'; button.textContent = key.replaceAll('_', ' ') + (key === sort.key ? (sort.direction > 0 ? ' ↑' : ' ↓') : '');
      button.onclick = () => { sort.direction = sort.key === key ? -sort.direction : 1; sort.key = key; paint(); };
      th.append(button); row.append(th);
    }
    const body = table.createTBody();
    const ordered = [...records].sort((a, b) => {
      const x = a[sort.key] ?? '', y = b[sort.key] ?? '';
      return sort.direction * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true }));
    });
    for (const item of ordered) {
      const tr = body.insertRow();
      for (const key of columns) tr.insertCell().textContent = item[key] == null ? '—' : String(item[key]);
    }
    $(target).replaceChildren(table);
  }
  paint();
}
function csv(records, name) {
  const columns = Object.keys(records[0] || {});
  const cell = v => '"' + String(v ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
  const text = [columns.map(cell).join(','), ...records.map(row => columns.map(k => cell(row[k])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function draw(result) {
  view = result.view; pollAt = Date.now();
  $('entry').hidden = true; $('play').hidden = false;
  $('group').textContent = view.group || 'Not yet in a group';
  $('introMinutes').textContent = view.clockMinutes;
  $('intro').hidden = view.state !== 'lobby' && !!view.data;
  $('waiting').hidden = !!view.data && view.state !== 'lobby';
  $('practiceBar').hidden = !view.practice || view.state !== 'lobby';
  if (view.practice && view.state !== 'lobby') $('roomLabel').textContent = 'Practice room';
  if (view.state !== 'lobby' && !view.group) {
    $('waitingTitle').textContent = 'The clock has started';
    $('waitingText').textContent = 'You are not in a group yet. Tell your instructor you are in room ' + code + ' so they can add you.';
  }
  if (view.state === 'lobby') {
    const mates = view.groupmates.length ? ` with ${view.groupmates.join(', ')}` : '';
    $('roomLabel').textContent = `Room ${code} · signed in as ${view.you}`;
    $('waitingTitle').textContent = view.group ? `You are in ${view.group}${mates}` : 'Waiting for your instructor to form groups';
    $('waitingText').textContent = view.group
      ? 'Your instructor may still move people between groups. The clock starts when your instructor presses Start.'
      : 'You have joined. Your instructor puts everyone into groups from the instructor screen.';
    $('waitingHelp').textContent = 'Read What happens today while you wait. This page checks every 4 seconds.';
    if (view.practice) {
      $('waitingTitle').textContent = 'You are in your practice room';
      $('waitingText').textContent = 'Read What happens today, then press Start the clock.';
      $('practiceConsole').href = 'instructor.html?session=' + encodeURIComponent(code) + (launch ? '#lt=' + encodeURIComponent(launch) : '');
      $('practiceConsole').removeAttribute?.('target');
    }
    error('waitingError', '');
  }
  $('materials').hidden = !view.data || view.state === 'lobby';
  if (view.data && !renderedPack) {
    renderedPack = true;
    $('briefing').textContent = config.briefing;
    for (const [i, line] of view.data.sheet.lines.entries()) {
      const li = document.createElement('li'); li.textContent = line; $('sheet').append(li);
    }
    $('scope').textContent = `Starting monthly revenue in scope: $${Number(view.data.startingMrrInScope).toLocaleString('en-US')}`;
    $('plans').textContent = Object.entries(view.data.plans).map(([tier, price]) => `${tier} $${price}/month`).join(' · ');
    const accountColumns = Object.keys(view.data.accounts[0]);
    table('accountsTable', view.data.accounts, accountColumns);
    table('ticketsTable', view.data.tickets, Object.keys(view.data.tickets[0]));
    $('downloadAccounts').onclick = () => csv(view.data.accounts, 'ridgeway-accounts.csv');
    $('downloadTickets').onclick = () => csv(view.data.tickets, 'ridgeway-tickets.csv');
  }
  const key = JSON.stringify([view.commit, view.canCommit, view.clock.expired, view.state]);
  if (key !== renderedCommit) {
    renderedCommit = key;
    $('commitForm').hidden = !view.canCommit;
    $('locked').hidden = !view.commit;
    if (view.commit) {
      $('lockedNumber').textContent = view.commit.number + '%';
      $('lockedConfidence').textContent = `Confidence ${view.commit.confidence}/5`;
    }
    if (!view.commit && view.clock.expired) error('commitError', 'Time ended. No number reported.');
  }
  time();
}
async function refresh() {
  if (!code || !participantId) return;
  try { draw(await api('session', { action: 'state', code, participantId })); }
  catch (e) {
    if (view?.state === 'lobby') error('waitingError', 'Could not check the room. Retrying automatically… ' + e.message);
    else error('commitError', e.message);
  }
}
async function join(event) {
  event?.preventDefault();
  code = $('code').value.trim().toUpperCase();
  if (!launch && !guest && !facultyPractice) { error('entryError', 'Open Sim04 from your course page.'); return; }
  if (!/^[A-Z2-9]{5}$/.test(code)) { error('entryError', 'Enter the 5-letter room code from your instructor.'); return; }
  if (!launch && !participantId && !facultyPractice && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($('email').value.trim())) { error('entryError', 'Enter your email address.'); return; }
  if (launch) sessionStorage.setItem('m04-lt:' + code, launch);
  $('joinForm').querySelector('button').disabled = true;
  try {
    if (!launch && !guest) launch = sessionStorage.getItem('m04-lt:' + code);
    config = await api('config');
    const result = await api('session', { action: 'join', code,
      participantId: sessionStorage.getItem('m04-participant:' + code) || null, email: $('email').value.trim() });
    participantId = result.participantId;
    sessionStorage.setItem('m04-participant:' + code, participantId);
    history.replaceState(null, '', location.pathname + '?session=' + encodeURIComponent(code) + (guest ? '&guest=1' : ''));
    draw(result);
  } catch (e) { error('entryError', e.message); }
  finally { $('joinForm').querySelector('button').disabled = false; }
}
async function findCourseSessions() {
  const form = $('joinForm'), picker = $('course-sessions');
  form.hidden = true; picker.hidden = true;
  try {
    const result = await api('session', { action: 'course_sessions' });
    const sessions = Array.isArray(result.sessions) ? result.sessions : [];
    if (!sessions.length) {
      $('entryHelp').textContent = 'Your sign-in is confirmed, but your instructor has not opened a Sim04 session for this course yet. Return to your course page after they start one.';
      return;
    }
    if (sessions.length === 1) {
      $('entryHelp').textContent = `Joining ${sessions[0].name}…`;
      $('code').value = sessions[0].code;
      await join();
      return;
    }
    $('entryHelp').textContent = 'Choose the open class session for this course.';
    picker.replaceChildren();
    for (const session of sessions) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'button secondary';
      button.textContent = `${session.name} · ${session.mode === 'team' ? 'Team session' : 'Individual session'}`;
      button.addEventListener('click', async () => {
        picker.hidden = true;
        $('entryHelp').textContent = `Joining ${session.name}…`;
        $('code').value = session.code;
        await join();
      });
      picker.append(button);
    }
    picker.hidden = false;
  } catch (e) {
    $('entryHelp').textContent = 'Your student access is confirmed, but Sim04 could not check for an open class session.';
    error('entryError', e.message);
  }
}
function showFacultyChoice() {
  $('entryHelp').textContent = 'You are signed in as an instructor.';
  $('facultyConsole').href = 'instructor.html#lt=' + encodeURIComponent(launch);
  $('facultyChoice').hidden = false; $('facultyNote').hidden = false;
}
$('facultyPreview').addEventListener('click', async () => {
  error('entryError', '');
  try {
    config = await api('config');
    const result = await api('session', { action: 'practice' });
    code = result.session.code; participantId = result.participantId;
    sessionStorage.setItem('m04-participant:' + code, participantId);
    sessionStorage.setItem('m04-lt:' + code, launch);
    history.replaceState(null, '', location.pathname + '?session=' + encodeURIComponent(code) + '#lt=' + encodeURIComponent(launch));
    draw(result);
  } catch (e) { error('entryError', e.message); }
});
$('practiceStart').addEventListener('click', async () => {
  try { await api('session', { action: 'start', code }); await refresh(); }
  catch (e) { error('waitingError', e.message); }
});
$('joinForm').addEventListener('submit', join);
$('commitForm').addEventListener('submit', async event => {
  event.preventDefault(); error('commitError', '');
  const n = Number($('number').value).toFixed(1), confidence = $('confidence').value;
  if (!confirm(`Lock ${n}% with confidence ${confidence}/5? This cannot be changed.`)) return;
  try { draw(await api('session', { action: 'commit', code, participantId, number: $('number').value, confidence })); }
  catch (e) { error('commitError', e.message); await refresh(); }
});
if (guest) {
  $('joinForm').hidden = false;
  $('entryHelp').textContent = 'Enter the room code from your instructor and your email address.';
}
if (code) { $('code').value = code; if (launch || participantId || guest || facultyPractice) join(); }
else if (launch && launchClaims()?.role === 'student' && launchClaims()?.course) findCourseSessions();
else if (launch && ['faculty', 'faculty_preview'].includes(launchClaims()?.role)) showFacultyChoice();
else if (!guest && !launch) $('entryHelp').textContent = 'Open Sim04 from your course page, or use the class link from your instructor.';
else if (launch && launchClaims()?.role === 'student') { /* message already set above */ }
if (launchClaims()?.email) $('emailField').hidden = true;
setInterval(time, 1000); setInterval(refresh, 4000);
