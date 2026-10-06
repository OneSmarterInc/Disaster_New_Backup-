'use strict';
const { checkConfigAccess } = require('../lib/session-entry.js');
const { META } = require('../lib/meta.js');
const cfg = require('../data/config.js');

// What a student may see before and during play. Reports are never served here
// (they arrive through /api/session on the clock), and the reveal highlight flags
// are stripped so the payload cannot point at the line that matters.
function publicConfig() {
  return {
    sim: { id: META.id, title: META.title, cardLine: cfg.sim.cardLine },
    modes: cfg.modes,
    clock: cfg.clock,
    currency: cfg.economics.currency,
    reasonMaxLength: cfg.reasonMaxLength,
    walkthrough: cfg.walkthrough,
    briefing: cfg.briefing,
    documents: cfg.documents.map(d => ({ id: d.id, title: d.title, subtitle: d.subtitle,
      blocks: d.blocks.map(bl => ({ heading: bl.heading || null, text: bl.text })) })),
  };
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });
  if (!await checkConfigAccess(req, res)) return;
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return res.status(200).json({ ...publicConfig(), platformUrl: process.env.PLATFORM_URL || 'https://rapidsims.flexee.org' });
}
module.exports = handler;
module.exports.publicConfig = publicConfig;
