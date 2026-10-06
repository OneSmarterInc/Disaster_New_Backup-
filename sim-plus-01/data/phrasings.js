// Phrasing bank for RapidSim+ 01 intent classification.
//
// ORDER IS SEMANTIC. Buckets are evaluated top to bottom and the first
// match wins. Specific buckets must precede the broad ones that would
// otherwise swallow them:
//
//   AMBIGUOUS_PRESSURE  before EFFICIENCY_FRAMING  ("what slows you down"
//                       must not be read as waste-hunting)
//   SENDER_PERSPECTIVE  before DOWNSTREAM_CONSUMER ("what do they get back"
//                       is not "where does it go next")
//   COUNTERFACTUAL      before EXCEPTION_HANDLING  ("what if you stopped"
//                       is not "what if it's wrong")
//   EXCEPTION_HANDLING  before GENERIC_DESCRIPTIVE ("what do you do when
//                       it doesn't match" is not "what do you do")
//
// Reordering this file changes sim behaviour. Do not sort it.

module.exports = [
  {
    bucket: 'OTHER_SOURCE_REQUEST',
    cost: 30,
    patterns: [
      /@\s*(ray|terry|ruth)\b/,
      /\b(ray|terry|ruth)\s+(please\s+)?(answer|respond|reply|take this)\b/,
      /\b(is|are) (ray|terry|ruth) (available|availble|here|free)\b/,
      /\b(can|could) (ray|terry|ruth) (answer|join|respond|help)\b/,
      /\b(can|could|may) i (ask|speak to|talk to) (ray|terry|ruth)\b/,
      /\b(ask|switch to|bring in|call) (ray|terry|ruth)\b/
    ]
  },
  {
    bucket: 'SOCIAL_OPENING',
    cost: 30,
    patterns: [
      /^(hi|hello|hey|good (morning|afternoon|evening))\b/,
      /\bwhat('s| is) (today'?s )?agenda\b/,
      /\bhow are you\b/
    ]
  },
  {
    bucket: 'ROLE_CLARIFICATION',
    cost: 60,
    patterns: [
      /\bwhat (is|does) (the )?(review desk|first[- ]pass review)\b/,
      /\bwho (is|works|runs|handles) (at |on )?(the )?(review desk|first[- ]pass review)\b/,
      /\bwhat do you mean by (the )?(review desk|first[- ]pass review)\b/,
      /\b(review desk|first[- ]pass review) mean\b/
    ]
  },
  {
    // CARVE-OUT. Must precede EFFICIENCY_FRAMING.
    // Asking what a process ALREADY does is documentation. Asking what it
    // COULD do instead is scoping. Only the second one closes Ruth, and a
    // bare /automat/ match cannot tell them apart. These patterns claim the
    // present-tense phrasings first and route them somewhere harmless.
    bucket: 'TOOLS_SYSTEMS',
    cost: 90,
    patterns: [
      /\balready automat/,
      /\bautomated or manual\b/,
      /\b(is|are|was|were) (any of |the |this |that |it )?[\w ]{0,12}automated\b/,
      /\bdoes the (system|software|platform|computer) (do|handle|already)\b/,
      /\bwhat (does|do) the (system|software|platform) (do|handle)\b/
    ]
  },
  {
    bucket: 'AMBIGUOUS_PRESSURE',
    cost: 90,
    patterns: [
      /\bslows? (you|it|things|them) down\b/,
      /\bwhat('s| is) (the )?(hardest|toughest|worst|trickiest) part\b/,
      /\bwhat('s| is) (the )?bottleneck/,
      /\bwhere (do|does) (it|things|work) (get )?(stuck|held up|backed up)\b/,
      /\bwhat (holds|slows) (you|it|things) up\b/,
      /\bmost (difficult|frustrating) part\b/,
      /\bwhat takes (the )?(longest|most time)\b/,
      /\bwhat makes\b[^?]*\btake longer\b/
    ]
  },
  {
    bucket: 'EFFICIENCY_FRAMING',
    cost: 90,
    patterns: [
      /\bautomat(e|ed|ing|ion)\b/,
      /\b(is|are) (all of )?(this|that|it|these) (really )?necessary\b/,
      /\bdo we (really )?need\b/,
      /\bhow many people (do you|does it) need\b/,
      /\bwhat would you cut\b/,
      /\bwhere('s| is) the (waste|inefficiency|fat)\b/,
      /\bcould (the )?(new )?(system|platform) (do|handle|take)\b/,
      /\bmake this (faster|more efficient|leaner)\b/,
      /\b(streamline|eliminate|reduce headcount|redundan(t|cy))\b/,
      /\bcould (this|that|it) be (done )?(faster|cheaper|by (a )?(system|machine|computer))\b/,
      /\bhow (much|many) of (this|it) could\b/,
      /\bcould (a|the) (system|machine|computer|platform|software) do\b/,
      /\b(steps?|parts?|bits?|of these)[^?]*could (go away|be dropped|be removed|be cut)\b/,
      /\bhow (lean|thin|small|slim) could\b/,
      /\bwhich (of these |of the )?(steps?|parts?)[^?]*(go away|drop|remove|cut)\b/
    ]
  },
  {
    bucket: 'SENDER_PERSPECTIVE',
    cost: 90,
    patterns: [
      /\bwhat (does|do) (a |the )?(provider|providers|they) hear\b/,
      /\bwhen (a |the )?(provider|providers|they) call\b/,
      /\b(call|calls|calling) (us |here )?for (a )?status\b/,
      /\b(provider|sender|submitter|office|practice|dentist|customer|they)\b[^?]*\b(hear|receive|get|see|told)\b/,
      /\b(hear|receive|get|see)\b[^?]*\bfrom us\b/,
      /\bdo we (send|give|return)\b[^?]*\b(back|anything|confirmation|acknowledg)/,
      /\backnowledg(e|ment|ements)\b/,
      /\bconfirmation\b/,
      /\bon their (end|side)\b/,
      /\bwhat (did|do) they (know|have|see)\b/,
      /\bbefore they (re)?[- ]?(sent|send|submit)/,
      /\bhow (long|far apart)[^?]*\b(gap|between|apart|re-?sen[dt]|second copy)/,
      /\bstatus (update|call|check|enquir|inquir)/,
      /\bwhat do you (tell|say to)\b/,
      /\bwhy (do|would|are|does|did) (a |the |any )?(they|providers?|senders?|offices?|practices?|dentists?|customers?)\b/,
      /\b(go|goes|going|come|comes) back (out )?to (them|the|a)\b/,
      /\bwhat did (the )?(provider|sender|they|office|practice)\b/,
      /\bhow (would|do|does|can|could) (they|the provider|a provider|the office) (find out|know|check|tell|see)\b/,
      /\bhow (does|do) (a |the )?(provider|sender|office|they) (know|find out|check)\b/
    ]
  },
  {
    bucket: 'COUNTERFACTUAL',
    cost: 90,
    patterns: [
      /\bif (you|this|it|that|the \w+) (stopped|stops|went away|disappeared|didn'?t exist|weren'?t)\b/,
      /\bif (you|we) (didn'?t|stopped|quit)\b/,
      /\bwhen you('| a)?re (out|away|off|sick|on (leave|holiday|vacation))\b/,
      /\bwhat (changes|happens) when you (are|aren'?t) (unavailable|available|away|absent|off)\b/,
      /\bwho (covers|does it|would do it) (when|if) you\b/,
      /\bwhat would (be missed|we lose|happen)\b/,
      /\bcould (someone|somebody|anyone) else (do|pick|handle|cover|take)\b/,
      /\bwhat('s| is) not written down\b/,
      /\b(nothing|anything) (else )?(would|could) (catch|notice|pick)\b/,
      /\bcatch(es)? that nothing (else )?(would|does)\b/,
      /\bwho would (do|handle|cover|take|pick)\b/,
      /\b(anyone|anybody|someone|somebody) else (who )?(can|could|does|is|knows|trained)\b/,
      /\b(only )?in your head\b/,
      /\bif you (retired|left|resigned|went)\b/
    ]
  },
  {
    bucket: 'EXCEPTION_HANDLING',
    cost: 90,
    patterns: [
      /\bwhat (happens|do you do)\b[^?]*\b(when|if)\b/,
      /\bwhen (it|they|something|things|a claim)\b[^?]*\b(wrong|missing|doesn'?t|don'?t|fails?|bad|illegible|unclear|mismatch)/,
      /\b(exception|edge case|odd|unusual|problem|error|mistake)s?\b/,
      /\bdoesn'?t match\b/,
      /\bcan'?t (find|match|read|tell)\b/,
      /\bhow do you (decide|know|tell)\b/,
      /\bwhat if\b/,
      /\bgoes? wrong\b/,
      /\bhard(er)? (ones?|cases?|claims?)\b/,
      /\bduplicat(e|es|ion)\b/,
      /\brepeat (claims?|copies|copy|submissions?)\b/,
      /\bsame claim twice\b/,
      /\bwhat do you do with\b/,
      /\b(ones?|claims?|cases?) that (are|give|cause|don'?t|doesn'?t)\b/,
      /\b(gives?|causes?) (you )?(trouble|problems|grief|a headache)\b/,
      /\bthe (hard|difficult|tricky|messy|awkward|odd|unusual) (ones?|claims?|cases?)\b/
    ]
  },
  {
    bucket: 'PURPOSE_ORIGIN',
    cost: 90,
    patterns: [
      /\bwhy (do|does|is|are|was|were)\b/,
      /\bwhat('s| is) (it|this|that) for\b/,
      /\bwho (set|started|created|decided|put)\b/,
      /\bwhen (did|was) (it|this|that|the \w+) (start|set up|created|introduced|begin)/,
      /\bhow (did|does) (it|this|that) (come|start|get set)/,
      /\bwhat('s| is) the (reason|purpose|point|origin)\b/,
      /\bhow long has (it|this|that)\b/,
      /\bhas (it|that|the \w+) (ever )?(happened|recurred|come up) (again|since)\b/
    ]
  },
  {
    bucket: 'DOWNSTREAM_CONSUMER',
    cost: 90,
    patterns: [
      /\bwho (reads?|uses?|looks? at|pulls?|needs?|sees?|reviews?)\b/,
      /\bwhere does (it|that|this) go\b/,
      /\bwhere does (a |the )?claim go\b/,
      /\bwhat happens (to|next|after)\b/,
      /\bafter you\b/,
      /\bgoes? (to|on to)\b/,
      /\bdownstream\b/,
      /\bever (looked at|used|pulled|opened)\b/,
      /\bhave you (ever )?seen (anyone|anybody|it)\b/
    ]
  },
  {
    bucket: 'TOOLS_SYSTEMS',
    cost: 90,
    patterns: [
      /\bwhat (system|software|tool|application|program)s?\b/,
      /\bwhere (is|are) (it|they|that|the \w+) (stored|kept|saved)\b/,
      /\b(spreadsheet|database|excel|shared drive|folder)\b/,
      /\bwhat do you (use|work in|work on)\b/,
      /\bis (it|that) on (paper|screen|a system)\b/
    ]
  },
  {
    bucket: 'VOLUME_TIMING',
    cost: 90,
    patterns: [
      /\bhow many\b/,
      /\bhow much\b/,
      /\bhow long (does|do|is|are|it)\b/,
      /\bhow often\b/,
      /\bwhat time\b/,
      /\bwhen (do|does) (it|they|the \w+) (arrive|come|go|release|leave|run)\b/,
      /\b(volume|throughput|per day|a day|each day|daily)\b/,
      /\b(batch|batches)\b[^?]*\b(size|many|big)\b/,
      /\bturnaround\b/,
      /\bhow quickly\b/
    ]
  },
  {
    bucket: 'PERSONAL_HISTORY',
    cost: 90,
    patterns: [
      /\bhow long have you (been|worked|done|had)\b/,
      /\bdo you (like|enjoy|mind)\b/,
      /\bhow (do you find|is it) (working|here)\b/,
      /\bwhat did you do before\b/,
      /\byears (here|with|at)\b/,
      /\bhow('s| is) (your )?(manager|boss)\b/
    ]
  },
  {
    bucket: 'GENERIC_DESCRIPTIVE',
    cost: 180,
    patterns: [
      /\bwhat do you do\b/,
      /\bwalk me through\b/,
      /\btell me about (your|the) (job|role|day|work|process)\b/,
      /\bdescribe (your|the) (job|role|day|work|process)\b/,
      /\bwhat('s| is) (your|the) (job|role|process)\b/,
      /\bhow does (it|this|the process) work\b/,
      /\bwhat happens here\b/,
      /\bwhat (information|details|fields) do you (enter|record|log|capture)\b/,
      /\btypical day\b/,
      /\bwhat('s| is) your day\b/
    ]
  }
];
