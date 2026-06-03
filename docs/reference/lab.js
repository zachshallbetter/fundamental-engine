/* ============================================================
   LAB — sandbox for the reciprocal field.
   Drop bodies (attract / repel / absorb / vortex / stream / drag / spring / emitter)
   onto the field, optionally gated by a condition (when fast / hot), drag them,
   remove them, switch the global formation. Each dropped chip is a real DOM
   body the engine reads — the same mechanism the site uses. Color encodes
   the force type; a live status line says what you're about to drop.
   ============================================================ */
(function () {
  'use strict';
  const F = () => window.__field;
  const nodesEl = document.getElementById('nodes');
  const hint = document.getElementById('labHint');
  const lsDot = document.getElementById('lsDot');
  const lsText = document.getElementById('lsText');
  const lsField = document.getElementById('lsField');
  const labBar = document.getElementById('labBar');
  const handleGlyph = document.getElementById('handleGlyph');
  const handleName = document.getElementById('handleName');
  // standalone sandbox (field.html, body.lab) vs embedded playground (index.html #experience)
  const standalone = document.body.classList.contains('lab');
  const expSection = document.getElementById('experience');
  // one canonical color + plain-language gloss per force
  const FORCE_SPEC = {
    attract: { label: 'Attract', color: '#4da3ff', does: 'pulls matter into a gravity well' },
    repel: { label: 'Repel', color: '#ff9d5c', does: 'pushes matter away, opening a void' },
    absorb: { label: 'Absorb', color: '#ff6e9c', does: 'swallows matter, then pops' },
    vortex: { label: 'Vortex', color: '#2dd4bf', does: 'spins matter into a whirlpool' },
    stream: { label: 'Stream', color: '#7dd3fc', does: 'blows a steady directional current' },
    drag: { label: 'Drag', color: '#8da2c0', does: 'thickens the medium, bleeding off speed' },
    spring: { label: 'Spring', color: '#86e57f', does: 'tethers matter to a fixed radius, like a leash' },
    emitter: { label: 'Emitter', color: '#a78bfa', does: 'draws matter in and jets it out as a stream' },
  };
  const COND_SPEC = { '': { label: '', suffix: '' }, fast: { label: 'when fast', suffix: ' — only on fast matter' }, hot: { label: 'when hot', suffix: ' — only on hot matter' } };
  const FORM_DESC = { ambient: 'calm drift', wells: 'tight orbits', lanes: 'sideways current', scatter: 'even spread', accretion: 'converge to a core' };
  let tool = 'attract', cond = '', count = 0, dragging = null;

  function updateStatus() {
    const s = FORCE_SPEC[tool], cs = COND_SPEC[cond] || COND_SPEC[''];
    if (labBar) labBar.style.setProperty('--fc', s.color);
    if (lsDot) lsDot.style.setProperty('--fc', s.color);
    if (lsText) lsText.innerHTML = 'Dropping <b>' + s.label + (cs.label ? ' ' + cs.label : '') + '</b> · ' + s.does + cs.suffix;
    // the handle mirrors the active brush so the collapsed pill stays informative
    if (handleGlyph) handleGlyph.className = 'g g-' + tool;
    if (handleName) handleName.textContent = s.label + (cs.label ? ' · ' + cs.label : '');
  }
  function updateField(name) {
    if (lsField) lsField.innerHTML = 'Field: <b>' + name.charAt(0).toUpperCase() + name.slice(1) + '</b> · ' + (FORM_DESC[name] || '');
  }

  // tool + condition + formation buttons
  document.querySelectorAll('#tools .brush').forEach((b) => b.addEventListener('click', () => {
    tool = b.dataset.tool;
    document.querySelectorAll('#tools .brush').forEach((x) => x.classList.toggle('on', x === b));
    updateStatus();
  }));
  document.querySelectorAll('#conds button').forEach((b) => b.addEventListener('click', () => {
    cond = b.dataset.cond;
    document.querySelectorAll('#conds button').forEach((x) => x.classList.toggle('on', x === b));
    updateStatus();
  }));
  document.querySelectorAll('#forms button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('#forms button').forEach((x) => x.classList.toggle('on', x === b));
    const f = F(); if (f && f.setFormation) f.setFormation(b.dataset.form);
    updateField(b.dataset.form);
  }));
  // expand / collapse the options drawer; the brush rail stays a small bar (persisted)
  const handle = document.getElementById('labHandle');
  if (handle && labBar) {
    const KEY = 'field-palette-expanded';
    const setExpanded = (v) => { labBar.classList.toggle('expanded', v); handle.setAttribute('aria-expanded', String(v)); try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {} };
    handle.addEventListener('click', () => setExpanded(!labBar.classList.contains('expanded')));
    setExpanded(false);   // always start closed
  }
  document.getElementById('clearBtn').addEventListener('click', () => {
    nodesEl.innerHTML = ''; count = 0; const f = F(); if (f) { f.rescan(); f.threads(null); }
    if (hint) hint.style.opacity = '';
  });
  updateStatus(); updateField('ambient');

  const TUNE = {
    attract: { body: 'attract', strength: 0.9, range: 320 },
    repel: { body: 'repel', strength: 1.1, range: 300 },
    absorb: { body: 'absorb attract', strength: 0.5, range: 300, absorb: 80, max: 40 },
    vortex: { body: 'vortex', strength: 1, range: 320, spin: 1 },
    stream: { body: 'stream', strength: 1, range: 340, angle: 0 },
    drag: { body: 'drag', strength: 1, range: 300 },
    spring: { body: 'spring', strength: 1, range: 260 },
    emitter: { body: 'emitter', strength: 1, range: 300, angle: 0 },
  };

  function drop(x, y, seed) {
    const t = TUNE[tool], color = FORCE_SPEC[tool].color;
    const chip = document.createElement('div');
    chip.className = 'node-chip';
    chip.style.left = x + 'px'; chip.style.top = y + 'px';
    chip.style.setProperty('--cc', color);
    chip.dataset.body = t.body; chip.dataset.strength = t.strength; chip.dataset.range = t.range;
    chip.dataset.color = color; chip.dataset.tool = tool;
    if (t.absorb) { chip.dataset.absorb = t.absorb; chip.dataset.max = t.max; }
    if (t.spin !== undefined) chip.dataset.spin = t.spin;
    if (t.angle !== undefined) chip.dataset.angle = t.angle;
    if (cond) chip.dataset.when = cond;
    chip.innerHTML = '<span class="tip">' + FORCE_SPEC[tool].label.toLowerCase() + (cond ? ' · when ' + cond : '') + '</span>'
      + (cond ? '<span class="badge">' + cond + '</span>' : '')
      + '<button class="chip-x" type="button" aria-label="remove body">\u00d7</button>';
    nodesEl.appendChild(chip);
    count++;
    const f = F(); if (f && f.rescan) f.rescan();
    if (f && f.ripple) f.ripple(x, y, color);
    bindChip(chip);
    if (!seed && hint) hint.style.opacity = '0';
  }

  function bindChip(chip) {
    const removeChip = () => { chip.remove(); const f = F(); if (f) { f.rescan(); f.threads(null); } };
    const wireThreads = () => {
      const others = [...nodesEl.children].filter((c) => c !== chip);
      const f = F(); if (f && f.threads) f.threads(others.map((c) => ({ a: chip, b: c, color: chip.dataset.color })));
    };
    // remove control — works on tap (touch) and click (mouse); never starts a drag or a drop
    const x = chip.querySelector('.chip-x');
    if (x) {
      x.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
      x.addEventListener('click', (e) => { e.stopPropagation(); removeChip(); });
    }
    // hover → wire threads to every other chip (pointer devices)
    chip.addEventListener('pointerenter', wireThreads);
    chip.addEventListener('pointerleave', () => { const f = F(); if (f && f.threads && !dragging) f.threads(null); });
    // drag — also wires threads on grab so touch users (no hover) see the connections
    chip.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.chip-x')) return;
      e.stopPropagation(); dragging = chip; chip.setPointerCapture(e.pointerId); wireThreads();
    });
    chip.addEventListener('pointermove', (e) => {
      if (dragging !== chip) return;
      chip.style.left = e.clientX + 'px'; chip.style.top = e.clientY + 'px';
      const f = F(); if (f && f.rescan) f.rescan();
    });
    chip.addEventListener('pointerup', (e) => { if (dragging === chip) { dragging = null; const f = F(); if (f && f.threads) f.threads(null); } });
    chip.addEventListener('dblclick', (e) => { e.stopPropagation(); removeChip(); });
  }

  // click empty field → drop. Standalone: anywhere. Embedded: only inside the
  // #experience play zone, and never on real page UI (links, buttons, nav).
  addEventListener('pointerdown', (e) => {
    if (!(e.target instanceof Element)) return;
    if (e.target.closest('.lab-bar, .lab-head, .node-chip, .tweaks-panel, #tweaks-root')) return;
    if (!standalone) {
      if (!expSection || !document.body.classList.contains('play-active')) return;
      if (e.target.closest('a, button, nav, input, textarea, [data-hot]')) return;
      const r = expSection.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) return;
    }
    drop(e.clientX, e.clientY);
  });

  // ---- shareable field: serialize the dropped bodies into the URL ----
  function serialize() {
    return [...nodesEl.children].map((c) => [c.dataset.tool || 'attract', c.dataset.when || '', (parseFloat(c.style.left) / innerWidth).toFixed(3), (parseFloat(c.style.top) / innerHeight).toFixed(3)].join(',')).join(';');
  }
  function placeSpec(t, w, fx, fy) {
    const pt = tool, pc = cond; tool = t; cond = w || ''; drop(fx * innerWidth, fy * innerHeight, true); tool = pt; cond = pc;
  }
  function loadFromHash() {
    const m = (location.hash || '').match(/f=([^&;]+)/);
    if (!m) return false;
    let any = false;
    decodeURIComponent(m[1]).split(';').forEach((s) => {
      const p = s.split(','); if (p.length < 4 || !TUNE[p[0]]) return;
      placeSpec(p[0], p[1], parseFloat(p[2]) || 0.5, parseFloat(p[3]) || 0.5); any = true;
    });
    if (any && hint) hint.style.opacity = '0';
    return any;
  }
  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) shareBtn.addEventListener('click', () => {
    const data = encodeURIComponent(serialize());
    try { history.replaceState(null, '', '#f=' + data); } catch (e) {}
    const link = location.origin + location.pathname + '#f=' + data;
    const label = count ? 'Link copied ✓' : 'Drop a body first';
    const restore = () => { shareBtn.textContent = 'Share'; shareBtn.classList.remove('on'); };
    shareBtn.textContent = label; shareBtn.classList.add('on'); setTimeout(restore, 1500);
    if (count && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).catch(() => {});
  });

  const seedAt = (name, x, y) => { const prev = tool; tool = name; drop(x, y, true); tool = prev; };

  if (standalone) {
    // sandbox page: seed a few so it's alive on arrival — or restore a shared field from the URL
    addEventListener('load', () => {
      setTimeout(() => {
        if (count) return;
        if (loadFromHash()) return;
        const cx = innerWidth / 2, cy = innerHeight / 2;
        seedAt('attract', cx - 220, cy - 40); seedAt('vortex', cx + 220, cy - 40); seedAt('drag', cx, cy + 120);
        if (hint) hint.style.opacity = '';
      }, 700);
    });
  } else if (expSection) {
    // homepage embed: reveal the palette while the play zone is in view, and seed a
    // small living field the first time the visitor actually reaches it
    let seeded = false;
    new IntersectionObserver((es) => es.forEach((en) => {
      document.body.classList.toggle('play-active', en.isIntersecting && en.intersectionRatio > 0.2);
      if (en.isIntersecting && en.intersectionRatio > 0.55 && !seeded && !count) {
        seeded = true;
        const cx = innerWidth / 2, cy = innerHeight / 2, d = Math.min(240, innerWidth * 0.22);
        seedAt('attract', cx - d, cy); seedAt('vortex', cx + d, cy);
      }
      // fully scrolled away → reset so dropped bodies never haunt the portfolio above
      if (!en.isIntersecting && count) {
        nodesEl.innerHTML = ''; count = 0; seeded = false;
        const f = F(); if (f) { f.rescan(); f.threads(null); }
      }
    }), { threshold: [0, 0.2, 0.55, 0.8] }).observe(expSection);
  }
})();
