'use strict';
// ONE matcher for both paths: the build gate (content) and the live guard
// (student responses before reveal). Tests assert both call findHits below.

// Terms are matched on normalised text as whole words / whole phrases.
const TERMS = [
  // case companies, people, counterparties
  'global crossing', 'globalcrossing', 'gx', 'equinix', 'eqix', 'exodus',
  'asia global', 'pacific crossing', 'pihana', 'i stt', 'istt', 'stt',
  'st telemedia', 'singapore technologies', 'level 3', 'level3', 'qwest',
  'worldcom', 'crosslink', 'frontier', 'winnick', 'hindery', 'perrone',
  'excite', 'andersen', 'enron',
  // sector and era
  'internet', 'dot com', 'dotcom', 'telecom', 'telecoms', 'telecommunications',
  'telco', 'fiber', 'fibre', 'fiber optic', 'optical', 'subsea', 'undersea',
  'submarine cable', 'broadband', 'bandwidth', 'ip', 'isp', 'colocation',
  'co location', 'cabinet', 'cabinets', 'peering', 'carrier', 'carriers',
  'carrier neutral', 'data center', 'data centre', 'datacenter', 'datacentre',
  'hosting', 'web hosting', 'ibx', 'iru', 'irus', 'long distance', 'y2k',
  'millennium', 'nasdaq', 'nyse', 'september 11', '9 11', 'terrorism',
  'silicon valley', 'california', 'singapore', 'hawaii', 'bermuda',
  // currency
  'usd', 'us dollar', 'dollar', 'dollars',
];

// Years and decade words that date the period.
const PATTERNS = [
  /\b(19[89]\d|20[012]\d)\b/,      // 1980-2029 written as a bare year
  /\b(19|20)?[89]0s\b/,            // 1990s, 80s, 90s
  /\bnineties\b/, /\bnoughties\b/,
  /\bq[1-4]\s?(19|20)\d\d\b/,      // Q3 2000
];

// Gate-only: nothing in our content may point at a course, term, day or institution.
const CONTEXT_TERMS = [
  'wright state', 'wright', 'raj soin', 'wsu', 'mis 4400', 'mis 7000',
  'mis 3250', 'semester', 'course', 'syllabus', 'monday', 'tuesday',
  'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'university',
  'professor', 'dayton', 'studio',
];

function normalise(text) {
  return ' ' + String(text || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() + ' ';
}

function scan(text, terms, patterns, currency) {
  const hits = [];
  const raw = String(text || '');
  if (currency && raw.includes('$')) hits.push('$');
  const norm = normalise(raw);
  for (const t of terms) if (norm.includes(' ' + t + ' ')) hits.push(t);
  for (const p of patterns) { const m = norm.match(p); if (m) hits.push(m[0].trim()); }
  return [...new Set(hits)];
}

function findHits(text) { return scan(text, TERMS, PATTERNS, true); }
function findContextHits(text) { return scan(text, CONTEXT_TERMS, [], false); }

module.exports = { findHits, findContextHits, normalise, TERMS, CONTEXT_TERMS };
