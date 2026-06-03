/* ============================================================
   INTERACT v5 — conductor.
   · scroll → accent journey (bg + fg share one travelling color)
   · section → field FORMATION (the field reconfigures as you move)
   · engage an element → it activates (field swarms it), wires THREADS
     through its set, and ripples; density flows back via field.js
   · reveals · nav state. No cursor chasing, no popovers.
   ============================================================ */
(function () {
  'use strict';
  const F = () => window.__field;

  // boot
  const boot = () => document.body.classList.add('loaded');
  requestAnimationFrame(() => requestAnimationFrame(boot));
  addEventListener('load', boot); setTimeout(boot, 1400);
  // safety: ensure the glyph-assembled name is never left hidden
  setTimeout(() => document.body.classList.add('assembled'), 3000);

  // reveals
  const rObs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); rObs.unobserve(e.target); } }), { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach((r) => { const d = r.dataset.delay; if (d) r.style.transitionDelay = d + 'ms'; rObs.observe(r); });

  // ---- scroll-driven accent journey ----
  const STOPS = ['#4da3ff', '#2dd4bf', '#a78bfa', '#ff6e9c', '#ff9d5c'];
  const hex2rgb = (h) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });
  const rgb2hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
  const stops = STOPS.map(hex2rgb);
  function scrollRGB() {
    const max = (document.documentElement.scrollHeight - innerHeight) || 1;
    const p = Math.max(0, Math.min(1, scrollY / max));
    const seg = p * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(seg)), f = seg - i, a = stops[i], b = stops[i + 1];
    return { r: a.r + (b.r - a.r) * f, g: a.g + (b.g - a.g) * f, b: a.b + (b.b - a.b) * f };
  }
  let cur = hex2rgb('#4da3ff'), hover = null;
  function applyAccent() {
    const t = hover || scrollRGB();
    cur.r += (t.r - cur.r) * 0.08; cur.g += (t.g - cur.g) * 0.08; cur.b += (t.b - cur.b) * 0.08;
    const hex = rgb2hex(cur);
    document.documentElement.style.setProperty('--accent', hex);
    const f = F(); if (f && f.setAccent) f.setAccent(hex);
  }

  // ---- engagement: activate body + wire threads ----
  // pointer devices engage on hover; touch devices (no hover) engage on tap-toggle,
  // so the effect persists instead of flashing for the duration of a press.
  const onTouch = matchMedia('(hover: none)').matches;
  let engagedLeave = null;
  document.querySelectorAll('[data-hot]').forEach((el) => {
    const color = el.dataset.color;
    const group = el.closest('[data-index]');
    const enter = () => {
      el.dataset.active = '1'; el.classList.add('lit');
      if (color) { hover = hex2rgb(color); const f = F(); if (f && f.ripple) { const r = el.getBoundingClientRect(); f.ripple(r.left + r.width / 2, r.top + r.height / 2, color); } }
      if (group) {
        const sibs = [...group.querySelectorAll('[data-hot]')];
        sibs.forEach((s) => s.classList.toggle('dim', s !== el));
        // set-wiring is opt-in now (felt too busy on content sets); only groups
        // that explicitly ask for it (data-threads, e.g. the manual demo) wire up.
        if (group.hasAttribute('data-threads')) {
          const f = F(); if (f && f.threads) f.threads(sibs.filter((s) => s !== el).map((s) => ({ a: el, b: s, color: color || '#4da3ff' })));
        }
      }
    };
    const leave = () => {
      el.dataset.active = '0'; el.classList.remove('lit'); hover = null;
      if (group) group.querySelectorAll('[data-hot]').forEach((s) => s.classList.remove('dim'));
      const f = F(); if (f && f.threads) f.threads(null);
    };
    if (onTouch) {
      el.addEventListener('click', () => {
        const isMe = engagedLeave === leave;
        if (engagedLeave) { engagedLeave(); engagedLeave = null; }   // release whatever was engaged
        if (!isMe) { enter(); engagedLeave = leave; }                // engage me unless I was the one
      });
    } else {
      el.addEventListener('pointerenter', enter);
      el.addEventListener('pointerleave', leave);
    }
    el.addEventListener('focus', enter);
    el.addEventListener('blur', leave);
  });

  // ---- section → formation ----
  const SECTION_FORM = { top: 'ambient', capabilities: 'scatter', work: 'wells', writing: 'lanes', contact: 'accretion' };
  const sections = [...document.querySelectorAll('section[id], header[id]')];
  const links = new Map();
  document.querySelectorAll('.nav-links a[href^="#"]').forEach((a) => links.set(a.getAttribute('href').slice(1), a));
  const nav = document.querySelector('.nav'), cue = document.getElementById('cue');
  let lastSc = null, lastCue = null, lastForm = null;
  function onScroll() {
    const y = scrollY, sc = y > 30;
    if (sc !== lastSc && nav) { lastSc = sc; nav.classList.toggle('scrolled', sc); }
    if (cue) { const h = y > innerHeight * 0.4; if (h !== lastCue) { lastCue = h; cue.style.opacity = h ? '0' : '1'; } }
    let act = null;
    for (const s of sections) { const r = s.getBoundingClientRect(); if (r.top <= innerHeight * 0.5 && r.bottom >= innerHeight * 0.5) act = s.id; }
    links.forEach((a, id) => a.classList.toggle('active', id === act));
    const fm = SECTION_FORM[act] || 'ambient';
    if (fm !== lastForm) { lastForm = fm; const f = F(); if (f && f.setFormation) f.setFormation(fm); }
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { const f = F(); if (f && f.rescan) f.rescan(); });
  onScroll();

  // idle → the field drifts to calm 'ambient'; any input re-energizes the
  // current section's formation. Makes the field feel alive and intentional.
  let lastInput = performance.now(), idle = false;
  function reenergize() { lastInput = performance.now(); if (idle) { idle = false; lastForm = null; onScroll(); } }
  ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, reenergize, { passive: true }));
  setInterval(() => {
    if (!idle && performance.now() - lastInput > 6000) { idle = true; const f = F(); if (f && f.setFormation) f.setFormation('ambient'); }
  }, 1200);

  function loop() { applyAccent(); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
})();
