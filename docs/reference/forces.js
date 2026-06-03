/* ============================================================
   FORCES — a modular registry for the field engine.

   The engine (field.js) owns the loop and everything conserved:
   wave binding, capture / release / supernova, formations, ripples,
   and the two-way density feedback. Each FORCE module owns ONLY the
   math that nudges one free particle, given a shared environment.
   Add a force by registering it here — the core never changes.

     window.__forces[token] = { token, label, apply(b, p, env), meta }
       b    body      { strength, range, spin, ux, uy, on, vis,
                        cx, cy, hw, hh, absorbR, maxMass, mass, ... }
       p    particle  { x, y, vx, vy, heat, cap }   ← mutate here
       env  shared    { dx, dy, dist, form, supernova, spark, W, H }
                        dx,dy = (b.cx - p.x, b.cy - p.y); dist = |·| (≥1)
                        spark(x,y,power) → throw a brief impact burst (collision feel)

     window.__conditions[name] = (b, p) => boolean
       the data-when gate — a force fires only if its condition passes.

   A body lists forces space-joined in data-body ("absorb attract"),
   so modules compose: a single element can pull AND swallow AND drag.
   ============================================================ */
(function () {
  'use strict';
  const F = (window.__forces = window.__forces || {});
  const C = (window.__conditions = window.__conditions || {});
  const def = (token, label, apply, meta) => { F[token] = { token, label, apply, meta: meta || {} }; };

  /* ---- pulls & pushes ---- */
  def('attract', 'Attract', (b, p, e) => {
    const range = b.range * (b.on ? 1.5 : 1), str = b.strength * (b.on ? 3 : 1);
    if (e.dist >= range) return;
    const f = Math.pow(1 - e.dist / range, 2) * str * 0.5;
    p.vx += e.dx / e.dist * f; p.vy += e.dy / e.dist * f;
    // tangential swirl → orbits, when the active formation asks for it
    if (e.form.orbit) { p.vx += -e.dy / e.dist * f * e.form.orbit; p.vy += e.dx / e.dist * f * e.form.orbit; }
    if (b.on) p.heat = Math.max(p.heat, (1 - e.dist / range) * 0.9);
  }, { desc: 'inverse-square gravity well' });

  def('repel', 'Repel', (b, p, e) => {
    const range = b.range * (b.on ? 1.4 : 1), str = b.strength * (b.on ? 2 : 1);
    if (e.dist >= range) return;
    const f = Math.pow(1 - e.dist / range, 2) * str * 0.5;
    p.vx -= e.dx / e.dist * f; p.vy -= e.dy / e.dist * f;
  }, { desc: 'inverse-square outward push' });

  /* ---- rotation & flow ---- */
  def('vortex', 'Vortex', (b, p, e) => {
    const range = b.range * (b.on ? 1.4 : 1), str = b.strength * (b.on ? 2 : 1);
    if (e.dist >= range) return;
    const f = Math.pow(1 - e.dist / range, 1.4) * str * 0.45, s = b.spin;
    // tangential (clockwise for spin>0), plus light inward retention so the
    // whirlpool holds shape instead of flinging matter outward
    p.vx += (e.dy / e.dist) * f * s + (e.dx / e.dist) * f * 0.12;
    p.vy += (-e.dx / e.dist) * f * s + (e.dy / e.dist) * f * 0.12;
    if (b.on) p.heat = Math.max(p.heat, (1 - e.dist / range) * 0.6);
  }, { desc: 'tangential swirl — a whirlpool' });

  def('stream', 'Stream', (b, p, e) => {
    const range = b.range * (b.on ? 1.4 : 1), str = b.strength * (b.on ? 2 : 1);
    if (e.dist >= range) return;
    const f = Math.pow(1 - e.dist / range, 1.1) * str * 0.5;
    p.vx += b.ux * f; p.vy += b.uy * f;
    if (b.on) p.heat = Math.max(p.heat, (1 - e.dist / range) * 0.5);
  }, { desc: 'directional current along a heading' });

  /* ---- viscosity (new): a body can thicken the medium ----
     bleeds momentum instead of redirecting it. on its own it calms a
     patch of swarm; paired with attract it turns a slingshot into a
     settled orbit (the docs' "orbital capture damping"). */
  def('drag', 'Drag', (b, p, e) => {
    const range = b.range * (b.on ? 1.4 : 1);
    if (e.dist >= range) return;
    const k = (1 - e.dist / range) * (0.05 + b.strength * 0.07) * (b.on ? 1.6 : 1);
    p.vx -= p.vx * k; p.vy -= p.vy * k;
  }, { desc: 'thickens the medium — bleeds momentum' });

  /* ---- emission (new): a body can be a fountain ----
     A conduit, not a source. It draws surrounding matter into its nozzle and
     relaunches it as a hot jet along a fixed heading (data-angle) — the field
     is recycled into a stream, nothing is created. */
  def('emitter', 'Emitter', (b, p, e) => {
    const range = b.range * (b.on ? 1.4 : 1);
    if (e.dist >= range) return;
    if (e.dist < 24) {
      // at the nozzle: relaunch this matter as a jet along the heading, with a cone of spread
      const sp = (Math.random() - 0.5) * 0.8, cs = Math.cos(sp), sn = Math.sin(sp);
      const hx = b.ux * cs - b.uy * sn, hy = b.ux * sn + b.uy * cs;
      const spd = 2.4 + b.strength * 2.6;
      p.vx = hx * spd; p.vy = hy * spd;
      p.x = b.cx + hx * 26; p.y = b.cy + hy * 26;   // place just past the nozzle so it streams away
      p.heat = Math.max(p.heat, 0.9);
    } else {
      // feed: gently draw surrounding matter toward the nozzle
      const f = Math.pow(1 - e.dist / range, 2) * (0.25 + b.strength * 0.15);
      p.vx += e.dx / e.dist * f; p.vy += e.dy / e.dist * f;
    }
  }, { desc: 'a fountain — draws matter in, jets it out along a heading' });

  /* ---- tether (new): a leash with a rest LENGTH ----
     Not a well. Matter is held at a preferred radius (b.range·0.6): pushed
     OUT when it crowds too close, pulled IN when it strays too far — a
     Hookean spring toward a shell, so the swarm settles into an orbiting
     ring that bounces when disturbed instead of collapsing to the core. */
  def('spring', 'Spring', (b, p, e) => {
    const rest = b.range * 0.6 * (b.on ? 1.25 : 1);
    const reach = rest * 2.1;                       // beyond this the leash lets go
    if (e.dist >= reach) return;
    const k = (0.006 + b.strength * 0.012) * (b.on ? 1.7 : 1);
    const stretch = e.dist - rest;                  // +far → reel in, −close → push off
    const ux = e.dx / e.dist, uy = e.dy / e.dist;   // unit vector toward the body
    p.vx += ux * stretch * k; p.vy += uy * stretch * k;
    p.vx *= 0.985; p.vy *= 0.985;                   // light damping → settles into the shell
    if (b.on) p.heat = Math.max(p.heat, (1 - Math.min(1, Math.abs(stretch) / rest)) * 0.5);
  }, { desc: 'a tether with a rest length — holds matter at a fixed radius' });

  /* ---- structural bodies ---- */
  def('reflect', 'Reflect', (b, p, e) => {
    const ox = Math.abs(p.x - b.cx), oy = Math.abs(p.y - b.cy), pad = 6;
    if (ox >= b.hw + pad || oy >= b.hh + pad) return;
    const speed = Math.hypot(p.vx, p.vy);           // incoming speed → collision force
    const px = b.hw + pad - ox, py = b.hh + pad - oy;
    if (px < py) { p.x = p.x < b.cx ? b.cx - b.hw - pad : b.cx + b.hw + pad; p.vx = -p.vx * 0.85; }
    else { p.y = p.y < b.cy ? b.cy - b.hh - pad : b.cy + b.hh + pad; p.vy = -p.vy * 0.85; }
    // collision feel: a hard hit throws a brief spark and a flash of heat at the point of impact
    if (speed > 0.7 && e.spark) { e.spark(p.x, p.y, Math.min(2.4, speed)); p.heat = Math.max(p.heat, Math.min(0.85, speed * 0.4)); }
  }, { desc: 'axis-aligned bouncing wall — sparks on impact' });

  def('absorb', 'Absorb', (b, p, e) => {
    if (p.cap || e.dist >= b.absorbR) return;
    p.cap = b; b.mass += 1;                  // held, not deleted — conserved
    if (b.mass >= b.maxMass) e.supernova(b); // saturate → release exactly what was held
  }, { desc: 'captures matter, then releases it' });

  /* ---- conditional gate predicates (data-when) ---- */
  C.active = (b) => b.on;
  C.fast = (b, p) => (p.vx * p.vx + p.vy * p.vy) > 0.9;
  C.slow = (b, p) => (p.vx * p.vx + p.vy * p.vy) < 0.22;
  C.hot = (b, p) => p.heat > 0.3;
  C.cool = (b, p) => p.heat < 0.08;
  C.scrolling = () => (((window.__field && window.__field._scrollV) || 0) > 0.25);
})();
