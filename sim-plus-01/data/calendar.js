'use strict';

// Availability. Three windows, one source per window, hard stops.
//
// The feasible orderings are COMPUTED from this table, not listed. If
// the calendar is edited, the set of legal paths changes with it and the
// guard will report the new count rather than silently disagreeing with
// the faculty guide.

const WINDOW_SECONDS = 900;

const WINDOWS = [
  { id: 1, label: '9:00 – 9:15' },
  { id: 2, label: '9:35 – 9:50' },
  { id: 3, label: '10:10 – 10:25' }
];

const AVAILABILITY = {
  ray: [2, 3],
  terry: [1, 2],
  ruth: [1, 3]
};

/** All orderings that satisfy the calendar. Exhaustive over 3! = 6. */
function feasibleOrderings() {
  const ids = Object.keys(AVAILABILITY);
  const out = [];
  const permute = (rest, acc) => {
    if (!rest.length) return out.push([...acc]);
    for (const id of rest) {
      const windowId = WINDOWS[acc.length].id;
      if (!AVAILABILITY[id].includes(windowId)) continue;
      acc.push(id);
      permute(rest.filter((r) => r !== id), acc);
      acc.pop();
    }
  };
  permute(ids, []);
  return out;
}

function isFeasible(order) {
  return feasibleOrderings().some(
    (o) => o.length === order.length && o.every((id, i) => id === order[i])
  );
}

module.exports = { WINDOW_SECONDS, WINDOWS, AVAILABILITY, feasibleOrderings, isFeasible };
