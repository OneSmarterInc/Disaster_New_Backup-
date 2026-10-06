// Shared guards for every endpoint. Server only.

const { verifyLaunch, announce } = require('./launch.js');
const S = require('./scenario.js');

// Every endpoint passes through here, so this is where the simulation tells the
// platform it exists — once per cold start, and never blocking the request.
function announceOnce(req) {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    announce(S.META, process.env.SIM_URL || (host ? `${proto}://${host}` : ''));
  } catch (e) { /* never let this affect a request */ }
}

// Two ways in: a launch token signed by the platform, or the shared access code
// for standalone use. The token also tells us who is playing.
function checkAccess(req, res) {
  announceOnce(req);
  const lt = req.headers['x-launch-token'];
  if (lt) {
    const p = verifyLaunch(String(lt));
    if (p) { req.launch = p; return true; }
    res.status(401).json({ error: 'launch_token_invalid' });
    return false;
  }
  const required = process.env.ACCESS_CODE;
  if (!required) return true;
  if (req.headers['x-access-code'] !== required) {
    res.status(401).json({ error: 'access_code_required' });
    return false;
  }
  return true;
}

function requireKey(res) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY. Set it in the Vercel project settings.' });
    return null;
  }
  return key;
}

async function anthropic(key, { system, messages, max_tokens }) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: Math.min(Math.max(parseInt(max_tokens, 10) || 400, 1), 1000),
      system, messages
    })
  });
  const data = await r.json();
  if (!r.ok) {
    const msg = (data && data.error && data.error.message) || 'Upstream error';
    const err = new Error(msg); err.status = r.status; throw err;
  }
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  return b || {};
}

module.exports = { checkAccess, requireKey, anthropic, body };
