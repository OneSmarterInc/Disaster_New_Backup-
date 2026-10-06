'use strict';

// Exchange an existing RapidSims sign-in for Sim04's normal signed launch.
// The classroom invitation supplies the session code; access is always checked
// against the student's RapidSims course enrolment.
async function platformLaunch(simId) {
  if (!/^\/sim04(?:\/|$)/.test(location.pathname)) return { status: 'skip' };
  try {
    const params = new URLSearchParams({ sim: simId, format: 'json' });
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
