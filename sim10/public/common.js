'use strict';
// Shared helpers. All URLs are relative so the /sim10 prefix works via <base>.
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Platform launch token: arrives as #lt= or ?lt=, kept for this tab only, and
// sent on every request. The sim itself keeps no record of the person.
const entryQuery = new URLSearchParams(location.search);
const launchScope = (entryQuery.get('session') || entryQuery.get('code') || 'solo').toUpperCase();
const launchKey = `s10-lt:${launchScope}`;
(function captureToken() {
  const h = new URLSearchParams(location.hash.slice(1)); const q = new URLSearchParams(location.search);
  const t = h.get('lt') || q.get('lt');
  if (!t) return;
  sessionStorage.setItem(launchKey, t);
  q.delete('lt');
  history.replaceState(null, '', location.pathname + (q.toString() ? `?${q}` : ''));
})();
const launchToken = () => sessionStorage.getItem(launchKey);
async function platformLaunch(simId, sessionCode = '') {
  if (!/^\/sim10(?:\/|$)/.test(location.pathname)) return { status: 'skip' };
  try {
    const params = new URLSearchParams({ sim: simId, format: 'json' });
    if (sessionCode) params.set('session', String(sessionCode).toUpperCase());
    const response = await fetch('/api/launch?' + params, {
      credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(8000)
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.url) {
      location.replace(data.url);
      return { status: 'launched' };
    }
    if (response.status === 401) return { status: 'signed_out' };
    if (response.status === 403) return {
      status: 'not_entitled',
      message: data.message || 'This simulation is not available to your RapidSims account yet.'
    };
    return { status: 'unavailable', message: data.message || 'RapidSims could not check access right now.' };
  } catch {
    return { status: 'unavailable', message: 'RapidSims could not check access right now.' };
  }
}
function rememberLaunch(code) {
  const key = `s10-lt:${code.toUpperCase()}`;
  if (launchToken()) sessionStorage.setItem(key, launchToken());
  else sessionStorage.removeItem(key);
}
const participantKey = (code) => `s10:${code.toUpperCase()}`;
const soloKey = () => { const p = launchInfo(); return `s10-solo:${p?.sub || 'guest'}:${p?.course || ''}`; };
function launchInfo() {
  const t = launchToken(); if (!t) return null;
  try { return JSON.parse(atob(t.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return null; }
}

async function api(method, path, body, headers = {}) {
  const auth = {};
  if (launchToken()) auth['X-Launch-Token'] = launchToken();
  if (sessionStorage.getItem('s10-access')) auth['X-Access-Code'] = sessionStorage.getItem('s10-access');
  if (sessionStorage.getItem('s10-faculty')) auth['X-Faculty-Code'] = sessionStorage.getItem('s10-faculty');
  const res = await fetch(path, { method, cache: 'no-store', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', ...auth, ...headers }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.message || 'Request failed.'); e.status = res.status; e.code = data.error; throw e; }
  return data;
}

function clockText(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const PHASE_NAMES = {
  waiting: 'Waiting for the host to start',
  read: 'Reading time',
  verdict: 'Make your call',
  private: 'Your private call',
  team: 'Agree your team\u2019s call',
  closed: 'Time is up',
};
const CALL_NAMES = { infra: 'Infrastructure that will be needed', bubble: 'Inside a bubble' };

// Wrap glossary terms in tap-to-define buttons (first match per string).
function withTerms(text, glossary) {
  let html = esc(text);
  for (const term of Object.keys(glossary || {})) {
    const re = new RegExp(`\\b(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'i');
    if (re.test(html)) { html = html.replace(re, `<button type="button" class="term" data-term="${esc(term)}">$1</button>`); }
  }
  return html;
}

function wireGlossary(glossary) {
  let pop = null;
  const close = () => { if (pop) { pop.remove(); pop = null; } };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.term');
    close();
    if (!t) return;
    e.stopPropagation();
    const term = t.dataset.term;
    pop = document.createElement('div');
    pop.className = 'pop'; pop.setAttribute('role', 'dialog');
    pop.innerHTML = `<b>${esc(term)}</b>${esc(glossary[term])}`;
    document.body.appendChild(pop);
    const r = t.getBoundingClientRect();
    const top = Math.min(window.innerHeight - pop.offsetHeight - 8, r.bottom + 6);
    const left = Math.min(window.innerWidth - pop.offsetWidth - 8, Math.max(8, r.left));
    pop.style.top = `${top}px`; pop.style.left = `${left}px`;
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}
