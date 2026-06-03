/* ══════════════════════════════════════
   FORCES MARK — live particle builder.
   window.buildForcesMark(hostEl, { size, color }) → stop()
   A solid central body with bodies + dust orbiting it, each glowing by
   size, drawn on a canvas that fills a square host. Inherits a colour
   (hex or a CSS var like 'var(--accent)'); particles take an on-brand
   palette. Bodies float on top, cores are opaque, nothing clips.
══════════════════════════════════════ */
(function () {
  'use strict';
  const VBW = 441.4, VBH = 421.5, CX = 230.4, CY = 210.9;

  function resolveColor(c) {
    if (!c) return '#4da3ff';
    if (c.indexOf('var(') === 0) {
      const name = c.slice(4, -1).trim();
      return (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#4da3ff');
    }
    return c;
  }
  const clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  const hex2rgb = function (h) { const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h); return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 77, g: 163, b: 255 }; };
  const coreCol = function (h, r) { const c = hex2rgb(h), b = 0.5 + clamp01(r / 80) * 0.5; return 'rgb(' + Math.round(c.r * b) + ',' + Math.round(c.g * b) + ',' + Math.round(c.b * b) + ')'; };
  const glowOf = function (r) { return Math.min(46, r * 0.6); };
  const glowA = function (r) { return 0.18 + clamp01(r / 80) * 0.64; };
  const BOUND = 186;
  const maxRad = function (r) { return Math.max(0, BOUND - r - glowOf(r)); };

  window.buildForcesMark = function (host, opts) {
    opts = opts || {};
    const size = opts.size || 120;
    const color = resolveColor(opts.color || '#4da3ff');
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    host.style.position = 'relative';
    const cv = document.createElement('canvas');
    cv.width = Math.round(size * DPR); cv.height = Math.round(size * DPR);
    cv.style.cssText = 'position:absolute;inset:0;width:' + size + 'px;height:' + size + 'px';
    host.appendChild(cv);
    const ctx = cv.getContext('2d');
    const s_ = (size * DPR) / VBW;
    const oy = (size * DPR - VBH * s_) / 2;
    ctx.setTransform(s_, 0, 0, s_, 0, oy);

    const PAL = [color, color, '#7dd3fc', '#a78bfa', '#2dd4bf', '#86e57f', '#ff9d5c'];
    const pick = function () { return PAL[Math.floor(Math.random() * PAL.length)]; };

    const bodyDefs = [
      { r: 80, rad: 4, ang: 0, col: color },
      { r: 36, rad: 999, ang: 1.05, col: color },
      { r: 30, rad: 120, ang: 2.7, col: '#7dd3fc' },
      { r: 22, rad: 116, ang: -2.0, col: '#a78bfa' },
      { r: 16, rad: 108, ang: 4.2, col: '#2dd4bf' },
    ];
    const bodies = bodyDefs.map(function (b, i) {
      return { rad: Math.min(b.rad, i === 0 ? 8 : maxRad(b.r)), ang: b.ang, ry: 0.97, rot: 0, r: b.r,
        sp: (0.0016 + i * 0.0005) * (i % 2 ? 1 : -1), ph: Math.random() * 6.28, c: b.col, core: coreCol(b.col, b.r) };
    });
    const dust = [];
    for (let i = 0; i < 42; i++) {
      const r = 2 + Math.pow(Math.random(), 2.4) * 12; const col = pick();
      dust.push({
        rad: Math.min(102 + Math.random() * 106, maxRad(r)), ang: Math.random() * 6.28, ry: 0.7 + Math.random() * 0.3,
        rot: Math.random() * 6.28, r: r,
        sp: (0.003 + Math.random() * 0.006) * (Math.random() < 0.5 ? 1 : -1), ph: Math.random() * 6.28, c: col, core: coreCol(col, r),
      });
    }
    const order = bodies.concat(dust).sort(function (a, b) { return a.r - b.r; });

    let raf, vis = true;
    const io = new IntersectionObserver(function (es) { es.forEach(function (e) { vis = e.isIntersecting; }); }); io.observe(cv);

    function draw(o, now) {
      o.ang += o.sp;
      const ex = Math.cos(o.ang) * o.rad, ey = Math.sin(o.ang) * o.rad * o.ry;
      const cs = Math.cos(o.rot), sn = Math.sin(o.rot);
      const x = CX + ex * cs - ey * sn, y = CY + ex * sn + ey * cs;
      const tw = 0.72 + 0.28 * Math.sin(now * 0.0026 + o.ph);
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = o.c; ctx.shadowBlur = glowOf(o.r);
      ctx.globalAlpha = glowA(o.r) * tw;
      ctx.beginPath(); ctx.arc(x, y, o.r, 0, 6.28); ctx.fillStyle = o.c; ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(x, y, o.r, 0, 6.28); ctx.fillStyle = o.core; ctx.fill();
    }
    function frame() {
      ctx.clearRect(-4, -oy / s_ - 4, VBW + 8, VBH + oy / s_ * 2 + 8);
      if (vis) {
        const now = performance.now();
        for (const o of order) draw(o, now);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      raf = requestAnimationFrame(frame);
    }
    frame();

    return function stop() { cancelAnimationFrame(raf); io.disconnect(); if (cv.parentNode) cv.parentNode.removeChild(cv); };
  };
})();
