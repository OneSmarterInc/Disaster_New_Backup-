// RapidSim 08 scenario surface. Answers, plans and reports stay server-side and
// reach the browser only once spent, locked or reached through /api/session.
// publicConfig() carries only what is safe to show before play begins.
const C = require('../config/content.js');

const META = C.META;

function publicConfig() {
  return {
    sim: { id: META.id, title: META.title, tagline: META.tagline, minutes: META.minutes },
    practice: C.PRACTICE,
    briefing: C.BRIEFING,
    clock: C.CLOCK,
    budget: C.QUESTION_BUDGET,
    ceiling: C.BUDGET_CEILING,
    copy: C.STUDENT_COPY
  };
}

module.exports = { META, publicConfig };
