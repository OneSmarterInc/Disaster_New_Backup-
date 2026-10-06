'use strict';
const BASE = (location.pathname.match(/^\/sim-?\d+/) || [''])[0];
const $ = id => document.getElementById(id);
const token = new URLSearchParams(location.hash.slice(1)).get('lt') || sessionStorage.getItem('m04-faculty-lt');
$('room').value = new URLSearchParams(location.search).get('session') || sessionStorage.getItem('m04-faculty-room') || '';
$('faculty').value = sessionStorage.getItem('m04-faculty-code') || '';
if (token) $('facultyField').hidden = true;
$('check').onclick = async () => {
  $('error').textContent = ''; $('results').replaceChildren();
  const r = await fetch(BASE + '/api/session', { method: 'POST', cache: 'no-store',
    headers: { 'content-type': 'application/json', ...(token ? { 'x-launch-token': token } : { 'x-faculty-code': $('faculty').value }) },
    body: JSON.stringify({ action: 'private_check', code: $('room').value, facultyCode: $('faculty').value }) });
  const data = await r.json();
  if (!r.ok) { $('error').textContent = data.message || data.error; return; }
  const line = (title, text, cls, small) => {
    const item = document.createElement('div'); item.className = 'status-item';
    const t = document.createElement('strong'); t.textContent = title;
    const r = document.createElement('span'); r.className = cls; r.textContent = text;
    item.append(t, r);
    if (small) { const m = document.createElement('small'); m.className = 'muted mono'; m.textContent = small; item.append(m); }
    $('results').append(item);
  };
  for (const c of data.checks.groups || []) {
    line(c.label, c.status === 'not_started' ? 'Clock not started' : c.status === 'none' ? 'No number reported'
      : c.status === 'ok' ? `${c.number}% · Matches its sheet` : `${c.number}% · Check calculation; sheet gives ${c.correct.toFixed(1)}%`,
      c.status === 'ok' ? 'success mono' : 'mono', c.members.join(', '));
  }
  if ((data.checks.unassigned || []).length) line('Not in a group', String(data.checks.unassigned.length), 'mono', data.checks.unassigned.join(', '));
};
