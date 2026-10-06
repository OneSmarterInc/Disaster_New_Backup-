const config = require('../data/config');

const META = Object.freeze({
  id: config.simId,
  number: 4,
  title: 'Whose Number Is Right?',
  tagline: 'Twenty-five minutes to give the board one number.',
  description: 'Ridgeway Dispatch sells scheduling and invoicing software to plumbers, HVAC contractors and landscapers. The quarter has closed, and the board chair wants one figure before the next meeting: customer retention. Each team gets the account records, the support tickets and a definition sheet, and has to commit a number.',
  minutes: config.clockMinutes,
  catalogueRevision: 'sim04-v3-classroom-groups',
  detail: {
    world: 'Customer retention at a software company for trade businesses',
    seat: 'A team asked to report retention to the board',
    clock: 'A 25-minute decision window',
    teaches: 'Students defend a number and then watch another team defend a different one with equal care. That does work a lecture on measurement cannot.',
    tangle: 'The records are real enough to argue about. Accounts cancel and come back, fall behind on payment, and drop to cheaper plans, and the definition sheet settles each case in one line.',
    turn: 'Teams cannot see anyone else’s work, and a committed number cannot be changed.',
    after: 'The debrief starts with an argument between two teams and ends with each student writing down the definition behind a number they are judged by. There is no score.',
    discussion: 'Open with two teams defending their numbers, before any explanation.',
    sessionShape: 'Students join with their email. You set the group size, divide the room at random and adjust, then start the clock. Any number of groups can play, even one. Allow 25 minutes to calculate and time to discuss.',
    activity: 'Read the account records, the support tickets and the definition sheet. Commit a retention percentage and a confidence from 1 to 5.',
    suitableFor: 'Marketing, accounting, operations and information systems classes, without changes.',
    preparation: 'No advance reading; the data pack is included.',
    output: 'One locked percentage and a confidence rating for each group.',
    durationNote: '25 minutes of play, plus discussion.',
    tryIt: 'Preview the activity before assigning it to students.',
    catalogueFacts: [
      { label: 'Play', value: 'Groups of any size, set by the instructor' },
      { label: 'Before play', value: 'No advance reading' },
      { label: 'Feedback', value: 'Discussion; no score' }
    ],
    atAGlance: [
      { label: 'Main task', value: 'Report one customer-retention figure' },
      { label: 'Numbers', value: 'Use the supplied account records' },
      { label: 'Play mode', value: 'Team or individual' }
    ],
    beats: [
      { at: 'Commit', what: 'Each team locks its number and says how sure it is.' },
      { at: 'The numbers', what: 'Every number, shown at once.' },
      { at: 'The definitions', what: 'The definitions, and who wrote each one.' }
    ]
  }
});

const BRIEFING = 'Ridgeway Dispatch sells scheduling and invoicing software to plumbers, HVAC contractors, landscapers and other trade businesses. Customers pay monthly on one of three plans, from a one-van operator on Solo to regional firms running dozens of trucks on Fleet. The quarter has just closed, and the board chair, Elena Varga, wants one figure before the next board meeting: what was our customer retention this quarter? Your team has the quarter\'s account records, the support tickets, and a definition sheet for retention. Report one number and say how confident you are in it. Once you commit, it can\'t be changed.';

function publicConfig() {
  return {
    sim: { id: META.id, title: META.title, tagline: META.tagline, minutes: META.minutes },
    briefing: BRIEFING,
    minTeams: config.minTeams,
    warningMinutes: config.warningMinutes
  };
}

module.exports = { META, BRIEFING, publicConfig };
