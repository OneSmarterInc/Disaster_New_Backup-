'use strict';

const META = {
  "id": "rapidsimplus-01",
  "catalogueRevision": "claims-interview-v2",
  "replaces": [],
  "title": "Why Don't They Have Any Patience?",
  "tagline": "Three interviews. Fifteen minutes each. Every question has a cost.",
  "description": "A dental benefits administrator is replacing its claims system. You must document how claims arrive and reach the first review. Study an incomplete process chart, observe the work, interview three employees, and submit a report for the new system.",
  "minutes": 70,
  "detail": {
    "world": "Dental claims processing and a new computer system",
    "seat": "Internal process analyst",
    "clock": "A ten-minute observation and three fifteen-minute interviews",
    "teaches": "Ask clear questions, compare evidence from different people, and document a work process.",
    "tangle": "Each employee knows a different part of the work. Interview time is limited, and the wording of a question can affect the conversation.",
    "turn": "You must turn separate observations and answers into a clear account of how the process works.",
    "roomIntro": "These are the people whose views you will consider during the activity.",
    "momentsIntro": "",
    "after": "The instructor can compare the interview questions, time spent, process chart, and final report.",
    "discussion": "Compare how students' questions and interview order affected the evidence they gathered and the report they wrote.",
    "tryIt": "Try the complete activity before assigning it to students.",
    "sessionShape": "Allow up to three hours for the full class. The suggested plan uses 20 minutes for the brief, 10 for observation, 45 for interviews, 20 for the report, a 15-minute break, and 45 for discussion.",
    "cast": [
      {
        "name": "Ray Duffy",
        "role": "Claim intake",
        "stake": "Receives and releases incoming claims."
      },
      {
        "name": "Terry Voss",
        "role": "Receipt log",
        "stake": "Keeps the receipt record and handles status questions."
      },
      {
        "name": "Ruth Kessler",
        "role": "First-pass review",
        "stake": "Reviews claims before they move to the next stage."
      }
    ],
    "beats": [
      {
        "at": "Brief and observation",
        "what": "Read the incomplete process chart and observe the desk for ten minutes."
      },
      {
        "at": "Three interviews",
        "what": "Use three fifteen-minute appointments to gather evidence."
      },
      {
        "at": "Chart and report",
        "what": "Complete the process chart and write the report for the new system."
      }
    ],
    "activity": "Read the brief and incomplete chart, observe the review desk, and choose an interview order. Use three appointments to fill gaps in your process chart and write a report for the new system.",
    "suitableFor": "Systems analysis, process improvement, and requirements gathering classes.",
    "preparation": "The brief and incomplete process chart are provided. No outside research is needed.",
    "output": "A completed process chart and a report recommending how the new system should handle the work.",
    "durationNote": "About 70 minutes of play; allow additional time for the full-class brief, break, and discussion.",
    "catalogueFacts": [
      {
        "label": "Play",
        "value": "Individual"
      },
      {
        "label": "Before play",
        "value": "Brief and chart included"
      },
      {
        "label": "Feedback",
        "value": "Report and interview review"
      }
    ],
    "atAGlance": [
      {
        "label": "Main task",
        "value": "Three interviews, a process chart, and a report"
      },
      {
        "label": "Numbers",
        "value": "Record observed timing and process facts"
      },
      {
        "label": "Play mode",
        "value": "Individual"
      }
    ]
  }
};

// These IDs were used by Wexford deployments. Compatibility here preserves
// course links; it does not assert that every historical row belongs to Wexford.
const LEGACY_LAUNCH_IDS = Object.freeze(['rapid-03-bench', 'rapid-sim-03']);
const acceptsLaunchId = id => id === META.id || LEGACY_LAUNCH_IDS.includes(id);
module.exports = { META, LEGACY_LAUNCH_IDS, acceptsLaunchId };
