/* ============================================================
   FIELD v5 — a reciprocal medium.
   The page's ELEMENTS bend the field; the field's DENSITY bends the
   elements back. Particles assemble the hero name on load, migrate
   into a distinct FORMATION per section, and wire THREADS through a
   set when you engage it. The cursor never attracts — a click only
   shoves and heats nearby matter.

   Public API (window.__field):
     .setAccent(hex)            recolor accent (also driven by scroll)
     .setFormation(name)        'ambient'|'wells'|'lanes'|'scatter'|'accretion'
     .threads(list|null)        [{a:Element, b:Element, color}]
     .ripple(x,y,hex)           one expanding ring (used on hover-engage)
     .burst(x,y[,hex])          shove + heat nearby matter (no ring)
     .rescan()                  re-read DOM bodies (after layout change)
   Bodies opt in via attributes (see scanBodies):
     data-body   attract repel reflect absorb vortex stream drag spring emitter  (space-joined)
     data-spin   vortex direction/strength (±)
     data-angle  stream / emitter heading (deg)
     data-when   active|fast|slow|hot|cool|scrolling  — conditional gate on the body
   FORCE MATH lives in forces.js (window.__forces / window.__conditions),
   loaded BEFORE this file. A body's effects switch off while its element
   is scrolled off-screen (b.vis).
   ============================================================ */
(function () {
  'use strict';

  // force + condition modules (forces.js). Empty fallback keeps the
  // waves/particles alive even if the module file is missing.
  const FORCES = (window.__forces = window.__forces || {});
  const COND = (window.__conditions = window.__conditions || {});
  const env = { dx: 0, dy: 0, dist: 1, form: null, supernova: null, spark: null, W: 0, H: 0 };

  const cfg = (window.__field = Object.assign({
    waveColors: ['#4da3ff', '#2dd4bf', '#a78bfa'],
    accent: '#4da3ff',
    amplitude: 1, waveSpeed: 1, density: 1,
    darkness: 0.97, bloom: 1,
    showWaves: true, bodies: true, feedback: true,
    boot: 0,
  }, window.__field || {}));

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) cfg.boot = 1;

  const canvas = document.getElementById('field');
  const ctx = canvas.getContext('2d', { alpha: false });

  let W = 0, H = 0, DPR = 1;
  let waves = [], bound = [], free = [], ripples = [], sparks = [], glyph = [];
  let bodies = [], threads = [];
  let pullX = 0, pullY = 0, pullK = 0;   // waves bend toward the engaged element
  let scrollY = window.scrollY || 0;
  let t0 = performance.now(), frameN = 0, boundTarget = 0;

  const hex2rgb = (h) => { const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h || ''); return m ? { r: +`0x${m[1]}`, g: +`0x${m[2]}`, b: +`0x${m[3]}` } : { r: 77, g: 163, b: 255 }; };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  let waveRGB = cfg.waveColors.map(hex2rgb);
  const COOL = { r: 200, g: 224, b: 255 }, WARM = { r: 255, g: 122, b: 69 };

  /* ---------- formation presets ----------
     driftX  lateral current (lanes)
     wander  brownian scale
     orbit   tangential swirl near attractors
     spread  push toward an even scatter across the viewport
     conv    pull toward the accretion body (contact) */
  const FORMS = {
    ambient:   { driftX: 0,    wander: 1.0, orbit: 0.10, spread: 0,    conv: 0    },
    wells:     { driftX: 0,    wander: 0.7, orbit: 0.85, spread: 0,    conv: 0    },
    lanes:     { driftX: 0.55, wander: 0.5, orbit: 0,    spread: 0,    conv: 0    },
    scatter:   { driftX: 0,    wander: 1.7, orbit: 0,    spread: 0.6,  conv: 0    },
    accretion: { driftX: 0,    wander: 0.6, orbit: 0.4,  spread: 0,    conv: 0.6  },
  };
  let form = { ...FORMS.ambient };       // eased current
  let formTarget = { ...FORMS.ambient };
  cfg && (cfg._formName = 'ambient');

  /* ---------- waves (calm, autonomous) ---------- */
  const LAYERS = 5;
  function buildWaves() {
    waves = [];
    const fr = [0.24, 0.4, 0.55, 0.7, 0.85];
    for (let i = 0; i < LAYERS; i++) {
      const depth = i / (LAYERS - 1), freq = 0.0012 + i * 0.0008;
      waves.push({ baseFrac: fr[i], amp: 22 + i * 15, freq, phase: Math.random() * 6.28, speed: 0.00013 + i * 0.00009, color: waveRGB[i % waveRGB.length], depth, growth: reduceMotion ? 1 : 0, growthRate: 0.007 + freq * 1.5, dir: i % 2 ? -1 : 1, offsetY: 0, targetY: 0 });
    }
  }
  const waveYat = (w, x, time) => {
    let y = w.baseFrac * H + w.offsetY + Math.sin(x * w.freq + w.phase + time * w.speed * 1000 * cfg.waveSpeed) * w.amp * cfg.amplitude;
    if (pullK > 0.001) {                       // local bend toward an engaged element
      const dx = x - pullX, s = 260;
      const fall = Math.exp(-(dx * dx) / (2 * s * s));
      y += (pullY - y) * 0.42 * fall * pullK * (0.45 + w.depth * 0.55);
    }
    return y;
  };
  const waveSlope = (w, x, time) => Math.cos(x * w.freq + w.phase + time * w.speed * 1000 * cfg.waveSpeed) * w.amp * w.freq * cfg.amplitude;

  /* ---------- particles ---------- */
  function buildParticles() {
    bound = [];
    const per = Math.round(16 * cfg.density);
    for (let wi = 0; wi < waves.length; wi++)
      for (let k = 0; k < per; k++)
        bound.push({ wi, progress: Math.random(), phase: (Math.random() - 0.5) * 0.22 * Math.PI, size: 0.7 + Math.random() * 1.5, glow: Math.random() < 0.3, speed: (0.00035 + Math.random() * 0.0009) * (Math.random() < 0.5 ? 1 : -1) });
    free = [];
    const n = Math.round(130 * cfg.density);
    for (let i = 0; i < n; i++) free.push(newFree());
    boundTarget = bound.length;
  }
  function newFree(edge) {
    const p = { x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.18, baseSize: 0.7 + Math.random() * 1.8, tw: Math.random() * 6.28, heat: 0, gx: Math.random(), gy: Math.random(), cap: null };
    if (edge) { const s = Math.random() * 4 | 0; if (s === 0) { p.x = -8; p.y = Math.random() * H; } else if (s === 1) { p.x = W + 8; p.y = Math.random() * H; } else if (s === 2) { p.y = -8; p.x = Math.random() * W; } else { p.y = H + 8; p.x = Math.random() * W; } }
    return p;
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * DPR | 0; canvas.height = H * DPR | 0;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildWaves(); buildParticles(); scanBodies();
  }

  /* ---------- DOM bodies ---------- */
  function scanBodies() {
    bodies = [...document.querySelectorAll('[data-body]')].map((el) => {
      const ang = ((parseFloat(el.dataset.angle) || 0) * Math.PI) / 180;
      return {
        el,
        tokens: (el.dataset.body || '').split(/\s+/),
        strength: parseFloat(el.dataset.strength) || 0.5,
        range: parseFloat(el.dataset.range) || 280,
        absorbR: parseFloat(el.dataset.absorb) || 64,
        maxMass: parseFloat(el.dataset.max) || 60,
        feedback: el.hasAttribute('data-feedback'),
        fmin: parseFloat(el.dataset.fmin) || 0,
        fmax: parseFloat(el.dataset.fmax) || 0,
        opsz: el.dataset.opsz || '',
        // additional forces: vortex spin direction, stream heading
        spin: el.dataset.spin === undefined ? 1 : (parseFloat(el.dataset.spin) || 0),
        angle: ang, ux: Math.cos(ang), uy: Math.sin(ang),
        // conditional gate: '' | active | fast | slow | hot | cool
        when: el.dataset.when || '',
        mass: 0, cx: 0, cy: 0, hw: 0, hh: 0, on: false, vis: true, count: 0, d: 0,
      };
    });
    // release any captured particles so they never hold a stale body reference
    if (free) for (const p of free) if (p.cap) { p.cap = null; }
    measureBodies();
  }
  function measureBodies() {
    const margin = H * 0.15;
    for (const b of bodies) {
      const r = b.el.getBoundingClientRect();
      b.cx = r.left + r.width / 2; b.cy = r.top + r.height / 2;
      b.hw = r.width / 2; b.hh = r.height / 2;
      b.on = b.el.dataset.active === '1';
      // a body off-screen exerts no force — its section's effects switch off
      b.vis = r.bottom > -margin && r.top < H + margin && r.right > -margin && r.left < W + margin;
    }
  }

  /* ---------- conditional gate ----------
     A body can opt to act only when a condition holds (data-when).
     Predicates live in forces.js (window.__conditions); selective ones
     read each particle, so they act purely on free agents. */
  function passes(b, p) {
    const fn = COND[b.when];
    return fn ? fn(b, p) : true;
  }

  /* ---------- glyph assembly (hero name) ---------- */
  let glyphPhase = 'idle', glyphStart = 0, glyphAlpha = 1, assembledFired = false;
  function buildGlyph() {
    const host = document.querySelector('[data-glyph]');
    if (!host) { document.body.classList.add('assembled'); return; }
    cfg._needGlyph = true;
    if (reduceMotion) { document.body.classList.add('assembled'); glyphPhase = 'done'; return; }
    const lines = host.querySelectorAll('.ln');
    const targets = [];
    const oc = document.createElement('canvas'), octx = oc.getContext('2d');
    const cs = getComputedStyle(host);
    const fam = cs.fontFamily, weight = 700;
    const nodes = lines.length ? lines : [host];
    nodes.forEach((node) => {
      const r = node.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const fs = parseFloat(getComputedStyle(node).fontSize);
      const scale = Math.min(2, DPR);
      oc.width = Math.ceil(r.width * scale); oc.height = Math.ceil(r.height * scale);
      octx.setTransform(scale, 0, 0, scale, 0, 0);
      octx.clearRect(0, 0, r.width, r.height);
      octx.fillStyle = '#fff';
      octx.font = `${weight} ${fs}px ${fam}`;
      octx.textBaseline = 'middle';
      octx.fillText(node.textContent.trim(), 0, r.height / 2);
      const img = octx.getImageData(0, 0, oc.width, oc.height).data;
      const stride = Math.max(3, Math.round(fs / 26)) * scale | 0;
      for (let y = 0; y < oc.height; y += stride) {
        for (let x = 0; x < oc.width; x += stride) {
          if (img[(y * oc.width + x) * 4 + 3] > 128) {
            targets.push({ x: r.left + x / scale, y: r.top + y / scale });
          }
        }
      }
    });
    if (!targets.length) { document.body.classList.add('assembled'); glyphPhase = 'done'; return; }
    // cap & shuffle
    const CAP = 560;
    for (let i = targets.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; const t = targets[i]; targets[i] = targets[j]; targets[j] = t; }
    const chosen = targets.slice(0, CAP);
    glyph = chosen.map((t) => {
      // born in the wave band below, then rise into the word
      const sx = t.x + (Math.random() - 0.5) * W * 0.22;
      const sy = H * (0.6 + Math.random() * 0.5);
      return { sx, sy, x: sx, y: sy, tx: t.x, ty: t.y, delay: Math.random() * 1000, size: 0.8 + Math.random() * 1.1, sway: Math.random() * 6.28 };
    });
    glyphPhase = 'forming'; glyphStart = performance.now(); glyphAlpha = 1; assembledFired = false;
  }

  /* ---------- interaction ----------
     Elements are the controls. A click only shoves & heats nearby matter. */
  // a brief burst of fast-fading sparks at a point of impact — pure feel, conserved-agnostic
  function spawnSpark(x, y, power, hex) {
    if (reduceMotion || sparks.length > 260) return;
    const c = hex ? hex2rgb(hex) : WARM;
    const n = 3 + (Math.random() * (power || 1) * 3 | 0);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.28, s = 0.8 + Math.random() * (power || 1) * 1.7;
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c });
    }
  }
  function burst(x, y, hex) {
    // shoves nearby matter and heats it — no expanding ring (kept clean per request)
    for (const p of free) { if (p.cap) continue; const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy); if (d < 260 && d > 0.5) { const f = (1 - d / 260) * 4.4; p.vx += dx / d * f; p.vy += dy / d * f; p.heat = Math.min(1, p.heat + (1 - d / 260) * 1.3); } }
    // a click shakes nearby wave-bound particles loose, into free bodies
    const time = (performance.now() - t0) / 1000;
    for (let i = 0; i < bound.length; i++) {
      const bp = bound[i], bx = bp.progress * W, by = waveYat(waves[bp.wi], bx, time) + bp.phase * 32;
      const dx = bx - x, dy = by - y, d = Math.hypot(dx, dy);
      if (d < 200 && d > 0.5) { const f = (1 - d / 200) * 4; detachBound(i, dx / d * f, dy / d * f, 0.8); i--; }
    }
  }
  // convert a wave-bound particle into a free body at its current position (conserved)
  function detachBound(i, vx, vy, heat) {
    const bp = bound[i], w = waves[bp.wi];
    const time = (performance.now() - t0) / 1000;
    const x = bp.progress * W, y = waveYat(w, x, time) + bp.phase * 32;
    free.push({ x, y, vx: vx || 0, vy: vy || 0, baseSize: bp.size, tw: Math.random() * 6.28, heat: heat || 0.4, gx: Math.random(), gy: Math.random(), cap: null });
    bound[i] = bound[bound.length - 1]; bound.pop();
  }
  addEventListener('pointerdown', (e) => burst(e.clientX, e.clientY, cfg.accent), { passive: true });
  addEventListener('scroll', () => { const ny = window.scrollY || 0; cfg._scrollV = Math.min(1, Math.abs(ny - scrollY) / 50); scrollY = ny; }, { passive: true });
  let rRAF = 0; addEventListener('resize', () => { cancelAnimationFrame(rRAF); rRAF = requestAnimationFrame(resize); });

  window.__fieldSync = (c) => { if (c === 'colors') { waveRGB = cfg.waveColors.map(hex2rgb); waves.forEach((w, i) => (w.color = waveRGB[i % waveRGB.length])); } else if (c === 'density') buildParticles(); };
  // concentric ring expansion is disabled project-wide for now (didn't fit / caused lag)
  cfg.ripple = () => {};
  cfg.setAccent = (hex) => { cfg.accent = hex; };
  cfg.rescan = scanBodies;
  cfg.burst = burst;
  cfg.setFormation = (name) => { if (FORMS[name] && name !== cfg._formName) { cfg._formName = name; formTarget = FORMS[name]; } };
  cfg.threads = (list) => { threads = (list || []).map((t) => ({ a: t.a, b: t.b, c: hex2rgb(t.color || cfg.accent), seed: Math.random() * 6.28 })); };

  /* ---------- loop ---------- */
  function frame(now) {
    frameN++;
    const time = (now - t0) / 1000;
    const dt = reduceMotion ? 0 : 1;
    if (cfg.boot < 1) cfg.boot = Math.min(1, cfg.boot + 0.012);
    const boot = cfg.boot;
    if (cfg._scrollV) cfg._scrollV *= 0.9;   // scroll velocity decays toward rest
    const wander = dt && frameN % 40 === 0;
    if (dt && frameN % 6 === 0 && cfg.bodies) measureBodies();

    // waves bend toward whatever you've engaged (the old 'spine', folded in)
    let pa = null;
    for (const b of bodies) { if (b.on && b.vis) { pa = b; break; } }
    pullK = lerp(pullK, pa ? 1 : 0, 0.07);
    if (pa) { pullX = pullX ? lerp(pullX, pa.cx, 0.16) : pa.cx; pullY = pullY ? lerp(pullY, pa.cy, 0.16) : pa.cy; }

    // ease formation
    for (const k in formTarget) form[k] = lerp(form[k], formTarget[k], 0.03);

    const lift = Math.round((1 - cfg.darkness) * 20);
    ctx.fillStyle = `rgb(${5 + lift},${6 + lift},${11 + lift})`;
    ctx.fillRect(0, 0, W, H);

    /* waves */
    if (cfg.showWaves) {
      for (const w of waves) {
        if (w.growth < 1) w.growth = Math.min(1, w.growth + w.growthRate);
        w.targetY = scrollY * (0.025 + w.depth * 0.08); w.offsetY += (w.targetY - w.offsetY) * 0.04;
        const sx = w.dir > 0 ? 0 : W - w.growth * W, ex = w.dir > 0 ? w.growth * W : W, c = w.color, step = 16;
        ctx.beginPath(); ctx.moveTo(sx, waveYat(w, sx, time));
        for (let x = sx; x <= ex; x += step) ctx.lineTo(x, waveYat(w, x, time));
        ctx.lineTo(ex, H); ctx.lineTo(sx, H); ctx.closePath();
        const ty = w.baseFrac * H + w.offsetY - w.amp;
        const g = ctx.createLinearGradient(0, ty, 0, ty + 320);
        g.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${(0.11 + w.depth * 0.05) * boot})`); g.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
        ctx.fillStyle = g; ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const w of waves) {
        const sx = w.dir > 0 ? 0 : W - w.growth * W, ex = w.dir > 0 ? w.growth * W : W, c = w.color, step = 16;
        ctx.beginPath(); ctx.moveTo(sx, waveYat(w, sx, time));
        for (let x = sx; x <= ex; x += step) ctx.lineTo(x, waveYat(w, x, time));
        ctx.lineWidth = 1.2; ctx.shadowBlur = 11 * cfg.bloom; ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},0.9)`;
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${(0.3 + w.depth * 0.22) * boot})`; ctx.stroke();
      }
      ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
    }

    /* bound shimmer */
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < bound.length; i++) {
      const p = bound[i], w = waves[p.wi], c = w.color;
      p.progress += p.speed * dt; if (p.progress > 1) p.progress -= 1; else if (p.progress < 0) p.progress += 1;
      if (w.growth < 1) { const vis = p.wi % 2 === 0 ? p.progress <= w.growth : p.progress >= 1 - w.growth; if (!vis) continue; }
      const x = p.progress * W, y = waveYat(w, x, time) + p.phase * 32;
      // ANY force reaching a line particle tears it loose into a free body,
      // so it then feels the real force. (Line particles were passing through
      // everything but attract/absorb — that's why reflect missed them.)
      if (dt && cfg.bodies) {
        let broke = false;
        for (const b of bodies) {
          if (!b.vis) continue;
          if (b.when === 'active' && !b.on) continue;
          if (b.when && b.when !== 'active') continue; // selective forces act only on free agents
          const toks = b.tokens;
          const dx = b.cx - x, dy = b.cy - y, dist = Math.hypot(dx, dy) || 1;
          let kx = 0, ky = 0, hit = false;
          if (toks.indexOf('reflect') >= 0) {
            const pad = 6;
            if (Math.abs(x - b.cx) < b.hw + pad && Math.abs(y - b.cy) < b.hh + pad) {
              kx = (x < b.cx ? -1 : 1) * 1.6; ky = (y < b.cy ? -1 : 1) * 0.8; hit = true;   // shove out of the wall
            }
          }
          if (!hit && (toks.indexOf('attract') >= 0 || toks.indexOf('absorb') >= 0 || toks.indexOf('emitter') >= 0)) {
            const range = b.range * (b.on ? 1.4 : 1);
            if (dist < range * 0.8) { const k = 1.2 + (b.on ? 1.6 : 0); kx = dx / dist * k; ky = dy / dist * k; hit = true; }
          }
          if (!hit && toks.indexOf('repel') >= 0) {
            const range = b.range * (b.on ? 1.4 : 1);
            if (dist < range * 0.8) { const k = 1.2 + (b.on ? 1.2 : 0); kx = -dx / dist * k; ky = -dy / dist * k; hit = true; }
          }
          if (!hit && toks.indexOf('vortex') >= 0) {
            const range = b.range * (b.on ? 1.4 : 1);
            if (dist < range * 0.75) { kx = (dy / dist) * 1.2; ky = (-dx / dist) * 1.2; hit = true; }   // clockwise, matches the force
          }
          if (!hit && toks.indexOf('stream') >= 0) {
            const range = b.range * (b.on ? 1.4 : 1);
            if (dist < range * 0.75) { kx = b.ux * 1.3; ky = b.uy * 1.3; hit = true; }
          }
          if (hit) { detachBound(i, kx, ky, 0.5); i--; broke = true; break; }
        }
        if (broke) continue;
      }
      const tw = p.glow ? 0.6 + 0.4 * Math.sin(time * 2.2 + i) : 0.85;
      if (p.glow) { ctx.shadowBlur = 8 * cfg.bloom; ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},0.9)`; }
      ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${tw * boot})`;
      ctx.beginPath(); ctx.arc(x, y, p.size, 0, 6.28); ctx.fill();
      if (p.glow) ctx.shadowBlur = 0;
    }

    /* free agents — formation + bodies + 2-way density */
    const cx = W / 2, cy = H * 0.4, maxD = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy));
    const acc = hex2rgb(cfg.accent);
    for (const b of bodies) b.count = 0;
    // shared environment handed to every force module this frame
    env.form = form; env.supernova = supernova; env.spark = spawnSpark; env.W = W; env.H = H;
    // find the accretion target (first visible absorb body) for 'conv'
    let conv = null; if (form.conv > 0.02) { for (const b of bodies) if (b.vis && b.tokens.indexOf('absorb') >= 0) { conv = b; break; } }

    for (let i = 0; i < free.length; i++) {
      const p = free[i];
      // captured particles are held inside an absorb-core, feeding its mass,
      // until a supernova releases them — nothing is created or destroyed
      if (p.cap) {
        const b = p.cap;
        if (dt) { p.x += (b.cx - p.x) * 0.18 + (Math.random() - 0.5) * 0.6; p.y += (b.cy - p.y) * 0.18 + (Math.random() - 0.5) * 0.6; }
        ctx.fillStyle = `rgba(${acc.r},${acc.g},${acc.b},${0.55 * boot})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, 6.28); ctx.fill();
        continue;
      }
      if (dt) {
        // wave current
        let near = null, nd = 1e9;
        for (const w of waves) { const wy = waveYat(w, p.x, time); const d = Math.abs(wy - p.y); if (d < nd) { nd = d; near = w; } }
        if (near && nd < 70) { const s = waveSlope(near, p.x, time); p.vx += (near.dir * 0.035) * (1 - nd / 70); p.vy += s * 0.1 * (1 - nd / 70); }
        // lateral lane current
        if (form.driftX) p.vx += form.driftX * 0.02;
        // even scatter
        if (form.spread > 0.02) { const tx = ((p.gx + (frameN * 0.00004)) % 1) * W, ty = p.gy * H; p.vx += (tx - p.x) * 0.0006 * form.spread; p.vy += (ty - p.y) * 0.0006 * form.spread; }
        // converge to accretion node
        if (conv) { const dx = conv.cx - p.x, dy = conv.cy - p.y, d = Math.hypot(dx, dy) || 1; p.vx += dx / d * form.conv * 0.06; p.vy += dy / d * form.conv * 0.06; }
        // DOM bodies — the page's elements move the field, via force modules
        if (cfg.bodies) {
          for (const b of bodies) {
            if (!b.vis) continue;                       // off-screen section → effects off
            const dx = b.cx - p.x, dy = b.cy - p.y, dist = Math.hypot(dx, dy) || 1;
            if (b.when && !passes(b, p)) continue;
            env.dx = dx; env.dy = dy; env.dist = dist;
            const toks = b.tokens;
            for (let ti = 0; ti < toks.length; ti++) { const fr = FORCES[toks[ti]]; if (fr) fr.apply(b, p, env); }
            // density sampling for 2-way feedback (engine bookkeeping, not a force)
            if (b.feedback) { const fr = b.range * 0.5; if (dist < fr) b.count += (1 - dist / fr); }
          }
        }
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.95; p.vy *= 0.95;
        if (wander) { const wsc = 0.05 * form.wander; p.vx += (Math.random() - 0.5) * wsc; p.vy += (Math.random() - 0.5) * wsc; }
        // organic curl: a smooth flow field so the resting swarm drifts in eddies, not just periodic waves
        if (form.wander > 0.05) { const cn = (Math.sin(p.x * 0.0032 + time * 0.12) + Math.cos(p.y * 0.0034 - time * 0.15)) * 3.14159; p.vx += Math.cos(cn) * 0.013 * form.wander; p.vy += Math.sin(cn) * 0.013 * form.wander; }
        p.heat *= 0.972; p.tw += 0.02;
        if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
        // WAVE HEALING (conserved): the lines slowly reclaim only matter that is
        // ALREADY drifting near them and calm — they never vacuum the open field,
        // so a drag/quiet patch keeps its swarm. Nothing spawned, only reclaimed.
        if (!p.cap && bound.length < boundTarget && p.heat < 0.12) {
          let nwi = -1, nwd = 1e9, nwy = 0;
          for (let wi = 0; wi < waves.length; wi++) { const wy = waveYat(waves[wi], p.x, time); const dd = Math.abs(wy - p.y); if (dd < nwd) { nwd = dd; nwi = wi; nwy = wy; } }
          if (nwi >= 0 && nwd < 64) {                 // must already be near a line
            const pull = Math.min(0.012, nwd * 0.0004) * (1 - p.heat / 0.12);
            p.vy += (nwy > p.y ? pull : -pull);
            // snap home once very close, calm and slow
            if (nwd < 20 && (p.vx * p.vx + p.vy * p.vy) < 0.3 && Math.random() < 0.03) {
              bound.push({ wi: nwi, progress: p.x / W, phase: (Math.random() - 0.5) * 0.22 * Math.PI, size: p.baseSize, glow: Math.random() < 0.3, speed: (0.00035 + Math.random() * 0.0009) * (Math.random() < 0.5 ? 1 : -1) });
              free[i] = free[free.length - 1]; free.pop(); i--; continue;
            }
          }
        }
      }
      const d = Math.min(1, Math.hypot(p.x - cx, p.y - cy) / maxD), rs = d * d, h = p.heat;
      let r = COOL.r + (WARM.r - COOL.r) * rs, g = COOL.g + (WARM.g - COOL.g) * rs, b2 = COOL.b + (WARM.b - COOL.b) * rs;
      r += (acc.r - r) * h; g += (acc.g - g) * h; b2 += (acc.b - b2) * h;
      const size = p.baseSize * (1 - 0.4 * rs) + h * 2.0, tw = 0.6 + 0.4 * Math.sin(p.tw);
      if (h > 0.2) { ctx.shadowBlur = 12 * cfg.bloom * h; ctx.shadowColor = `rgba(${r | 0},${g | 0},${b2 | 0},0.95)`; }
      ctx.fillStyle = `rgba(${r | 0},${g | 0},${b2 | 0},${((0.5 - 0.3 * rs) + h * 0.5) * tw * boot})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, 6.28); ctx.fill();
      if (h > 0.2) ctx.shadowBlur = 0;
    }
    ctx.globalCompositeOperation = 'source-over';

    /* 2-way feedback: write density back into the elements */
    if (cfg.feedback) {
      for (const b of bodies) {
        if (!b.feedback) continue;
        const target = clamp(b.count / 20 + (b.on ? 0.45 : 0), 0, 1);
        b.d += (target - b.d) * 0.08;
        b.el.style.setProperty('--d', b.d.toFixed(3));
        if (b.fmax) b.el.style.fontVariationSettings = `"wght" ${Math.round(lerp(b.fmin, b.fmax, b.d))}${b.opsz ? `, "opsz" ${b.opsz}` : ''}`;
      }
    }
    // expose accretion mass so absorber elements can inflate as they fill
    for (const b of bodies) if (b.tokens.indexOf('absorb') >= 0) b.el.style.setProperty('--mass', clamp(b.mass / b.maxMass, 0, 1).toFixed(3));

    /* threads — wiring a set together when engaged */
    if (threads.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const th of threads) {
        const ra = th.a.getBoundingClientRect(), rb = th.b.getBoundingClientRect();
        const ax = ra.left + ra.width / 2, ay = ra.top + ra.height / 2, bx = rb.left + rb.width / 2, by = rb.top + rb.height / 2;
        const c = th.c;
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},0.22)`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        // traveling pulses
        for (let k = 0; k < 3; k++) {
          const tt = ((time * 0.6 + th.seed + k / 3) % 1);
          const px = lerp(ax, bx, tt), py = lerp(ay, by, tt);
          ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${(1 - tt) * 0.9})`;
          ctx.beginPath(); ctx.arc(px, py, 2.2, 0, 6.28); ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    /* ripples */
    if (ripples.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i]; rp.r += 8.5; rp.a *= 0.945; if (rp.a < 0.02) { ripples.splice(i, 1); continue; }
        const c = rp.c || acc; ctx.lineWidth = 1.2 + rp.a * 1.6;
        ctx.shadowBlur = 10 * cfg.bloom * rp.a; ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},0.8)`;
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${rp.a * 0.7})`;
        ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.r, 0, 6.28); ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'source-over';
    }

    /* sparks — short-lived impact debris (collision feel) */
    if (sparks.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx; s.y += s.vy; s.vx *= 0.9; s.vy *= 0.9; s.life *= 0.85;
        if (s.life < 0.05) { sparks.splice(i, 1); continue; }
        const c = s.c;
        ctx.shadowBlur = 6 * cfg.bloom * s.life; ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},0.9)`;
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${s.life})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, 0.6 + s.life * 1.5, 0, 6.28); ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'source-over';
    }

    /* glyph assembly overlay */
    if (glyph.length) drawGlyph(now, acc);

    requestAnimationFrame(frame);
  }

  function drawGlyph(now, acc) {
    const el = performance.now() - glyphStart;
    const FORM_MS = 2600, HOLD_MS = 4000, FADE_MS = 5800;
    if (glyphPhase === 'forming' && el > 1800 && !assembledFired) { document.body.classList.add('assembled'); assembledFired = true; }
    if (glyphPhase === 'forming' && el > FORM_MS) glyphPhase = 'hold';
    if (glyphPhase === 'hold' && el > HOLD_MS) glyphPhase = 'fade';
    if (glyphPhase === 'fade') { glyphAlpha = Math.max(0, 1 - (el - HOLD_MS) / (FADE_MS - HOLD_MS)); if (el > FADE_MS) { glyph = []; glyphPhase = 'done'; return; } }
    ctx.globalCompositeOperation = 'lighter';
    const dur = FORM_MS - 300;
    for (const gp of glyph) {
      const local = Math.max(0, el - gp.delay);
      const t = clamp(local / dur, 0, 1);
      const e = 1 - Math.pow(1 - t, 4);          // slow ease-out, settles softly
      const swayAmt = (1 - e);                     // sway fades as it arrives
      const sx = Math.sin(now / 950 + gp.sway) * swayAmt * 24;
      const sy = Math.cos(now / 1150 + gp.sway) * swayAmt * 16;
      gp.x = gp.sx + (gp.tx - gp.sx) * e + sx;
      gp.y = gp.sy + (gp.ty - gp.sy) * e + sy;
      const settle = glyphPhase !== 'forming' ? Math.sin(now / 560 + gp.tx * 0.05) * 0.6 : 0;
      const a = (0.5 * e) * glyphAlpha;            // soft, blends with the field
      ctx.fillStyle = `rgba(${acc.r + 26},${acc.g + 26},${acc.b + 26},${a})`;
      ctx.beginPath(); ctx.arc(gp.x + settle, gp.y + settle, gp.size, 0, 6.28); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function supernova(b) {
    // (ring expansion disabled) release exactly what was captured — radial, from the core. nothing spawned.
    let k = 0; const held = b.mass || 1;
    for (const p of free) {
      if (p.cap === b) {
        const ang = (k / held) * 6.28 + Math.random() * 0.3, spd = 4 + Math.random() * 3;
        p.cap = null; p.x = b.cx; p.y = b.cy; p.vx = Math.cos(ang) * spd; p.vy = Math.sin(ang) * spd; p.heat = 1; k++;
      } else {
        const dx = p.x - b.cx, dy = p.y - b.cy, d = Math.hypot(dx, dy) || 1;
        if (d < 320) { const f = (1 - d / 320) * 4; p.vx += dx / d * f; p.vy += dy / d * f; p.heat = Math.max(p.heat, 0.8); }
      }
    }
    // the blast also tears nearby wave particles off their lines
    const time = (performance.now() - t0) / 1000;
    for (let i = 0; i < bound.length; i++) {
      const bp = bound[i], bx = bp.progress * W, by = waveYat(waves[bp.wi], bx, time) + bp.phase * 32;
      const dx = bx - b.cx, dy = by - b.cy, d = Math.hypot(dx, dy);
      if (d < 320 && d > 0.5) { const f = (1 - d / 320) * 4; detachBound(i, dx / d * f, dy / d * f, 0.9); i--; }
    }
    b.mass = 0;
  }

  resize();
  // build glyph after fonts settle so metrics are correct
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(buildGlyph));
  else requestAnimationFrame(buildGlyph);
  requestAnimationFrame(frame);
})();
