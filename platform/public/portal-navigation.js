/* URL-backed portal navigation. Only screen identifiers belong in the URL;
 * searches and scroll positions belong to the current browser history entry.
 * Restoring a route must only read data, never replay a submitted action. */
(() => {
  'use strict';
  const home = role => role === 'admin' ? '/admin.html' : role === 'faculty' ? '/faculty.html' : '/student.html';
  function safeReturn(value, role) {
    if (!value || !value.startsWith('/') || value.startsWith('//')) return home(role);
    try {
      const url = new URL(value, location.origin);
      const page = url.pathname.replace(/\.html$/, '');
      const allowed = ['/account', '/join'];
      if (role === 'admin') allowed.push('/admin', '/faculty');
      if (role === 'faculty') allowed.push('/faculty');
      if (role === 'student') allowed.push('/student', '/session');
      if (url.origin !== location.origin || !allowed.includes(page)) return home(role);
      const accountReturn = page === '/account' ? url.searchParams.get('next') : null;
      // Return destinations must not carry credentials or recursively redirect.
      for (const key of [...url.searchParams.keys()]) {
        if (/token|password|secret|^t$|^next$/i.test(key)) url.searchParams.delete(key);
      }
      if (accountReturn && !/^\/account(?:\.html)?(?:[?/#]|$)/.test(accountReturn)) {
        url.searchParams.set('next', safeReturn(accountReturn, role));
      }
      return url.pathname + url.search;
    } catch (_) { return home(role); }
  }
  function signin() {
    location.replace('/signin.html?next=' + encodeURIComponent(location.pathname + location.search));
  }
  function failure(root, error, retry, back) {
    root.replaceChildren();
    const box = document.createElement('div'); box.className = 'note'; box.style.marginTop = '30px';
    box.setAttribute('role', 'alert');
    const heading = document.createElement('h2'); heading.textContent = 'Unable to open this page';
    const message = document.createElement('p');
    message.textContent = error.status === 403 || error.status === 404
      ? 'This record is unavailable or you no longer have access to it.'
      : 'The page could not be loaded. Please try again. Your place has been kept.';
    const button = document.createElement('button'); button.className = 'btn'; button.textContent = 'Try again'; button.onclick = retry;
    box.append(heading, message, button);
    if (back) {
      const link = document.createElement('a'); link.className = 'btn'; link.href = back; link.textContent = 'Back to portal'; box.append(link);
    }
    root.append(box);
  }
  function create(config) {
    let ready = false, restoring = false, failed = false, generation = 0, intent = 'replace';
    let userId = '', lastURL = '', scrollTimer;
    const urlFor = state => {
      const params = new URLSearchParams();
      Object.entries(state).sort(([a], [b]) => a.localeCompare(b)).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '' && value !== false) params.set(key, String(value));
      });
      return location.pathname + (params.size ? '?' + params : '');
    };
    const entry = () => history.state?.portal?.userId === userId ? history.state.portal : {};
    function save(url, method, scroll) {
      const state = { portal: { userId, search: config.search ? {...config.search()} : {}, scroll: scroll ?? window.scrollY } };
      history[method + 'State'](state, '', url); lastURL = url;
    }
    function record(mode = intent) {
      if (!ready || restoring || failed) return;
      const next = urlFor(config.read());
      save(next, next !== lastURL && mode === 'push' ? 'push' : 'replace');
      document.querySelectorAll('a[href^="/account.html"]').forEach(link => {
        link.href = '/account.html?next=' + encodeURIComponent(next);
      });
    }
    async function restore() {
      const ticket = ++generation; restoring = true; failed = false;
      if (config.beforeRestore) config.beforeRestore();
      const saved = entry();
      if (config.setSearch) config.setSearch(saved.search || {});
      config.root.setAttribute('aria-busy', 'true');
      config.root.innerHTML = '<p class="hint" role="status">Loading…</p>';
      try {
        await config.restore(new URLSearchParams(location.search), () => ticket === generation);
        if (ticket !== generation) return;
        restoring = false; intent = 'replace';
        config.render(); record();
        const heading = config.root.querySelector('h1');
        if (heading) { heading.setAttribute('tabindex','-1'); heading.setAttribute('data-portal-heading',''); heading.focus({preventScroll:true}); }
        window.scrollTo(0, saved.scroll || 0);
      } catch (error) {
        if (ticket !== generation) return;
        restoring = false; failed = true;
        if (error.status === 401) return signin();
        if (!config.onError?.(error)) failure(config.root, error, restore, location.pathname);
      } finally {
        if (ticket === generation) config.root.removeAttribute('aria-busy');
      }
    }
    function go(state, replace = intent !== 'push') {
      const next = urlFor(state);
      if (next === location.pathname + location.search) return restore();
      save(location.pathname + location.search, 'replace');
      save(next, replace ? 'replace' : 'push', 0);
      return restore();
    }
    document.addEventListener('click', event => {
      intent = event.target.closest(config.navigation || '[data-tab]') ? 'push' : 'replace';
      setTimeout(() => { record(); intent = 'replace'; }, 0);
    }, true);
    window.addEventListener('pageshow', async event => {
      if (!event.persisted || !ready) return;
      try {
        const response = await fetch('/api/auth', {method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'me'})});
        if (!response.ok) throw new Error('Unable to verify session');
        const data = await response.json();
        if (!data.user) return signin();
        if (data.user.id !== userId) return location.replace(home(data.user.role));
        await restore();
      } catch (error) { failure(config.root,error,()=>location.reload()); }
    });
    window.addEventListener('popstate', () => { if (ready) restore(); });
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => { if (ready && !restoring) save(location.pathname + location.search, 'replace'); }, 120);
    }, {passive:true});
    window.addEventListener('pagehide', () => { if (ready && !restoring) save(location.pathname + location.search, 'replace'); });
    return {
      record, go, restore,
      get restoring() { return restoring; },
      get version() { return generation; },
      get failed() { return failed; },
      async start(id) { userId = id; ready = true; lastURL = location.pathname + location.search; await restore(); }
    };
  }
  function lists(params, keys) {
    const filter = {}, page = {};
    for (const key of keys) {
      const f = params.get('f_' + key); if (f && f.length < 80) filter[key] = f;
      const n = Number(params.get('p_' + key)); if (Number.isInteger(n) && n > 0) page[key] = Math.min(n, 100000);
    }
    return {filter, page};
  }
  function listState(filter, page) {
    const out = {};
    Object.entries(filter).forEach(([k,v]) => { if (v) out['f_'+k] = v; });
    Object.entries(page).forEach(([k,v]) => { if (Number(v) > 1) out['p_'+k] = v; });
    return out;
  }
  const id = (params, key) => (params.get(key) || '').slice(0, 200);
  window.PortalNavigation = {create, signin, safeReturn, failure, home, lists, listState, id};
})();
