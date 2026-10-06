// RapidSim 09 scenario surface. The history stages, the real names and every
// stage value stay server-side and reach the browser one released stage at a time
// through /api/session. publicConfig() carries only what is safe before play.
const C = require('../config/content.js');

const META = C.META;

function publicConfig() {
  return {
    sim: { id: META.id, title: META.title, tagline: META.tagline, minutes: META.minutes },
    briefing: C.BRIEFING,
    forecast: C.FORECAST,
    wall: C.WALL,
    fund: C.FUND,
    clock: C.CLOCK,
    // Company cards as they stood in June 2000: no names, no prices, no stages.
    companies: C.COMPANIES.map(c => ({
      key: c.key, descriptor: c.descriptor, does: c.does, model: c.model,
      numbers: c.numbers, position: c.position, funding: c.funding
    })),
    stageYears: C.REVEAL.stages.map(s => s.year),
    copy: C.STUDENT_COPY
  };
}

module.exports = { META, publicConfig };
