// Where this platform lives, for building links that get sent to people.
//
// Taken from the request rather than a setting, so the moment a custom domain
// is pointed at the deployment every invitation, reset and enrolment link uses
// it — no configuration to remember, no redeploy, and no chance of an
// administrator sending somebody a link to the old address because a variable
// was never updated.
//
// PUBLIC_BASE_URL still wins if it is set, for anyone who wants one canonical
// address regardless of how a page was reached. Without a request we fall back
// to it, which is what background work has to use.
function baseUrl(req) {
  const configured = (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  if (req && req.headers) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (host) {
      const proto = req.headers['x-forwarded-proto'] || 'https';
      return `${proto}://${String(host).split(',')[0].trim()}`.replace(/\/+$/, '');
    }
  }
  return '';
}

module.exports = { baseUrl };
