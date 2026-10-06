'use strict';
const crypto = require('node:crypto');

function healthHeaders() {
  const key = process.env.HEALTH_SECRET;
  return key ? { 'x-health-key': key } : {};
}

// Liveness is not readiness. Minimal and legacy responses cannot establish
// whether credentials, storage or completion reporting are configured.
function inspectHealth(health, sim = {}) {
  const problems = [];
  if (!health || typeof health.sim !== 'string') {
    return { state: 'needs attention', problems: ['The endpoint did not identify a simulation.'] };
  }
  if (sim.id && health.sim !== sim.id) {
    const aliases = Array.isArray(health.acceptsLaunchIds) ? health.acceptsLaunchIds : [];
    if (!aliases.includes(sim.id)) problems.push(`The deployment identifies itself as ${health.sim}.`);
  }
  if (health.diagnostic !== true) {
    problems.push(process.env.HEALTH_SECRET
      ? 'Online; protected diagnostics are unavailable. Check that HEALTH_SECRET matches on the platform and simulation, and deploy the current health endpoint.'
      : 'Online; configuration is unverified. Set a dedicated matching HEALTH_SECRET on the platform and simulation.');
    return { state: problems.length > 1 ? 'needs attention' : 'unverified', problems };
  }
  if (health.needsModelKey === true && health.characters !== 'configured') problems.push('The required model API key is missing.');
  if (health.launchSecret !== 'configured') problems.push('The launch secret is missing.');
  else if (process.env.LAUNCH_SECRET) {
    const ours = crypto.createHash('sha256').update(process.env.LAUNCH_SECRET).digest('hex').slice(0, 8);
    if (!/^[a-f0-9]{8}$/.test(health.launchSecretFingerprint || '')) problems.push('The launch secret could not be verified.');
    else if (health.launchSecretFingerprint !== ours) problems.push('The launch secret does not match the platform.');
  } else problems.push('The platform launch secret is missing.');
  if (health.sessions !== 'configured') problems.push('Session storage is not configured.');
  if (!/^https?:\/\//.test(health.platformUrl || '')) problems.push('The platform URL for registration and completions is missing.');
  if (!/^https?:\/\//.test(health.registersAs || '')) problems.push('The simulation launch URL is missing.');
  else if (sim.launch_url && health.registersAs.replace(/\/+$/, '') !== sim.launch_url.replace(/\/+$/, '')) {
    problems.push(`The configured launch address is ${health.registersAs}; check the catalogue address.`);
  }
  const features = Array.isArray(health.features) ? health.features : [];
  const missing = ['launch-token', 'self-register', 'completion-report'].filter(f => !features.includes(f));
  if (missing.length) problems.push(`Missing platform capabilities: ${missing.join(', ')}.`);
  if (health.ok === false && !problems.length) problems.push('The simulation reports an unhealthy configuration.');
  return { state: problems.length ? 'needs attention' : 'ready', problems };
}

module.exports = { healthHeaders, inspectHealth };
