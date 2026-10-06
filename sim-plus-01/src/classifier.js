'use strict';

const BANK = require('../data/phrasings');

const UNMATCHED = { bucket: 'UNMATCHED', cost: 60 };

/**
 * Normalise a typed question for matching.
 * Lowercase, collapse whitespace, strip terminal punctuation, and
 * normalise curly apostrophes so /doesn'?t/ style patterns hold.
 */
function normalise(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Classify a question into an intent bucket.
 *
 * Returns { bucket, cost, matchedBy } where matchedBy is the source of
 * the winning pattern. matchedBy exists for the instructor transcript
 * view and for taxonomy debugging — it is never shown to a participant.
 *
 * The bank is ordered and first match wins. See data/phrasings.js.
 */
function classify(raw) {
  const text = normalise(raw);
  if (!text) return { ...UNMATCHED, matchedBy: null };

  for (const entry of BANK) {
    for (const pattern of entry.patterns) {
      if (pattern.test(text)) {
        return {
          bucket: entry.bucket,
          cost: entry.cost,
          matchedBy: pattern.source
        };
      }
    }
  }

  return { ...UNMATCHED, matchedBy: null };
}

module.exports = { classify, normalise };
