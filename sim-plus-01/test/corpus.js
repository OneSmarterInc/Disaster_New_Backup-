// Test corpus. Questions written as a participant would actually type
// them, not as the phrasing bank would like them written.

module.exports = [
  // --- OTHER_SOURCE_REQUEST -----------------------------------------
  ['@Ray please answer', 'OTHER_SOURCE_REQUEST'],
  ['Could I speak to Terry?', 'OTHER_SOURCE_REQUEST'],
  ['Switch to Ruth', 'OTHER_SOURCE_REQUEST'],
  ['is ray availble?', 'OTHER_SOURCE_REQUEST'],
  ['Can Terry answer this?', 'OTHER_SOURCE_REQUEST'],

  // --- SOCIAL_OPENING ------------------------------------------------
  ['Hi', 'SOCIAL_OPENING'],
  ["Hi, what's today's agenda?", 'SOCIAL_OPENING'],
  ['Good morning, how are you?', 'SOCIAL_OPENING'],

  // --- ROLE_CLARIFICATION -------------------------------------------
  ['What is the review desk?', 'ROLE_CLARIFICATION'],
  ['Who works at first-pass review?', 'ROLE_CLARIFICATION'],
  ['What do you mean by the review desk?', 'ROLE_CLARIFICATION'],

  // --- GENERIC_DESCRIPTIVE (the expensive opener) -------------------
  ['So what do you do here?', 'GENERIC_DESCRIPTIVE'],
  ['Can you walk me through what you do?', 'GENERIC_DESCRIPTIVE'],
  ['Tell me about your role', 'GENERIC_DESCRIPTIVE'],
  ['Describe your typical day', 'GENERIC_DESCRIPTIVE'],
  ['What is your job exactly?', 'GENERIC_DESCRIPTIVE'],
  ['How does the process work?', 'GENERIC_DESCRIPTIVE'],
  ['Walk me through a claim from start to finish', 'GENERIC_DESCRIPTIVE'],
  ['What happens here?', 'GENERIC_DESCRIPTIVE'],

  // --- EFFICIENCY_FRAMING (closes Ruth) -----------------------------
  ['Could this be automated?', 'EFFICIENCY_FRAMING'],
  ['How much of this could the new system handle?', 'EFFICIENCY_FRAMING'],
  ['Is all of this really necessary?', 'EFFICIENCY_FRAMING'],
  ['What would you cut if you could?', 'EFFICIENCY_FRAMING'],
  ["Where's the waste in this process?", 'EFFICIENCY_FRAMING'],
  ['Do we really need a manual step here?', 'EFFICIENCY_FRAMING'],
  ['How many people does it need?', 'EFFICIENCY_FRAMING'],
  ['Could a system do this instead?', 'EFFICIENCY_FRAMING'],
  ['Is there anything redundant in here?', 'EFFICIENCY_FRAMING'],
  ['How would you streamline this?', 'EFFICIENCY_FRAMING'],
  ['Could the platform take this over?', 'EFFICIENCY_FRAMING'],

  // --- AMBIGUOUS_PRESSURE (must NOT close Ruth) ---------------------
  ['What slows you down?', 'AMBIGUOUS_PRESSURE'],
  ["What's the hardest part of the job?", 'AMBIGUOUS_PRESSURE'],
  ['Where does work get stuck?', 'AMBIGUOUS_PRESSURE'],
  ["What's the bottleneck here?", 'AMBIGUOUS_PRESSURE'],
  ['What takes the longest?', 'AMBIGUOUS_PRESSURE'],
  ['What holds things up?', 'AMBIGUOUS_PRESSURE'],
  ["What's the most frustrating part?", 'AMBIGUOUS_PRESSURE'],

  // --- SENDER_PERSPECTIVE (loop-cracker) ----------------------------
  ['What does the provider hear from us?', 'SENDER_PERSPECTIVE'],
  ['Do we send anything back to them?', 'SENDER_PERSPECTIVE'],
  ['Does the provider get an acknowledgement?', 'SENDER_PERSPECTIVE'],
  ['What do they see on their end?', 'SENDER_PERSPECTIVE'],
  ['How does a provider know we received it?', 'SENDER_PERSPECTIVE'],
  ['What would they have received before they sent it again?', 'SENDER_PERSPECTIVE'],
  ['Do they get a confirmation of any kind?', 'SENDER_PERSPECTIVE'],
  ['Who handles status calls?', 'SENDER_PERSPECTIVE'],
  ['What do you tell them when they call?', 'SENDER_PERSPECTIVE'],
  ['What do providers hear when they call for status?', 'SENDER_PERSPECTIVE'],
  ['When providers call, what can you tell them?', 'SENDER_PERSPECTIVE'],
  ['How long is the gap between the first and second copy?', 'SENDER_PERSPECTIVE'],

  // --- COUNTERFACTUAL -----------------------------------------------
  ['What would happen if you stopped doing it?', 'COUNTERFACTUAL'],
  ["What happens when you're out sick?", 'COUNTERFACTUAL'],
  ['What changes when you are unavailable?', 'COUNTERFACTUAL'],
  ['Could someone else pick this up?', 'COUNTERFACTUAL'],
  ['Who covers when you take leave?', 'COUNTERFACTUAL'],
  ['What would be missed if this went away?', 'COUNTERFACTUAL'],
  ['Is there anything you catch that nothing else would?', 'COUNTERFACTUAL'],
  ["What's not written down anywhere?", 'COUNTERFACTUAL'],
  ['If the log stopped tomorrow, what would happen?', 'COUNTERFACTUAL'],

  // --- EXCEPTION_HANDLING (opens Ruth) ------------------------------
  ["What happens when a claim doesn't match?", 'EXCEPTION_HANDLING'],
  ['What do you do if the fields are wrong?', 'EXCEPTION_HANDLING'],
  ['How do you tell a duplicate from a real second claim?', 'EXCEPTION_HANDLING'],
  ['What if the tooth number is missing?', 'EXCEPTION_HANDLING'],
  ['Do you get many repeat claims?', 'EXCEPTION_HANDLING'],
  ['What are the harder claims like?', 'EXCEPTION_HANDLING'],
  ['What goes wrong at your desk?', 'EXCEPTION_HANDLING'],
  ['How do you decide whether it is the same claim?', 'EXCEPTION_HANDLING'],
  ['What happens when something is illegible?', 'EXCEPTION_HANDLING'],
  ['Do you ever see the same claim twice?', 'EXCEPTION_HANDLING'],

  // --- PURPOSE_ORIGIN -----------------------------------------------
  ['Why does the log exist?', 'PURPOSE_ORIGIN'],
  ['Who set this up originally?', 'PURPOSE_ORIGIN'],
  ['When did that start?', 'PURPOSE_ORIGIN'],
  ["What's the point of the receipt log?", 'PURPOSE_ORIGIN'],
  ['How long has this been going?', 'PURPOSE_ORIGIN'],
  ['Has that ever happened again since?', 'PURPOSE_ORIGIN'],
  ['Why do some faxes go to the vendor?', 'PURPOSE_ORIGIN'],
  ['Why are there two releases a day?', 'PURPOSE_ORIGIN'],

  // --- DOWNSTREAM_CONSUMER ------------------------------------------
  ['Who reads the log?', 'DOWNSTREAM_CONSUMER'],
  ['Who uses that information?', 'DOWNSTREAM_CONSUMER'],
  ['Where does it go after you?', 'DOWNSTREAM_CONSUMER'],
  ['Have you ever seen anyone pull it up?', 'DOWNSTREAM_CONSUMER'],
  ['Who looks at it downstream?', 'DOWNSTREAM_CONSUMER'],
  ['What happens to the batch next?', 'DOWNSTREAM_CONSUMER'],

  // --- VOLUME_TIMING ------------------------------------------------
  ['How many claims a day?', 'VOLUME_TIMING'],
  ['How long does a batch take?', 'VOLUME_TIMING'],
  ['When do the batches release?', 'VOLUME_TIMING'],
  ['How often does mail arrive?', 'VOLUME_TIMING'],
  ["What's the turnaround from the vendor?", 'VOLUME_TIMING'],
  ['How many come in by fax?', 'VOLUME_TIMING'],
  ['What time does the afternoon run go?', 'VOLUME_TIMING'],

  // --- TOOLS_SYSTEMS ------------------------------------------------
  ['What system do you use?', 'TOOLS_SYSTEMS'],
  ['Where is the log stored?', 'TOOLS_SYSTEMS'],
  ['Is that a spreadsheet?', 'TOOLS_SYSTEMS'],
  ['What software are you working in?', 'TOOLS_SYSTEMS'],

  // --- PERSONAL_HISTORY ---------------------------------------------
  ['How long have you been here?', 'PERSONAL_HISTORY'],
  ['Do you like the work?', 'PERSONAL_HISTORY'],
  ['What did you do before this?', 'PERSONAL_HISTORY'],

  // --- UNMATCHED (should fall through cleanly) ----------------------
  ['Is the coffee any good in this building?', 'UNMATCHED'],
  ['Nice to meet you', 'UNMATCHED'],
  ['Where are the toilets?', 'UNMATCHED'],
  ['Thanks for your time', 'UNMATCHED']
];
