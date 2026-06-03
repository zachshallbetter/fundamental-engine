/* ══════════════════════════════════════
   FORCES DS — INTERACTIONS (gated by the Reciprocal Field toggle)
   Ports interact.js (accent journey · engagement · threads) and
   manual.js (draggable bodies · agitate bursts · accretion meter)
   into the design system. Everything is OFF until the field is set
   live from the top bar. Default: off, persisted in localStorage.
   Exposes window.DSInteractions { setLive, toggle, isLive, rescan }.
══════════════════════════════════════ */
(function () {
  'use strict';
  const F = () => window.__field;
  const KEY = 'ds-field-live';
  let live = false;
  const listeners = new Set();

  /* ---------- accent journey (scroll + hover), only while live ---------- */
  const STOPS = ['#4da3ff', '#a78bfa', '#86e57f', '#7dd3fc', '#ff9d5c', '#2dd4bf', '#ff6e9c'];
  const DEFAULT = '#4da3ff';
  const hex2rgb = (h) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });
  const rgb2hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
  const stops = STOPS.map(hex2rgb);
  let cur = hex2rgb(DEFAULT), hover = null;

  function scrollRGB() {
    const max = (document.documentElement.scrollHeight - innerHeight) || 1;
    const p = Math.max(0, Math.min(1, scrollY / max));
    const seg = p * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(seg)), f = seg - i, a = stops[i], b = stops[i + 1];
    return { r: a.r + (b.r - a.r) * f, g: a.g + (b.g - a.g) * f, b: a.b + (b.b - a.b) * f };
  }
  function setAccent(hex) {
    document.documentElement.style.setProperty('--accent', hex);
    document.documentElement.style.setProperty('--accent-soft', 'color-mix(in srgb,' + hex + ' 13%, transparent)');
    const f = F(); if (f && f.setAccent) f.setAccent(hex);
  }
  function loop() {
    if (live) {
      const t = hover || scrollRGB();
      cur.r += (t.r - cur.r) * 0.08; cur.g += (t.g - cur.g) * 0.08; cur.b += (t.b - cur.b) * 0.08;
      setAccent(rgb2hex(cur));
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ---------- engagement: light a body, dim siblings, wire threads ---------- */
  function bindHot(root) {
    (root || document).querySelectorAll('[data-hot]:not([data-bound])').forEach((el) => {
      el.dataset.bound = '1';
      const color = el.dataset.color;
      const group = el.closest('[data-index]');
      const enter = () => {
        if (!live) return;
        el.dataset.active = '1'; el.classList.add('lit');
        if (color) { hover = hex2rgb(color); }
        if (group) {
          const sibs = [...group.querySelectorAll('[data-hot]')];
          sibs.forEach((s) => s.classList.toggle('dim', s !== el));
          if (group.hasAttribute('data-threads')) {
            const f = F(); if (f && f.threads) f.threads(sibs.filter((s) => s !== el).map((s) => ({ a: el, b: s, color: color || DEFAULT })));
          }
        }
      };
      const leave = () => {
        el.dataset.active = '0'; el.classList.remove('lit'); hover = null;
        if (group) group.querySelectorAll('[data-hot]').forEach((s) => s.classList.remove('dim'));
        const f = F(); if (f && f.threads) f.threads(null);
      };
      el.addEventListener('pointerenter', enter);
      el.addEventListener('pointerleave', leave);
      el.addEventListener('focus', enter);
      el.addEventListener('blur', leave);
    });
  }

  /* ---------- draggable bodies — move the element, move the force ---------- */
  function bindDrag(root) {
    (root || document).querySelectorAll('[data-drag]:not([data-bounddrag])').forEach((el) => {
      el.dataset.bounddrag = '1';
      const stage = el.closest('.demo-stage') || el.closest('.cell-frame') || el.parentElement;
      let drag = false;
      el.addEventListener('pointerdown', (e) => {
        if (!live) return;
        drag = true; el.setPointerCapture(e.pointerId); el.classList.add('dragging'); e.preventDefault();
      });
      el.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const r = stage.getBoundingClientRect();
        const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
        const y = Math.max(0, Math.min(r.height, e.clientY - r.top));
        el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = 'translate(-50%,-50%)';
        const f = F(); if (f && f.rescan) f.rescan();
      });
      const end = () => { drag = false; el.classList.remove('dragging'); };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    });
  }

  /* ---------- agitate — a discrete burst that shoves nearby matter ---------- */
  function bindAgitate(root) {
    (root || document).querySelectorAll('[data-agitate]:not([data-boundag])').forEach((btn) => {
      btn.dataset.boundag = '1';
      btn.addEventListener('click', () => {
        if (!live) { pulseHint(); return; }
        const t = document.querySelector(btn.dataset.agitate) || btn;
        const r = t.getBoundingClientRect();
        const cc = (getComputedStyle(t).getPropertyValue('--cc') || getComputedStyle(t).getPropertyValue('--cat')).trim()
          || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || DEFAULT;
        const f = F(); if (f && f.burst) f.burst(r.left + r.width / 2, r.top + r.height / 2, cc);
        if (t.classList.contains('body-chip')) { t.classList.remove('agitated'); void t.offsetWidth; t.classList.add('agitated'); setTimeout(() => t.classList.remove('agitated'), 520); }
        const stage = t.closest('.demo-stage');
        if (stage) {
          const ring = document.createElement('span'); ring.className = 'shockwave';
          ring.style.left = (r.left + r.width / 2 - stage.getBoundingClientRect().left) + 'px';
          ring.style.top = (r.top + r.height / 2 - stage.getBoundingClientRect().top) + 'px';
          ring.style.setProperty('--cc', cc); stage.appendChild(ring);
          setTimeout(() => ring.remove(), 720);
        }
      });
    });
  }

  /* ---------- accretion meter — read --mass the engine writes on a core ---------- */
  let meterCores = [];
  function bindMeter(root) {
    meterCores = [...document.querySelectorAll('.body-core')];
  }
  function meterTick() {
    for (const c of meterCores) {
      const m = parseFloat(getComputedStyle(c).getPropertyValue('--mass')) || 0;
      const stage = c.closest('.demo-stage'); const bar = stage && stage.querySelector('.meter > i');
      if (bar) bar.style.width = (Math.min(1, m) * 100).toFixed(1) + '%';
    }
    requestAnimationFrame(meterTick);
  }
  requestAnimationFrame(meterTick);

  /* a subtle flash on the top-bar toggle when the user tries to interact while off */
  function pulseHint() {
    const t = document.querySelector('.field-toggle');
    if (!t) return; t.classList.remove('nudge'); void t.offsetWidth; t.classList.add('nudge');
    setTimeout(() => t.classList.remove('nudge'), 700);
  }

  /* ---------- public surface ---------- */
  function bindAll(root) { bindHot(root); bindDrag(root); bindAgitate(root); bindMeter(root); }

  function setLive(v) {
    live = !!v;
    try { localStorage.setItem(KEY, live ? '1' : '0'); } catch (e) {}
    document.body.classList.toggle('field-live', live);
    const f = F();
    if (live) { if (f && f.rescan) f.rescan(); }
    else {
      cur = hex2rgb(DEFAULT); setAccent(DEFAULT);
      if (f && f.threads) f.threads(null);
      document.querySelectorAll('[data-hot]').forEach((s) => { s.classList.remove('lit', 'dim'); s.dataset.active = '0'; });
    }
    listeners.forEach((fn) => { try { fn(live); } catch (e) {} });
  }

  window.DSInteractions = {
    setLive,
    toggle() { setLive(!live); },
    isLive() { return live; },
    rescan(root) { bindAll(root); const f = F(); if (live && f && f.rescan) f.rescan(); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };

  // initial state (default OFF), re-read persisted choice
  let initial = false;
  try { initial = localStorage.getItem(KEY) === '1'; } catch (e) {}
  document.addEventListener('DOMContentLoaded', () => bindAll());
  bindAll();
  setLive(initial);
})();
