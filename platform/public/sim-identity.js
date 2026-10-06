// Display identities do not rename database rows or move historical records.
(function (root) {
  'use strict';
  function identity(sim) {
    const id = String(sim.sim_id || sim.id || '');
    const plus = /^rapidsimplus-(\d+)$/.exec(id);
    const legacyWexford = ['rapid-03-bench', 'rapid-sim-03'].includes(id) &&
      /Why Don[’']t They Have Any Patience\?/i.test(sim.title || '');
    if (plus || legacyWexford) return { plus: true, number: Number(plus ? plus[1] : 1) };
    const rapid = /^rapid-(\d+)-/.exec(id);
    return { plus: false, number: rapid ? Number(rapid[1]) : Number(sim.number) || null };
  }
  function number(sim) {
    const value = identity(sim);
    return value.number ? `${value.plus ? '+ ' : ''}${String(value.number).padStart(2, '0')}` : '··';
  }
  function label(sim) {
    const value = identity(sim);
    return `${value.plus ? 'RapidSim+ ' : 'RapidSim '}${value.number ? String(value.number).padStart(2, '0') : ''}`.trim();
  }
  const api = { identity, number, label };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RapidSimsIdentity = api;
})(typeof window !== 'undefined' ? window : globalThis);
