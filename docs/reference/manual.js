/* ============================================================
   MANUAL — interactive demonstrators for the Field Manual.
   Reuses the global engine (window.__field). Thread/lit/dim and
   the accent journey are handled by interact.js; this file adds
   drag, the accretion mass meter, "agitate" bursts, and per-section
   formation cues.
   ============================================================ */
(function () {
  'use strict';
  const F = () => window.__field;

  // draggable bodies — moving the element moves the force in the field
  document.querySelectorAll('[data-drag]').forEach((el) => {
    const stage = el.closest('.stage') || document.body;
    let drag = false;
    el.addEventListener('pointerdown', (e) => { drag = true; el.setPointerCapture(e.pointerId); e.preventDefault(); });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const r = stage.getBoundingClientRect();
      el.style.left = (e.clientX - r.left) + 'px';
      el.style.top = (e.clientY - r.top) + 'px';
      const f = F(); if (f && f.rescan) f.rescan();
    });
    const stop = () => { drag = false; };
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
  });

  // accretion mass meter — reads --mass the engine writes onto the core
  const cores = [...document.querySelectorAll('.body-core')];
  function meterTick() {
    cores.forEach((c) => {
      const m = parseFloat(getComputedStyle(c).getPropertyValue('--mass')) || 0;
      const stage = c.closest('.stage'); const bar = stage && stage.querySelector('.meter > i');
      if (bar) bar.style.width = (m * 100).toFixed(1) + '%';
    });
    requestAnimationFrame(meterTick);
  }
  if (cores.length) requestAnimationFrame(meterTick);

  // agitate — a discrete burst (shoves existing particles; spawns nothing)
  document.querySelectorAll('[data-agitate]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = document.querySelector(btn.dataset.agitate) || btn;
      const r = t.getBoundingClientRect();
      const cc = getComputedStyle(t).getPropertyValue('--cc').trim() || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4da3ff';
      const f = F(); if (f && f.burst) f.burst(r.left + r.width / 2, r.top + r.height / 2, cc);
      // one-shot kick on the chip
      if (t.classList.contains('body-chip')) { t.classList.remove('agitated'); void t.offsetWidth; t.classList.add('agitated'); setTimeout(() => t.classList.remove('agitated'), 520); }
      // a shockwave ring rendered in the stage
      const stage = t.closest('.stage');
      if (stage) {
        const sr = stage.getBoundingClientRect();
        const s = document.createElement('div'); s.className = 'shock';
        s.style.left = (r.left + r.width / 2 - sr.left) + 'px';
        s.style.top = (r.top + r.height / 2 - sr.top) + 'px';
        s.style.setProperty('--cc', cc);
        stage.appendChild(s); setTimeout(() => s.remove(), 760);
      }
    });
  });

  // formation switcher (section 13) — drives the global field directly
  const FORM_DESC = {
    ambient: 'Ambient — calm brownian drift, the resting state.',
    wells: 'Wells — tight tangential orbits gather around attractors.',
    lanes: 'Lanes — a steady lateral current combs matter sideways.',
    scatter: 'Scatter — an even spread pushes particles to fill the field.',
    accretion: 'Accretion — everything converges toward a single core.',
  };
  const pills = document.getElementById('formPills');
  if (pills) {
    const nameEl = document.getElementById('form-name');
    const descEl = document.getElementById('form-desc');
    const setActive = (name) => {
      pills.querySelectorAll('.form-pill').forEach((x) => x.classList.toggle('on', x.dataset.form === name));
      if (nameEl) nameEl.textContent = name;
      if (descEl && FORM_DESC[name]) descEl.textContent = FORM_DESC[name];
    };
    pills.querySelectorAll('.form-pill').forEach((b) => b.addEventListener('click', () => {
      const name = b.dataset.form, f = F();
      if (f && f.setFormation) f.setFormation(name);
      setActive(name);
    }));
    // sync the controls to whatever formation the field is in when this section arrives
    const sec = document.getElementById('formations');
    if (sec) new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting && e.intersectionRatio > 0.5) setActive((window.__field && window.__field._formName) || 'ambient');
    }), { threshold: [0.5] }).observe(sec);
  }

  // per-section formation cue
  const fObs = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting && e.intersectionRatio > 0.5) {
      const fm = e.target.dataset.form, f = F();
      if (fm && f && f.setFormation) f.setFormation(fm);
    }
  }), { threshold: [0.5] });
  document.querySelectorAll('.concept[data-form]').forEach((c) => fObs.observe(c));

  // chapter rail — highlight the chapter you're reading
  const railLinks = [...document.querySelectorAll('.chapter-rail a')];
  if (railLinks.length) {
    const chapEls = railLinks.map((a) => document.getElementById(a.dataset.ch)).filter(Boolean);
    let lastActive = null;
    const syncRail = () => {
      const mark = innerHeight * 0.35;
      let active = chapEls[0];
      for (const el of chapEls) { if (el.getBoundingClientRect().top <= mark) active = el; }
      const id = active && active.id;
      if (id === lastActive) return;
      lastActive = id;
      railLinks.forEach((a) => a.classList.toggle('active', a.dataset.ch === id));
    };
    addEventListener('scroll', syncRail, { passive: true });
    syncRail();
  }
})();
