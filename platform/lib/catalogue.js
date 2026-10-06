// What the public catalogue says about a simulation, and where each sentence
// comes from.
//
// Administrator edits win, followed by the current authored public metadata
// snapshot, registered metadata, and neutral fallbacks. The snapshot contains
// only META fields and is checked against the eleven sim sources in CI.
const source = require('./catalogue-source.json');
const DEFAULTS = {
  world: '',
  seat: '',
  clock: '',
  teaches: '',
  tangle: '',
  turn: '',
  activity: '',
  output: '',
  preparation: '',
  suitableFor: '',
  durationNote: '',
  after: 'Review your choices and the information provided at the end of the simulation.',

  // The parts that are true of every simulation. Editable all the same, since
  // an institution may want to say them differently.
  roomIntro: '',
  momentsIntro: '',
  discussion: 'Discuss the evidence you used and the reasons for your choices.',
  tryIt: 'Request a preview to explore the simulation before using it with a class.',
  sessionShape: 'Your instructor will explain the timing and how the session will run.'
};

// The fields an administrator can rewrite, in the order they appear on the page.
const FIELDS = [
  { key: 'tagline',      label: 'One line',                 hint: 'Under the title, on the list and at the top of the page.',
    eg: 'Twenty minutes in a room where nobody knows what is wrong yet.' },
  { key: 'description',  label: 'The situation',            hint: 'The opening paragraph, on the list and at the top of the page.', rows: 3,
    eg: 'Data corruption is spreading across client applications at two in the morning.' },
  { key: 'activity', label: 'What you will do', hint: 'The actions students take during the simulation.', rows: 3 },
  { key: 'output', label: 'What you will produce', hint: 'Decisions, written work, or reports completed by students.', rows: 2 },
  { key: 'preparation', label: 'Before you start', hint: 'Reading or knowledge needed before play.', rows: 2 },
  { key: 'suitableFor', label: 'Useful for', hint: 'Topics or classes that fit the activity.', rows: 2 },
  { key: 'durationNote', label: 'Time to allow', hint: 'Explain play time and any briefing or discussion time.', rows: 2 },
  { key: 'world',        label: 'Setting',                  hint: 'Shown beside the number.',
    eg: 'IT operations · managed services' },
  { key: 'seat',         label: 'You are',                  hint: 'The chair the student occupies.',
    eg: 'VP of Operations' },
  { key: 'clock',        label: 'Scenario timing',          hint: 'The time covered by the story or timed stages.',
    eg: '02:14 Tuesday to Day 3' },
  { key: 'teaches',      label: 'What you will learn',      hint: 'One line. Shown on the list and in the sidebar.',
    eg: 'What to do first when you do not know · how to weigh advice from people with something to lose' },
  { key: 'tangle',       label: 'What makes it hard',       hint: 'The problem, without the answer.', rows: 3,
    eg: 'Two explanations, identical symptoms, and fixing one destroys the evidence for the other.' },
  { key: 'turn',         label: 'Why this activity helps', hint: 'How the activity supports the learning goal.', rows: 3,
    eg: 'Two people in the room are blamed by opposite explanations. Both are good at their jobs.' },
  { key: 'roomIntro',    label: 'Introducing the people',   hint: 'Above the people in this case.', rows: 3 },
  { key: 'momentsIntro', label: 'Introducing the steps',    hint: 'Above the steps in this activity.', rows: 3 },
  { key: 'after',        label: 'Afterwards',               hint: 'What the debrief does.', rows: 3 },
  { key: 'discussion',   label: 'The discussion',           hint: 'What happens in class after everyone has played.', rows: 3 },
  { key: 'tryIt',        label: 'Try it',                   hint: 'Beside the request button.', rows: 2 },
  { key: 'sessionShape', label: 'Running a session',        hint: 'Play time, class format, and discussion.', rows: 3 }
];

// What the page will actually show, whoever wrote it.
function effective(detail) {
  const d = detail || {};
  const out = {};
  for (const k of Object.keys(DEFAULTS)) {
    out[k] = (d[k] !== undefined && String(d[k]).trim()) ? d[k] : DEFAULTS[k];
  }
  out.cast = Array.isArray(d.cast) ? d.cast : [];
  out.beats = Array.isArray(d.beats) ? d.beats : [];
  out.catalogueFacts = Array.isArray(d.catalogueFacts) ? d.catalogueFacts : [];
  out.atAGlance = Array.isArray(d.atAGlance) ? d.atAGlance : [];
  out._edited = d._edited || [];
  return out;
}

function present(sim) {
  const stored = sim.detail || {};
  const edited = Array.isArray(stored._edited) ? stored._edited : [];
  let key = sim.id;
  // These IDs have mixed historical uses. Only a record already named for
  // Wexford gets Wexford copy; no ids, publication flags or history are changed.
  if (['rapid-03-bench', 'rapid-sim-03'].includes(key) &&
      /Why Don[’']t They Have Any Patience\?/i.test(sim.title || '')) key = 'rapidsimplus-01';
  const current = Object.hasOwn(source, key) ? source[key] : null;
  if (!current) return { ...sim, detail: effective(stored) };
  const detail = { ...stored, ...current.detail };
  for (const field of edited) {
    if (Object.hasOwn(stored, field)) detail[field] = stored[field];
  }
  return {
    ...sim,
    tagline: edited.includes('tagline') ? sim.tagline : current.tagline,
    description: edited.includes('description') ? sim.description : current.description,
    detail: effective(detail)
  };
}

module.exports = { DEFAULTS, FIELDS, effective, present };


// The catalogue is public. Copy that states the outcome is worse than no copy,
// and an administrator writing it by hand is as likely as a developer shipping
// it — this is the same list the simulations' own build guard uses.
const OUTCOME_TELLS = [
  'both are true', 'neither alone', 'it was both', 'turns out to be both',
  'the real cause', 'what actually caused', 'the answer is', 'the culprit',
  'destroys the evidence', 'unless somebody stops', 'unless someone stops'
];

function statesOutcome(text) {
  const t = String(text || '').toLowerCase();
  return OUTCOME_TELLS.filter(x => t.includes(x));
}

module.exports.OUTCOME_TELLS = OUTCOME_TELLS;
module.exports.statesOutcome = statesOutcome;
