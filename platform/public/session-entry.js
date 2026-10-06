// Account entry lives on the platform origin, where the existing sign-in cookie
// is available. Only /api/launch decides entitlement and issues launch tokens.
(() => {
  'use strict';
  const app = document.getElementById('app');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const q = new URLSearchParams(location.search);
  const sim = q.get('sim') || '';
  const sessionTitles = {
    'rapid-03-midland': 'Midland Equipment',
    'rapid-04-whose-number': 'Whose Number Is Right?',
    'rapid-05-approve': 'Would You Approve This?',
    'rapid-06-switch': 'Do We Switch?',
    'rapid-07-bought': 'Would You Have Bought It?',
    'rapid-08-later': 'Eighteen Months Later',
    'rapid-09-money-land': 'Where Does the Money Land?',
    'rapid-10-bubble': 'Infrastructure or Bubble?'
  };
  const session = (q.get('session') || '').trim().toUpperCase();
  const courseId = q.get('course') || '';
  let course = null, joinCode = '', me = null;
  let releaseTimer = null, entering = false;
  function stopReleaseCheck() { clearTimeout(releaseTimer); releaseTimer = null; }
  async function api(path, payload) {
    const response = await fetch(path, payload === undefined ? { credentials: 'same-origin' } : {
      method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || data.error || 'Unable to continue. Please try again.');
      error.data = data; error.status = response.status; throw error;
    }
    return data;
  }
  function heading() {
    return `<div class="eyebrow" style="margin-top:40px">Flexee RapidSims · class session</div>
      <h1>Join <em>${esc(sessionTitles[sim] || 'this simulation')}</em></h1>
      <p class="lede">${course ? esc(course.title) + ' · ' : ''}Session ${esc(session)}</p>`;
  }
  function showError(error) {
    stopReleaseCheck();
    app.innerHTML = heading() + `<div class="card"><h2>${esc(error.data?.title || 'Unable to open this session')}</h2>
      <p>${esc(error.message)}</p><button class="btn pri" id="retry">Try again</button>
      <p><a href="/student.html">Back to my courses</a></p></div>`;
    document.getElementById('retry').onclick = start;
  }
  function waitForRelease(error) {
    app.innerHTML = heading() + `<div class="card" id="waiting-release"><h2>Waiting on your instructor</h2>
      <p>Your enrolment is confirmed. Your name is listed under Course enrolment on the faculty session screen.</p>
      <p>Your instructor must release your course access before you can join the simulation. This page will continue automatically once access is released.</p>
      <button class="btn pri" id="retry">Check again</button><p class="tiny dim">No simulation access code is needed.</p></div>`;
    document.getElementById('retry').onclick = () => enter();
    releaseTimer = setTimeout(() => enter(true), 5000);
  }
  async function enter(silent = false) {
    if (entering) return;
    entering = true;
    stopReleaseCheck();
    const params = new URLSearchParams({ sim, session, format:'json' });
    if (courseId) params.set('course', courseId);
    if (!silent) app.innerHTML = heading() + '<p class="lede">Opening your session…</p>';
    try {
      const data = await api('/api/launch?' + params);
      // Destination comes from the server's registered simulation, not a return
      // URL supplied by a caller. Never accept arbitrary redirect parameters.
      location.replace(data.url);
    } catch (error) {
      if (error.status === 403 && error.data?.title === 'Waiting on your instructor') return waitForRelease(error);
      if (error.status === 401) { me = null; return accountForm('signin'); }
      if (error.status === 403 && error.data?.title === 'Not enrolled' && joinCode) {
        app.innerHTML = heading() + `<div class="card"><p>You're signed in as <b>${esc(me.name)}</b>.
          Join this course to continue. Your instructor still controls when simulation access is released.</p>
          <button class="btn pri" id="enrol">Join this course</button><div class="err" id="err"></div></div>`;
        document.getElementById('enrol').onclick = async () => {
          document.getElementById('enrol').disabled = true;
          try { await api('/api/student', { action:'enrol', joinCode }); await enter(); }
          catch (e) { showError(e); }
        };
        return;
      }
      showError(error);
    } finally { entering = false; }
  }
  function accountForm(mode = 'signup') {
    stopReleaseCheck();
    const signup = mode === 'signup';
    app.innerHTML = heading() + `<p class="lede">${signup ? 'Create your student account to join this session.' : 'Sign in with your existing RapidSims account.'}</p>
      <form class="card" id="account-form">
        ${signup && !joinCode ? '<div class="field"><label class="f" for="course-code">Course code</label><input id="course-code" required autocomplete="off"><p class="tiny dim">This older session link has no course attached. Enter the course code from your instructor.</p></div>' : ''}
        ${signup ? '<div class="field"><label class="f" for="name">Your name</label><input id="name" required autocomplete="name"></div>' : ''}
        <div class="field"><label class="f" for="email">Email</label><input id="email" type="email" required autocomplete="username"></div>
        <div class="field"><label class="f" for="password">${signup ? 'Choose a password' : 'Password'}</label>
          <input id="password" type="password" required ${signup ? 'minlength="8" autocomplete="new-password"' : 'autocomplete="current-password"'}></div>
        <button class="btn pri" id="continue" type="submit">${signup ? 'Create account and join' : 'Sign in and join'}</button>
        <div class="err" id="err" role="alert"></div>
      </form>
      <p>${signup ? 'Already have an account?' : 'New to RapidSims?'} <button class="btn" id="switch-account">${signup ? 'Sign in' : 'Create account'}</button></p>
      <p class="tiny dim">Your instructor controls enrolment and access release. No simulation access code is needed.</p>`;
    document.getElementById('switch-account').onclick = () => accountForm(signup ? 'signin' : 'signup');
    document.getElementById('account-form').onsubmit = async event => {
      event.preventDefault();
      const btn = document.getElementById('continue'); btn.disabled = true;
      document.getElementById('err').textContent = '';
      try {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        let data;
        if (signup) {
          const code = joinCode || document.getElementById('course-code').value.trim().toUpperCase();
          data = await api('/api/student', { action:'signup_and_enrol', joinCode:code,
            name:document.getElementById('name').value, email, password });
        } else data = await api('/api/auth', { action:'signin', email, password });
        me = data.user;
        if (me.role !== 'student') return wrongRole();
        await enter();
      } catch (error) {
        document.getElementById('err').textContent = error.message;
        btn.disabled = false;
      }
    };
  }
  function wrongRole() {
    app.innerHTML = heading() + '<div class="card"><p>This is a student session link. Sign out of the facilitator account to use a student account.</p><button class="btn" id="signout">Use a student account</button></div>';
    document.getElementById('signout').onclick = async () => {
      try { await api('/api/auth', { action:'signout' }); me = null; accountForm(); }
      catch (error) { showError(error); }
    };
  }
  async function start() {
    if (!Object.hasOwn(sessionTitles, sim) || !/^[A-Z2-9]{5}$/.test(session)) {
      app.innerHTML = '<h1>Invalid session link</h1><p>Ask your instructor to copy the session link again.</p>'; return;
    }
    try {
      if (courseId) {
        const data = await api('/api/student', { action:'course_lookup', courseId, simId:sim });
        course = data.course; joinCode = course.join_code;
      }
      me = (await api('/api/auth', { action:'me' })).user;
      if (me) return me.role === 'student' ? enter() : wrongRole();
      accountForm();
    } catch (error) { showError(error); }
  }
  window.addEventListener('pagehide', stopReleaseCheck);
  start();
})();
