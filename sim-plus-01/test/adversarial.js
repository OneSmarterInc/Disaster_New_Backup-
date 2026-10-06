// Adversarial corpus. These are not questions chosen to pass; they are
// chosen to break the bank. Two categories matter most:
//
//  (a) innocent questions that could wrongly land in EFFICIENCY_FRAMING
//      and close Ruth for no reason
//  (b) natural phrasings of the door-opening buckets that the bank might
//      miss and drop into a harmless bucket instead

module.exports = [
  // (a) current-state automation questions — these are documentation
  // questions, not threats. Asking what the system already does is not
  // asking what it should replace.
  ['Is any of this automated already?', 'TOOLS_SYSTEMS'],
  ['What parts are already automated?', 'TOOLS_SYSTEMS'],
  ['Does the system do any of this for you?', 'TOOLS_SYSTEMS'],
  ['Is the matching automated or manual?', 'TOOLS_SYSTEMS'],

  // (a) volume questions that brush against headcount phrasing
  ['How many people work on this?', 'VOLUME_TIMING'],
  ['How many are on the review desk?', 'VOLUME_TIMING'],

  // (b) sender questions in natural phrasing
  ['Why do they send it again?', 'SENDER_PERSPECTIVE'],
  ['Why would a provider submit twice?', 'SENDER_PERSPECTIVE'],
  ['Does anything go back out to the practice?', 'SENDER_PERSPECTIVE'],
  ['What did the provider know before the second copy arrived?', 'SENDER_PERSPECTIVE'],
  ['How would they find out where it is?', 'SENDER_PERSPECTIVE'],

  // (b) counterfactual in natural phrasing
  ['Who would do this if you retired?', 'COUNTERFACTUAL'],
  ['Is there anyone else who can do the matching?', 'COUNTERFACTUAL'],
  ['What is only in your head?', 'COUNTERFACTUAL'],
  // uncontracted forms — participants type both
  ['What happens when you are out sick?', 'COUNTERFACTUAL'],
  ['What do you do when you are on leave?', 'COUNTERFACTUAL'],
  ['What happens when it does not match?', 'EXCEPTION_HANDLING'],
  ['What do you do if the number is not valid?', 'EXCEPTION_HANDLING'],

  // (b) exception handling that could be swallowed by GENERIC
  ['What do you do when two claims look the same?', 'EXCEPTION_HANDLING'],
  ['What do you do with the ones that are hard?', 'EXCEPTION_HANDLING'],
  ['Walk me through a claim that gives you trouble', 'EXCEPTION_HANDLING'],

  // real efficiency framing that must still close her
  ['Which of these steps could go away?', 'EFFICIENCY_FRAMING'],
  ['If we automated the matching, what breaks?', 'EFFICIENCY_FRAMING'],
  ['How lean could this desk get?', 'EFFICIENCY_FRAMING'],

  // purpose questions that must not be read as sender questions
  ['Why does the log exist at all?', 'PURPOSE_ORIGIN'],
  ['Why are there two runs a day?', 'PURPOSE_ORIGIN'],

  // downstream that must not be read as sender
  ['Who gets it after you?', 'DOWNSTREAM_CONSUMER'],

  // pleasantries and dead ends
  ['Sorry, could you repeat that?', 'UNMATCHED'],
  ['How long have you got?', 'UNMATCHED']
];
