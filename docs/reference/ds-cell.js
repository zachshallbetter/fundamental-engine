/* ══════════════════════════════════════
   FIELD CELL — a self-contained particle field that renders into ANY
   canvas at its container's size. Independent of the page background, so
   forces & formations can be shown IN-FRAME, above content, at any
   dimensions. Plain JS: window.makeFieldCell(canvas, opts) → instance.
══════════════════════════════════════ */
(function () {
  'use strict';
  const hex = (h) => { const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h || ''); return m ? { r: +('0x' + m[1]), g: +('0x' + m[2]), b: +('0x' + m[3]) } : { r: 77, g: 163, b: 255 }; };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.makeFieldCell = function (canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0, parts = [], raf = 0, running = true, visible = true, t = 0;
    let mode = opts.force || opts.formation || 'attract';
    let kind = opts.formation ? 'formation' : 'force';
    let color = hex(opts.color || '#4da3ff');
    let count = opts.count || 70;
    const ptr = { x: -999, y: -999, on: false };

    function resize() {
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    function seed() {
      parts = [];
      for (let i = 0; i < count; i++) parts.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 2.4, vy: (Math.random() - 0.5) * 2.4, r: 0.6 + Math.random() * 1.5, s: Math.random() * 6.28 });
    }
    // formation well centres (fractions of W,H)
    const WELLS = [[0.28, 0.42], [0.7, 0.34], [0.5, 0.72]];
    const LANES = [0.28, 0.5, 0.72];

    function step() {
      t += 0.016;
      const cx = W / 2, cy = H / 2, reach = Math.min(W, H) * 0.62;
      for (const p of parts) {
        let ax = 0, ay = 0, damp = 0.95;
        if (kind === 'force') {
          const dx = cx - p.x, dy = cy - p.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
          const fall = Math.max(0, 1 - d / reach);
          if (mode === 'attract') { ax += ux * fall * 0.55; ay += uy * fall * 0.55; }
          else if (mode === 'repel') { ax -= ux * fall * 0.6; ay -= uy * fall * 0.6; }
          else if (mode === 'vortex') { ax += -uy * fall * 0.8 + ux * fall * 0.12; ay += ux * fall * 0.8 + uy * fall * 0.12; }
          else if (mode === 'stream') { ax += 0.16; ay += Math.sin(p.y * 0.05 + t) * 0.03; }
          else if (mode === 'spring') { const k = (d - reach * 0.42) * 0.012; ax += ux * k; ay += uy * k; }
          else if (mode === 'drag') { ax += Math.cos(p.y * 0.03 + t) * 0.06; ay += Math.sin(p.x * 0.03 + t) * 0.06; damp = 0.8; }
          else if (mode === 'emitter') { ax += -ux * 0.42; ay += -uy * 0.42; }
          else if (mode === 'absorb') { ax += ux * fall * 0.75; ay += uy * fall * 0.75; if (d < 7) { p.x = Math.random() * W; p.y = -4; p.vx = p.vy = 0; } }
          else if (mode === 'reflect') { damp = 1; }
        } else {
          if (mode === 'ambient') { ax += Math.cos(p.y * 0.02 + t) * 0.05; ay += Math.sin(p.x * 0.02 + t * 0.8) * 0.05; damp = 0.92; }
          else if (mode === 'wells') { let bx = 0, by = 0, bd = 1e9; for (const w of WELLS) { const wx = w[0] * W, wy = w[1] * H, dd = Math.hypot(wx - p.x, wy - p.y); if (dd < bd) { bd = dd; bx = wx; by = wy; } } const d = bd || 1; ax += (bx - p.x) / d * 0.5; ay += (by - p.y) / d * 0.5; }
          else if (mode === 'lanes') { let ty = LANES[0] * H, bd = 1e9; for (const l of LANES) { const ly = l * H, dd = Math.abs(ly - p.y); if (dd < bd) { bd = dd; ty = ly; } } ay += (ty - p.y) * 0.04; ax += 0.14; }
          else if (mode === 'scatter') { ax += (Math.random() - 0.5) * 0.5; ay += (Math.random() - 0.5) * 0.5; damp = 0.9; }
          else if (mode === 'accretion') { const dx = cx - p.x, dy = cy - p.y, d = Math.hypot(dx, dy) || 1; ax += dx / d * 0.5; ay += dy / d * 0.5; ax += -dy / d * 0.18; ay += dx / d * 0.18; }
        }
        if (ptr.on) { const dx = p.x - ptr.x, dy = p.y - ptr.y, d = Math.hypot(dx, dy); if (d < 80 && d > 0.5) { const f = (1 - d / 80) * 1.8; ax += dx / d * f; ay += dy / d * f; } }
        p.vx = (p.vx + ax) * damp; p.vy = (p.vy + ay) * damp;
        p.x += p.vx; p.y += p.vy;
        if (mode === 'reflect') {
          if (p.x < p.r) { p.x = p.r; p.vx = Math.abs(p.vx) || 0.6; }
          else if (p.x > W - p.r) { p.x = W - p.r; p.vx = -(Math.abs(p.vx) || 0.6); }
          if (p.y < p.r) { p.y = p.r; p.vy = Math.abs(p.vy) || 0.6; }
          else if (p.y > H - p.r) { p.y = H - p.r; p.vy = -(Math.abs(p.vy) || 0.6); }
        } else if (mode === 'emitter') {
          if (p.x < -2 || p.x > W + 2 || p.y < -2 || p.y > H + 2) { p.x = cx; p.y = cy; const a = Math.random() * 6.28; p.vx = Math.cos(a) * 1.7; p.vy = Math.sin(a) * 1.7; }
        } else {
          if (p.x < -4) p.x = W + 4; else if (p.x > W + 4) p.x = -4;
          if (p.y < -4) p.y = H + 4; else if (p.y > H + 4) p.y = -4;
        }
      }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      if (kind === 'force') {
        const cx = W / 2, cy = H / 2;
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 6.28);
        ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},0.9)`; ctx.fill();
      }
      for (const p of parts) {
        const sp = Math.min(0.6, Math.hypot(p.vx, p.vy) * 0.32);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28);
        ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${0.32 + sp})`; ctx.fill();
      }
    }
    function loop() { if (!running) return; if (visible) { if (!reduce) step(); draw(); } raf = requestAnimationFrame(loop); }

    const ro = new ResizeObserver(() => { resize(); }); ro.observe(canvas);
    const io = new IntersectionObserver((es) => es.forEach((e) => { visible = e.isIntersecting; }), { threshold: 0 }); io.observe(canvas);
    const onMove = (e) => { const r = canvas.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.on = true; };
    const onLeave = () => { ptr.on = false; };
    canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerleave', onLeave);

    resize(); seed(); loop();
    return {
      set(o) { let ch = false; if (o.force && (kind !== 'force' || mode !== o.force)) { kind = 'force'; mode = o.force; ch = true; } if (o.formation && (kind !== 'formation' || mode !== o.formation)) { kind = 'formation'; mode = o.formation; ch = true; } if (o.color) color = hex(o.color); if (ch) seed(); },
      reset() { seed(); },
      destroy() { running = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerleave', onLeave); },
    };
  };
})();
