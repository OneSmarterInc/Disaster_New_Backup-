'use strict';
// Catalogue identity for Sim-06. Registration is unpublished until an administrator publishes it.
const cfg = require('../data/config');

const META = {
  "id": "rapid-06-switch",
  "replaces": [],
  "catalogueRevision": "switch-v2-2026-09",
  "title": "Do We Switch?",
  "tagline": "One decision, taken while the reports are still arriving.",
  "description": "You run operations for a chain of twelve stores. Card payments are failing during a busy hour. Read reports and two supplier documents, then decide whether to stay with the current network provider or switch to the backup.",
  "minutes": 15,
  "detail": {
    "world": "Store operations and network outages",
    "seat": "Head of store operations at Harlow Home & Hardware",
    "teaches": "Read supplier promises carefully and explain a decision when the cause of an outage is still unclear.",
    "clock": "One store hour in a ten-minute decision window",
    "activity": "Read reports as they arrive and check the two supplier documents. Commit to staying or switching and give a short reason. If time runs out, the simulation records that you made no decision.",
    "tangle": "Waiting may cost sales, while switching also takes time. The reports are incomplete and may point in different directions.",
    "turn": "You must decide which evidence is strong enough to act on while the clock is still running.",
    "after": "Review your choice, its timing, and the explanation of the outage. There is no score.",
    "discussion": "Compare when students decided, what they had read, and why they trusted that information.",
    "sessionShape": "Allow about 15 minutes for the activity, including a ten-minute decision window. Add time to discuss the reports and supplier documents.",
    "suitableFor": "Operations management, IT continuity, and supplier management classes.",
    "preparation": "No advance reading. The supplier documents are provided in the simulation.",
    "output": "One stay-or-switch decision and a short written reason.",
    "beats": [
      {
        "at": "Read",
        "what": "Open the supplier documents and follow the incoming reports."
      },
      {
        "at": "Choose",
        "what": "Stay or switch, and explain why."
      },
      {
        "at": "Review",
        "what": "Compare your choice and timing with the case explanation."
      }
    ],
    "durationNote": "About 15 minutes, including a ten-minute decision window; discussion is extra.",
    "catalogueFacts": [
      {
        "label": "Play",
        "value": "Individual or team"
      },
      {
        "label": "Before play",
        "value": "No advance reading"
      },
      {
        "label": "Feedback",
        "value": "Review; no score"
      }
    ],
    "atAGlance": [
      {
        "label": "Main task",
        "value": "One final stay-or-switch choice"
      },
      {
        "label": "Numbers",
        "value": "Simple comparisons of time and sales"
      },
      {
        "label": "Play mode",
        "value": "Individual or team"
      }
    ],
    "tryIt": "Try the complete activity before assigning it to students.",
    "momentsIntro": ""
  }
};

module.exports = { META };
