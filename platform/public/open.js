// Direct simulation links check the account on the platform origin, where its
// sign-in cookie lives. A guest uses the existing standalone code gate.
(() => {
  'use strict';
  const guestPaths = Object.freeze({
    'rapid-01-disaster': '/sim01/', 'rapid-02-relay': '/sim02/',
    'rapidsimplus-01': '/simplus01/',
    'rapidsimplus-02': '/simplus02/',
    'rapid-03-midland': '/sim03/launch.html',
    'rapid-04-whose-number': '/sim04/launch.html',
    'rapid-05-approve': '/sim05/launch.html',
    'rapid-06-switch': '/sim06/launch.html',
    'rapid-07-bought': '/sim07/launch.html',
    'rapid-08-later': '/sim08/launch.html',
    'rapid-09-money-land': '/sim09/launch.html',
    'rapid-10-bubble': '/sim10/'
  });
  const q = new URLSearchParams(location.search);
  const sim = q.get('sim') || '';
  const path = guestPaths[sim];
  const message = document.getElementById('message');
  const next = document.getElementById('next');
  if (!path) {
    message.textContent = 'This simulation link is not recognized.';
    next.hidden = false;
    return;
  }
  const session = (q.get('session') || '').trim().toUpperCase();
  const params = new URLSearchParams({ sim, format: 'json' });
  if (session) params.set('session', session);
  if (q.get('course')) params.set('course', q.get('course'));
  if (q.get('mode') === 'session') params.set('mode', 'session');
  fetch('/api/launch?' + params.toString(), {
    credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000)
  }).then(async response => {
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.url) {
      location.replace(data.url);
    } else if (response.status === 401) {
      // A platform class invitation needs a course account. The ordinary sim
      // link still supports a guest's standalone simulation access code.
      if (session) {
        const invite = new URLSearchParams({ sim, session });
        if (q.get('course')) invite.set('course', q.get('course'));
        location.replace('/session.html?' + invite.toString());
      } else {
        const guestPath = sim === 'rapidsimplus-02' && q.get('mode') === 'session' ? '/simplus02/console.html' : path;
        location.replace(guestPath + (guestPath.includes('?') ? '&' : '?') + 'guest=1');
      }
    } else {
      message.textContent = data.message || 'RapidSims could not check your access. Please try again.';
      next.hidden = false;
    }
  }).catch(() => {
    message.textContent = 'RapidSims could not check your access. Reload this page to try again.';
    next.hidden = false;
  });
})();
