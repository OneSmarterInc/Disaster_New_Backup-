// RapidSim 05 scenario surface. Rounds, reveals, costs and the inference table
// stay server-side and reach the browser one round at a time through /api/session.
// publicConfig() carries only what is safe to show before play begins.
const C = require('../config/content.js');

const META = C.META;

function publicConfig() {
  return {
    sim: { id: META.id, title: META.title, tagline: META.tagline, minutes: META.minutes },
    customer: C.CUSTOMER,
    briefing: C.BRIEFING,
    walkthrough: C.WALKTHROUGH,
    clock: C.CLOCK,
    rounds: C.ROUNDS.length,
    copy: C.STUDENT_COPY
  };
}

module.exports = { META, publicConfig };
