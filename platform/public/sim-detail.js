// What a simulation's page says about it.
//
// The public catalogue and the faculty console both show this, and they used to
// be one implementation because there was only one page. Written once here so a
// change to the wording, or a new section, reaches both — two copies of a
// description drifting apart is exactly the fault we have spent a day chasing in
// other forms.
//
// `opts.forFaculty` drops the "request a preview" panel, since somebody looking
// at this from inside their own console already has access.
(function () {
  const esc = (s) => String(s == null ? '' : s)
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function simDetailHTML(s, opts) {
    const o = opts || {};
    const d = s.detail || {};
    const simLabel = RapidSimsIdentity.label(s);
    const customFacts = Array.isArray(d.catalogueFacts)
      ? d.catalogueFacts.filter(x => x && x.value).slice(0, 6)
      : [];
    const factsHTML = customFacts.length
      ? customFacts.map(x => `<span>${x.label ? esc(x.label) + ' ' : ''}<b>${esc(x.value)}</b></span>`).join('')
      : '';
    const customGlance = Array.isArray(d.atAGlance)
      ? d.atAGlance.filter(x => x && x.label && x.value).slice(0, 8)
      : [];
    const glanceHTML = customGlance.length
      ? customGlance.map(x => `<div class="line"><span>${esc(x.label)}</span><b>${esc(x.value)}</b></div>`).join('')
      : '';

    return `
    <div class="sim-head">
      <div class="eyebrow">${esc(simLabel)}${d.world ? ' · ' + esc(d.world) : ''}</div>
      <h1>${esc(s.title)}</h1>
      ${s.tagline ? `<div class="tag">${esc(s.tagline)}</div>` : ''}
      <div class="facts">
        ${s.minutes ? `<span><b>${s.minutes}</b> minutes</span>` : ''}
        ${factsHTML}
      </div>
      ${d.durationNote ? `<p class="duration-note">${esc(d.durationNote)}</p>` : ''}
    </div>

    <div class="two">
      <div class="prose">
        ${s.description ? `<h3>The situation</h3><p>${esc(s.description)}</p>` : ''}
        ${d.activity ? `<h3>What you will do</h3><p>${esc(d.activity)}</p>` : ''}
        ${d.output ? `<h3>What you will produce</h3><p>${esc(d.output)}</p>` : ''}
        ${d.tangle ? `<h3>What makes it hard</h3><p>${esc(d.tangle)}</p>` : ''}
        ${d.turn ? `<h3>Why this activity helps</h3><p>${esc(d.turn)}</p>` : ''}

        ${Array.isArray(d.cast) && d.cast.length ? `<h3>People in the case</h3>
          ${d.roomIntro ? `<p>${esc(d.roomIntro)}</p>` : ''}
          <div class="room">${d.cast.map((c) => `<div class="who">
            <div class="n">${esc(c.name)}</div>
            <div class="r">${esc(c.role)}</div>
            ${c.stake ? `<div class="x">${esc(c.stake)}</div>` : ''}
          </div>`).join('')}</div>` : ''}

        ${Array.isArray(d.beats) && d.beats.length ? `<h3>How it works</h3>
          ${d.momentsIntro ? `<p>${esc(d.momentsIntro)}</p>` : ''}
          <div class="beats">${d.beats.map((b) => `<div class="beat">
            <div class="t">${esc(b.at)}</div><p>${esc(b.what)}</p></div>`).join('')}</div>` : ''}

        ${d.after ? `<h3>Afterwards</h3><p>${esc(d.after)}</p>` : ''}
        ${d.discussion ? `<p>${esc(d.discussion)}</p>` : ''}
      </div>

      <div class="side">
        <div class="box">
          <h4>At a glance</h4>
          ${d.seat ? `<div class="line"><span>You are</span><b>${esc(d.seat)}</b></div>` : ''}
          ${d.world ? `<div class="line"><span>Setting</span><b>${esc(d.world)}</b></div>` : ''}
          ${d.clock ? `<div class="line"><span>Scenario timing</span><b>${esc(d.clock)}</b></div>` : ''}
          ${glanceHTML}
        </div>

        ${d.teaches ? `<div class="box"><h4>What you will learn</h4><p style="margin:0">${esc(d.teaches)}</p></div>` : ''}
        ${d.suitableFor ? `<div class="box"><h4>Useful for</h4><p style="margin:0">${esc(d.suitableFor)}</p></div>` : ''}
        ${d.preparation ? `<div class="box"><h4>Before you start</h4><p style="margin:0">${esc(d.preparation)}</p></div>` : ''}

        ${o.forFaculty ? '' : `<div class="box">
          <h4>Try it</h4>
          ${d.tryIt ? `<p>${esc(d.tryIt)}</p>` : ''}
          <a class="btn pri" href="mailto:support@flexee.org?subject=${encodeURIComponent('RapidSims — preview request: ' + s.title)}&body=${encodeURIComponent('I would like to try this before using it with a class.\n\nName:\nInstitution:\nCourse:\nRoughly how many students:\n')}" style="display:block;text-align:center">Request a preview</a>
          <div style="font-size:12.5px;color:var(--ink3);margin-top:10px">Already have an account?
            <a href="/signin.html">Sign in</a> and it will be listed under Simulations.</div>
        </div>`}

        ${d.sessionShape ? `<div class="box">
          <h4>Running a session</h4>
          <p style="margin:0">${esc(d.sessionShape)}</p>
        </div>` : ''}
      </div>
    </div>`;
  }

  window.simDetailHTML = simDetailHTML;
})();

// The public catalogue is rendered only after its API request completes. Native
// hash navigation therefore runs before #rapidsimPlus exists, and the catalogue's
// render function then resets the page to the top. Wait for the dynamic section
// and scroll after that render has finished, leaving enough room for the sticky
// Flexee header.
(function setupRapidSimsPlusHashNavigation() {
  if (typeof document === 'undefined') return;
  const targetHash = '#rapidsimPlus';
  let observer = null;

  function scrollToTarget() {
    if (window.location.hash !== targetHash) return false;

    const target = document.getElementById('rapidsimPlus');
    if (!target) return false;

    const header = document.querySelector('.flexee-site-header');
    const headerHeight = header ? header.getBoundingClientRect().height : 0;
    const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 18;
    window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
    return true;
  }

  function tryAfterRender() {
    window.requestAnimationFrame(() => {
      if (scrollToTarget() && observer) {
        observer.disconnect();
        observer = null;
      }
    });
  }

  function start() {
    if (window.location.hash !== targetHash) {
      window.addEventListener('hashchange', tryAfterRender);
      return;
    }

    if (scrollToTarget()) return;

    observer = new MutationObserver(tryAfterRender);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('hashchange', tryAfterRender);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
