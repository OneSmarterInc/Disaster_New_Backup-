'use strict';
const wireQuery = new URLSearchParams(location.search);
const wireHash = new URLSearchParams(location.hash.slice(1));
const wireKind = /console\.html$/.test(location.pathname) ? 'console' : 'student';
const wireScope = (wireQuery.get('session') || wireQuery.get('code') || 'entry').toUpperCase();
const wireIncoming = wireHash.get('lt') || wireQuery.get('lt') || '';
const wireToken = wireIncoming || sessionStorage.getItem('wire:launch:' + wireKind + ':' + wireScope) || '';
function wireLaunchToken() { return wireToken; }
function wireLaunchClaims(token) {
  try { return JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return null; }
}
function wireRememberLaunch(code) {
  if (wireToken) sessionStorage.setItem('wire:launch:' + wireKind + ':' + String(code).toUpperCase(), wireToken);
}
function wireSetRunUrl(code) {
  const current = new URL(location.href);
  current.searchParams.delete('session');
  current.searchParams.set('code', String(code).toUpperCase());
  current.hash = '';
  history.replaceState(null, '', current.pathname + current.search);
}
if (wireIncoming) {
  wireRememberLaunch(wireScope);
  const clean = new URL(location.href); clean.searchParams.delete('lt'); clean.hash = '';
  history.replaceState(null, '', clean.pathname + clean.search);
}
