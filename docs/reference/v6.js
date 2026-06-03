/* ============================================================
   V6 — interactions that make the layout behave like the field.
   · field-graph: draw threads between concept nodes + travelling pulses
   · writing stream: drag-scroll + progress rail
   · living spine: a fixed line that bends toward whatever you engage
   · practice formation switcher: the visitor reorganizes the field
   · contact: the absorbing finale
   Rides on top of interact.js / field.js (window.__field).
   ============================================================ */
(function () {
  'use strict';
  const F = () => window.__field;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------------- THE FIELD — thread diagram ---------------- */
  (function graph() {
    const wrap = document.getElementById('fieldGraph');
    const svg = document.getElementById('graphSvg');
    if (!wrap || !svg) return;
    const nodes = [...wrap.querySelectorAll('.gnode')];
    nodes.forEach((n, i) => n.style.setProperty('--gi', i));
    const byName = {}; nodes.forEach((n) => (byName[n.dataset.node] = n));
    const EDGES = [
      ['research', 'strategy'], ['strategy', 'interface'], ['interface', 'architecture'],
      ['architecture', 'ai'], ['ai', 'coherence'],
      ['commerce', 'coherence'], ['production', 'coherence'], ['motion', 'coherence'],
      ['strategy', 'commerce'], ['interface', 'motion'],
    ];
    const SVGNS = 'http://www.w3.org/2000/svg';
    const lines = [], pulses = [];
    EDGES.forEach((e, i) => {
      const a = byName[e[0]], b = byName[e[1]]; if (!a || !b) return;
      const ln = document.createElementNS(SVGNS, 'line');
      ln.setAttribute('class', 'graph-edge');
      const col = a.dataset.color || '#4da3ff';
      ln.style.setProperty('--ln', col);
      svg.appendChild(ln);
      const p = document.createElementNS(SVGNS, 'circle');
      p.setAttribute('class', 'graph-pulse'); p.setAttribute('r', '2.6');
      p.style.setProperty('--pc', col);
      svg.appendChild(p);
      lines.push({ ln, a, b, p, color: col }); pulses.push({ t: (i / EDGES.length), spd: 0.13 + Math.random() * 0.12 });
    });

    function center(el) {
      const r = el.getBoundingClientRect(), s = svg.getBoundingClientRect();
      return { x: r.left + r.width / 2 - s.left, y: r.top + r.height / 2 - s.top };
    }
    let geo = [];
    function measure() {
      geo = lines.map((L) => ({ a: center(L.a), b: center(L.b) }));
      lines.forEach((L, i) => {
        const g = geo[i];
        L.ln.setAttribute('x1', g.a.x); L.ln.setAttribute('y1', g.a.y);
        L.ln.setAttribute('x2', g.b.x); L.ln.setAttribute('y2', g.b.y);
      });
    }
    addEventListener('resize', measure);

    // reveal when scrolled into view
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { measure(); wrap.classList.add('in'); }
    }), { threshold: 0.2 });
    io.observe(wrap);

    // hovering a node lights its edges
    nodes.forEach((n) => {
      const set = (on) => lines.forEach((L) => {
        if (L.a === n || L.b === n) L.ln.style.strokeWidth = on ? '2.2' : '1.3';
        if (L.a === n || L.b === n) L.ln.style.opacity = on ? '1' : '';
      });
      n.addEventListener('pointerenter', () => set(true));
      n.addEventListener('pointerleave', () => set(false));
    });

    let raf, last = performance.now();
    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (wrap.classList.contains('in') && geo.length) {
        for (let i = 0; i < lines.length; i++) {
          const pu = pulses[i]; pu.t += pu.spd * dt; if (pu.t > 1) pu.t -= 1;
          const g = geo[i]; if (!g) continue;
          lines[i].p.setAttribute('cx', lerp(g.a.x, g.b.x, pu.t));
          lines[i].p.setAttribute('cy', lerp(g.a.y, g.b.y, pu.t));
        }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  })();

  /* ---------------- WRITING — drag-scroll stream + progress ---------------- */
  (function stream() {
    const el = document.getElementById('stream');
    const prog = document.getElementById('streamProg');
    if (!el) return;
    let down = false, sx = 0, sl = 0, moved = 0;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('a')) return;
      down = true; moved = 0; sx = e.clientX; sl = el.scrollLeft; el.classList.add('dragging');
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!down) return; const dx = e.clientX - sx; moved += Math.abs(dx);
      el.scrollLeft = sl - dx;
    });
    const end = () => { down = false; el.classList.remove('dragging'); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    // wheel: let vertical wheel drive horizontal when hovering the stream
    el.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { el.scrollLeft += e.deltaY; e.preventDefault(); }
    }, { passive: false });
    function upd() {
      const max = el.scrollWidth - el.clientWidth;
      const p = max > 0 ? el.scrollLeft / max : 0;
      if (prog) { const track = el.clientWidth; prog.style.transform = 'translateX(' + (p * (1 / 0.18 - 1) * 100) + '%)'; }
    }
    el.addEventListener('scroll', upd, { passive: true });
    addEventListener('resize', upd); upd();
  })();

  /* ---------------- LIVING SPINE — bends toward engaged elements ---------------- */
  (function spine() {
    const path = document.getElementById('spinePath');
    if (!path) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let xb = 44, ctrlX = 44, ctrlY = 0, tX = 44, tY = 0;
    function baseX() { return Math.max(20, Math.min(64, innerWidth * 0.05)); }
    function activeTarget() {
      const lit = document.querySelector('.lit, [data-active="1"]');
      if (!lit) return null;
      const r = lit.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    function frame() {
      xb = baseX();
      const t = activeTarget();
      const H = innerHeight;
      const wantY = t ? t.y : H * 0.5;
      const wantX = t ? xb + Math.min(220, (t.x - xb) * 0.16) : xb;
      const k = reduce ? 1 : 0.12;
      ctrlX = lerp(ctrlX, wantX, k); ctrlY = lerp(ctrlY, wantY, k);
      path.setAttribute('d', 'M ' + xb + ' 0 Q ' + ctrlX.toFixed(1) + ' ' + ctrlY.toFixed(1) + ' ' + xb + ' ' + H);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();

  /* ---------------- PRACTICE — global formation switcher ---------------- */
  (function formation() {
    const sw = document.getElementById('formSwitch');
    const caps = document.getElementById('capabilities');
    if (!sw || !caps) return;
    let manual = null;
    sw.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        sw.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        manual = b.dataset.form;
        const f = F(); if (f && f.setFormation) f.setFormation(manual);
      });
    });
    // while the practice section is in view, keep re-asserting the chosen
    // formation so interact.js's section/idle logic doesn't override it.
    let visible = false;
    new IntersectionObserver((es) => es.forEach((e) => { visible = e.isIntersecting; }), { threshold: 0.3 }).observe(caps);
    setInterval(() => {
      if (visible && manual) { const f = F(); if (f && f.setFormation) f.setFormation(manual); }
      if (!visible) manual = null;   // leaving the section hands control back
    }, 700);
  })();

  /* ---------------- STATS — count-up when scrolled into view ---------------- */
  (function counters() {
    const els = document.querySelectorAll('.stat-num .v[data-count]');
    if (!els.length) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const el = e.target, to = +el.dataset.count;
      if (reduce) { el.textContent = to; return; }
      const dur = 1200, t0 = performance.now();
      (function step(now) {
        const p = Math.min(1, (now - t0) / dur), k = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(to * k);
        if (p < 1) requestAnimationFrame(step); else el.textContent = to;
      })(t0);
    }), { threshold: 0.5 });
    els.forEach((el) => io.observe(el));
  })();

  /* ---------------- CONTACT — the absorbing finale ---------------- */
  (function absorb() {
    const sec = document.getElementById('contact');
    if (!sec) return;
    new IntersectionObserver((es) => es.forEach((e) => {
      sec.classList.toggle('pulling', e.isIntersecting && e.intersectionRatio > 0.5);
    }), { threshold: [0, 0.5, 0.9] }).observe(sec);
  })();
})();
