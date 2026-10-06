// All tunable values live here. Edit without touching engine code.
module.exports = {
  simId: 'rapid-04-whose-number',
  retiredIds: ['rapid-03-bench'],
  clockMinutes: 25,
  warningMinutes: 2,
  minTeams: 1,           // any number of groups may play, even one
  defaultGroupSize: 4,
  errorTolerance: 0.1,
  assignmentOrder: ['A', 'E', 'D', 'C', 'B'],
  minSpreadPoints: 10,
  // The gate's reference values. The engine must reproduce these from the pack.
  expectedResults: { A: 90.0, B: 85.0, C: 80.0, D: 75.0, E: 69.6 },
  // Nothing in student-facing material may contain these (case-insensitive, whole word).
  forbiddenTerms: [
    'MIS', '3000', '4400', '7000', 'Wright State', 'university', 'semester',
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    '2024', '2025', '2026', '2027',
  ],
  placeholderPatterns: ['TODO', 'TBD', 'lorem', 'XXX', '\\[NAME\\]'],
};
