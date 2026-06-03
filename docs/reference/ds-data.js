/* ══════════════════════════════════════
   FORCES DS — CANONICAL DATA (single source of truth)
   Every view reads from here. Force identity colors are the authority;
   disciplines inherit their mapped force's color. Bright on dark.
   Loaded as plain JS before the Babel views so window.DS_* is ready.
══════════════════════════════════════ */
(function () {
  'use strict';

  /* The nine forces — id · name · canonical color · what it does ·
     the discipline it maps to · the live engine body + default attrs ·
     the real formula (from forces.js) and a one-line law. */
  window.DS_FORCES = [
    { id: 'attract', name: 'Attract', color: '#4da3ff', token: '--f-attract',
      does: 'Pulls matter into a well', discipline: 'Product strategy', verb: 'gives direction',
      formula: 'F = (1 − d / d_max)² · S', law: 'inverse-square pull, bent into a spiral',
      body: 'attract', attrs: { 'data-strength': '1', 'data-range': '300' } },
    { id: 'emitter', name: 'Emitter', color: '#a78bfa', token: '--f-emitter',
      does: 'Draws matter in, jets it out', discipline: 'AI systems', verb: 'adapts response',
      formula: 'feed: v += d̂·S   ·   nozzle: v = (cosθ, sinθ)·spd', law: 'recycles the field into a stream',
      body: 'emitter', attrs: { 'data-angle': '0', 'data-strength': '1', 'data-range': '300' } },
    { id: 'spring', name: 'Spring', color: '#86e57f', token: '--f-spring',
      does: 'Tethers matter to a radius', discipline: 'Software architecture', verb: 'gives structure',
      formula: 'v += û · (d − r_est) · k', law: 'a rest length — a leash, not a drain',
      body: 'spring', attrs: { 'data-strength': '1', 'data-range': '260' } },
    { id: 'reflect', name: 'Reflect', color: '#c4b5fd', token: '--f-reflect',
      does: 'A surface that bounces — throws sparks', discipline: 'Experience design', verb: 'the human surface',
      formula: 'v⊥ ← −Cᵣ · v⊥', law: 'elastic bounce off the bounding box',
      body: 'reflect', attrs: {} },
    { id: 'stream', name: 'Stream', color: '#7dd3fc', token: '--f-stream',
      does: 'Blows a directional current', discipline: 'Motion', verb: 'reveals motion',
      formula: 'v += (cosθ, sinθ) · S · (1 − d / d_max)', law: 'constant force along a heading',
      body: 'stream', attrs: { 'data-angle': '0', 'data-strength': '1', 'data-range': '340' } },
    { id: 'repel', name: 'Repel', color: '#ff9d5c', token: '--f-repel',
      does: 'Pushes matter away', discipline: 'Commerce', verb: 'market pressure',
      formula: 'F = −(1 − d / d_max)² · S', law: 'inverted well — carves a clean void',
      body: 'repel', attrs: { 'data-strength': '1.1', 'data-range': '300' } },
    { id: 'drag', name: 'Drag', color: '#8da2c0', token: '--f-drag',
      does: 'Thickens the medium', discipline: 'Physical production', verb: 'adds constraint',
      formula: 'v ← v · (1 − k),  k ∝ (1 − d / d_max) · S', law: 'viscosity — bleeds momentum off',
      body: 'drag', attrs: { 'data-strength': '1', 'data-range': '300' } },
    { id: 'vortex', name: 'Vortex', color: '#2dd4bf', token: '--f-vortex',
      does: 'Spins matter into a whirlpool', discipline: 'Creative technology', verb: 'spins it together',
      formula: 'v += (−d̂_y, d̂_x) · S · spin', law: 'tangential force — circles, never collapses',
      body: 'vortex', attrs: { 'data-spin': '1', 'data-strength': '1', 'data-range': '320' } },
    { id: 'absorb', name: 'Absorb', color: '#ff6e9c', token: '--f-absorb',
      does: 'Swallows matter, then pops', discipline: 'Attention', verb: 'holds, then releases',
      formula: 'scale = 1 + (M / M_max)·0.45   ·   captured = released', law: 'accretion, then supernova',
      body: 'absorb attract', attrs: { 'data-absorb': '64', 'data-max': '30', 'data-strength': '0.8', 'data-range': '360' } },
  ];

  /* The five formations — global arrangements of the whole field. */
  window.DS_FORMATIONS = [
    { id: 'ambient', t: 'Ambient', section: 'Hero', color: '#4da3ff', cue: 'resting drift',
      d: 'The resting field — gentle curl-noise drift. Nothing pulls; matter just breathes. The default everywhere.' },
    { id: 'wells', t: 'Wells', section: 'Work', color: '#2dd4bf', cue: 'matter pools',
      d: 'Matter pools into a few gravity wells. Bodies gain weight where they gather. Used beneath Work.' },
    { id: 'lanes', t: 'Lanes', section: 'Writing', color: '#ff9d5c', cue: 'a current carries',
      d: 'A directional current carries particles sideways in bands. Used beneath Writing.' },
    { id: 'scatter', t: 'Scatter', section: 'Practice', color: '#a78bfa', cue: 'energy dispersed',
      d: 'Brownian dispersal — energy without direction. Used beneath the Practice grid.' },
    { id: 'accretion', t: 'Accretion', section: 'Contact', color: '#ffce6b', cue: 'everything gathers',
      d: 'Everything gathers toward one mass. The closing pull at Contact.' },
  ];

  /* Schematic dot layouts for the formation diagrams (% coords). */
  window.DS_DOTS = {
    ambient: [[14, 24], [33, 18], [50, 28], [67, 20], [84, 26], [22, 48], [42, 52], [60, 46], [80, 50], [34, 72], [56, 68], [74, 74]],
    wells: [[24, 34], [29, 43], [19, 40], [68, 30], [73, 40], [63, 35], [47, 70], [53, 76], [43, 73], [50, 66], [27, 37], [71, 33]],
    lanes: [[10, 26], [28, 26], [46, 26], [64, 26], [82, 26], [12, 50], [32, 50], [52, 50], [72, 50], [20, 74], [44, 74], [68, 74]],
    scatter: [[14, 18], [80, 22], [40, 36], [62, 62], [22, 68], [86, 52], [50, 14], [30, 54], [70, 78], [10, 44], [54, 82], [84, 32]],
    accretion: [[50, 50], [44, 46], [56, 54], [47, 40], [59, 44], [40, 58], [31, 42], [66, 60], [35, 66], [64, 35], [26, 52], [74, 48]],
  };

  /* The full condition set the engine supports (data-when). */
  window.DS_CONDITIONS = [
    { id: '', t: 'Always', d: 'Acts on every particle, every frame — the default.', selective: false },
    { id: 'active', t: 'Active', d: 'Only while the body itself is engaged — hover, focus, or tap.', selective: false },
    { id: 'fast', t: 'Fast', d: 'Only while the page is scrolling quickly.', selective: false },
    { id: 'slow', t: 'Slow', d: 'Only while the page is calm or still.', selective: false },
    { id: 'hot', t: 'Hot', d: 'Reads each particle — grips only matter the field has already energized.', selective: true },
    { id: 'cool', t: 'Cool', d: 'Reads each particle — acts only on calm, un-energized matter.', selective: true },
    { id: 'scrolling', t: 'Scrolling', d: 'Only while the page is in motion.', selective: false },
  ];

  /* Substrate — what the field is made of, lifted from field.js / forces.js. */
  window.DS_SUBSTRATE = [
    { no: '01', t: 'Synchronization', color: '#4da3ff',
      head: 'The page and the field share one coordinate space.',
      body: 'A registry samples every body’s getBoundingClientRect() on each animation frame and maps it onto the canvas — scaled by device-pixel-ratio. Because it re-reads every frame, the invisible force fields stay locked to the visible boxes through scroll, resize, and reflow.',
      formula: 'canvasₓ = (rect.left + rect.width / 2) · DPR' },
    { no: '02', t: 'Mass & damping', color: '#86e57f',
      head: 'Particles are point-masses in a medium.',
      body: 'Each particle carries a velocity in pixels per second and a mass proportional to its size. Every frame velocity is multiplied by a friction factor, so the field behaves like a fluid — momentum bleeds off instead of accumulating forever, and the swarm settles into calm.',
      formula: 'vₜ₊₁ = vₜ · f   (f ≈ 0.95)   ·   m ∝ size' },
    { no: '03', t: 'Currents', color: '#7dd3fc',
      head: 'The waves are a flow field.',
      body: 'The layered background waves aren’t decoration. Near a wave line, particles pick up a drift vector along the slope of the curve — the derivative of the sine — so they move like debris carried down a river. It’s why the resting field feels alive with no input.',
      formula: 'slope(x) = cos(x·freq + φ)·freq·amp   ·   vₓ += slope · influence' },
  ];

  /* The IA: grouped navigation. Each group is a band of related views. */
  window.DS_NAV = [
    { group: 'Foundations', tabs: [
      { id: 'brand', label: 'Brand' }, { id: 'style', label: 'Style' }, { id: 'type', label: 'Type' } ] },
    { group: 'The Field', tabs: [
      { id: 'substrate', label: 'Substrate' }, { id: 'forces', label: 'Forces' },
      { id: 'formations', label: 'Formations' }, { id: 'lab', label: 'Lab' } ] },
    { group: 'Interface', tabs: [
      { id: 'components', label: 'Components' }, { id: 'patterns', label: 'Patterns' },
      { id: 'library', label: 'Library' }, { id: 'screens', label: 'Screens' } ] },
  ];

  /* Per-view section anchors for the breadcrumb sub-nav. */
  window.DS_SECTIONS = {
    brand: [{ id: 'b-mission', label: 'Mission' }, { id: 'b-mark', label: 'Mark' }, { id: 'b-pillars', label: 'Pillars' }, { id: 'b-voice', label: 'Voice' }, { id: 'b-wordmark', label: 'Lockups' }, { id: 'b-display', label: 'Display' }, { id: 'b-naming', label: 'Naming' }],
    style: [{ id: 'colors', label: 'Force palette' }, { id: 'disciplines', label: 'Disciplines' }, { id: 'surfaces', label: 'Surfaces' }, { id: 'ink', label: 'Ink' }, { id: 'color-use', label: 'In use' }, { id: 'spacing', label: 'Spacing' }, { id: 'radii', label: 'Radii' }, { id: 'elevation', label: 'Elevation' }],
    type: [{ id: 'type-families', label: 'Families' }, { id: 'type-weights', label: 'Weights' }, { id: 'type-scale', label: 'Scale' }, { id: 'type-examples', label: 'In use' }],
    substrate: [{ id: 'sub-intro', label: 'Substrate' }, { id: 'sub-sync', label: 'Synchronization' }, { id: 'sub-mass', label: 'Mass & damping' }, { id: 'sub-currents', label: 'Currents' }, { id: 'sub-law', label: 'Conservation' }],
    forces: [{ id: 'f-reciprocity', label: 'Reciprocity' }, { id: 'f-set', label: 'Force set' }, { id: 'f-anatomy', label: 'Anatomy' }, { id: 'f-formulas', label: 'Formulas' }, { id: 'f-drag', label: 'Drag a body' }, { id: 'f-agitate', label: 'Agitate' }, { id: 'f-absorb', label: 'Accretion' }, { id: 'f-conditions', label: 'Conditions' }, { id: 'f-threads', label: 'Threads' }, { id: 'f-feedback', label: 'Feedback' }],
    formations: [{ id: 'form-intro', label: 'Formations' }, { id: 'form-set', label: 'The set' }, { id: 'form-journey', label: 'Journey' }],
    lab: [{ id: 'lab-intro', label: 'The Lab' }, { id: 'lab-stage', label: 'Sandbox' }, { id: 'lab-tools', label: 'Tools' }],
    components: [{ id: 'comp-buttons', label: 'Buttons' }, { id: 'comp-tags', label: 'Tags' }, { id: 'comp-inputs', label: 'Inputs' }, { id: 'comp-cards', label: 'Cards' }, { id: 'comp-sizes', label: 'Sizes' }, { id: 'comp-seg', label: 'Segmented' }, { id: 'comp-badges', label: 'Status' }, { id: 'comp-stats', label: 'Stats' }, { id: 'comp-steps', label: 'Steps' }, { id: 'comp-skeleton', label: 'Loading' }, { id: 'comp-toggle', label: 'Toggles' }, { id: 'comp-tabs', label: 'Tabs' }, { id: 'comp-avatars', label: 'Avatars' }, { id: 'comp-progress', label: 'Progress' }, { id: 'comp-crumbs', label: 'Breadcrumb' }, { id: 'comp-accordion', label: 'Accordion' }, { id: 'comp-tooltip', label: 'Tooltip' }, { id: 'comp-empty', label: 'Empty' }],
    patterns: [{ id: 'p-textures', label: 'Textures' }, { id: 'p-depth', label: 'Depth' }, { id: 'p-rules', label: 'Rules' }, { id: 'p-journey', label: 'Journey' }],
    library: [{ id: 'lib-icons', label: 'Icons' }, { id: 'lib-ui', label: 'UI icons' }, { id: 'lib-motion', label: 'Motion' }, { id: 'lib-states', label: 'States' }],
    screens: [{ id: 'screen-hero', label: 'Hero' }, { id: 'screen-practice', label: 'Practice' }, { id: 'screen-work', label: 'Work' }, { id: 'screen-writing', label: 'Writing' }, { id: 'screen-contact', label: 'Contact' }, { id: 'screen-conversation', label: 'Conversation' }, { id: 'screen-dashboard', label: 'Dashboard' }, { id: 'screen-settings', label: 'Settings' }, { id: 'screen-onboarding', label: 'Onboarding' }],
  };

  /* Helpers shared across views. */
  window.DS_FORCE_BY = {};
  window.DS_FORCES.forEach(function (f) { window.DS_FORCE_BY[f.id] = f; });

  /* Legacy-shape compat list ({ f, name, c, does, maps }) for the views that
     predate the canonical schema (Brand · Style · Components · Patterns · Screens).
     Attached to window (NOT a top-level const) so every Babel script can read it
     without scope-collision risk. */
  window.FORCES = window.DS_FORCES.map(function (f) {
    return { f: f.id, name: f.name, c: f.color, does: f.does, maps: f.discipline,
      formula: f.formula, law: f.law, body: f.body, attrs: f.attrs };
  });
})();
