/**
 * The Field Manual catalog — the *complete, public-facing definition* of every force
 * in the system: its family, token, the per-frame formula (transcribed from
 * `docs/forces-system.md` §6/§20.3/§20.10), the `data-*` attributes it reads, and a
 * one-line description.
 *
 * This is the single source the UI renders (the manual on forces-ui.com) and the
 * shared reference for developers. A test cross-checks it against the registered
 * force arrays, so the catalog can never silently fall out of sync with the engine —
 * every force the engine knows has a definition here, and vice versa.
 */

/** Which register a force belongs to (§20.1). */
export type ForceFamily = 'canonical' | 'natural' | 'extended';

/** One force's complete definition for the manual. */
export interface ManualEntry {
  family: ForceFamily;
  /** the `data-body` token. */
  token: string;
  /** display name. */
  label: string;
  /** the per-frame law, in plain text. */
  formula: string;
  /** the `data-*` attribute suffixes it reads (without the `data-` prefix). */
  attrs: readonly string[];
  /** one-line description. */
  desc: string;
  /** the force's canonical accent colour (§20.2 reconciliation). */
  color: string;
  /** a one-line real-world use — what you'd reach for this force to do in a UI. */
  example: string;
}

/**
 * The canonical colour for every registered force (§20.2 reconciliation). The nine
 * mirror `forces.config.ts`; the designed-extended forces take the §20.2 registry
 * colours; the §20.10 natural primitives (added after that table) get principled,
 * clash-free accents. A test pins the nine to `FORCE_BY` so they can't drift.
 */
export const FORCE_COLORS: Record<string, string> = {
  // canonical nine — mirror the force palette (forces.config.ts)
  attract: '#4da3ff',
  repel: '#ff9d5c',
  vortex: '#2dd4bf',
  stream: '#7dd3fc',
  drag: '#8da2c0',
  emitter: '#a78bfa',
  spring: '#86e57f',
  reflect: '#c4b5fd',
  absorb: '#ff6e9c',
  // natural primitives (§20.10)
  gravity: '#6366f1',
  charge: '#60a5fa',
  magnetism: '#c084fc',
  thermal: '#fb923c',
  collide: '#cbd5e1',
  diffuse: '#a3e635', // the pheromone field (§20.2 'pheromone')
  propagate: '#5eead4',
  memory: '#c9a27e', // worn paths — a faded sepia
  // designed-extended forces (§20.2 registry colours)
  lens: '#67e8f9',
  gate: '#fb7185',
  buoyancy: '#fcd34d',
  shear: '#818cf8',
  crystallize: '#93c5fd',
  align: '#fbbf24',
  wind: '#38bdf8',
  cohesion: '#34d399',
  pressure: '#5eead4',
  hunt: '#ef4444',
  spawn: '#fb923c',
  resonate: '#f0abfc',
  spotlight: '#facc15',
  pigment: '#d6529e', // ink — conserved colour transport
};

/**
 * A one-line real-world use for each force — the spirit of the original manual's
 * "real use example" captions (the canonical nine are adapted from them; the rest
 * are authored). The UI renders this alongside a live demo of the force.
 */
export const FORCE_EXAMPLES: Record<string, string> = {
  // canonical nine
  attract: 'A hero word that pulls the field into orbit around it.',
  repel: 'A dismiss control that opens a clean void in the field.',
  vortex: 'A loading state that spins the field into a whirlpool.',
  stream: 'A scroll cue that combs the field downwind like a current.',
  drag: 'A modal backdrop the field thickens behind — motion settles.',
  emitter: 'A call-to-action that draws matter in and jets it back out.',
  spring: 'A pinned element the field tethers to at a rest radius.',
  reflect: 'A card the field bounces off — a wall that sparks on impact.',
  absorb: 'A cart that accretes matter, then releases it on checkout (a supernova).',
  // natural primitives
  gravity: 'A heavy headline with a true 1/d² pull — a real well.',
  charge: 'Two states that demix charged matter into +/− domains.',
  magnetism: 'A region that curves moving charge into cyclotron arcs.',
  thermal: 'A "hot" badge that agitates the field with Brownian heat.',
  collide: 'A dense cluster where particles ricochet like billiards.',
  diffuse: 'A trail particles lay down and follow — stigmergy.',
  propagate: 'A button that fires a real shock wave across the field.',
  memory: 'A frequently-used path that wears in and starts pulling harder.',
  // designed-extended
  lens: 'A link that bends a passing flow into caustics — no capture.',
  gate: 'A one-way membrane: matter passes through but not back.',
  buoyancy: 'A feed where light/hot items rise and dense ones settle.',
  shear: 'A divider with laminar flow — layers slide past each other.',
  crystallize: 'A "cool" section where matter snaps onto a lattice.',
  align: 'A nav where particles flock to a shared heading.',
  wind: 'A hero with divergence-free turbulence drifting through it.',
  cohesion: 'A tag group that behaves like a droplet — a swarm with a skin.',
  pressure: 'A dense cluster that relaxes to an even fill, like a settling fluid.',
  hunt: 'A two-species swarm that chases and scatters — a living ecosystem.',
  spawn: 'A nozzle that jets matter into the field — a literal fountain or a star seeding the void.',
  resonate: 'Pair with attract: a well that breathes (pulsing strength).',
  spotlight: 'Pair with stream: a directed beam confined to a cone.',
  pigment: 'A section that stains passing matter its own colour, carried away.',
};

/** Every force, in catalog order. The UI groups these by `family`. */
const FORCES_RAW: readonly Omit<ManualEntry, 'color' | 'example'>[] = [
  // ── canonical nine (§6) ──────────────────────────────────────────────────────
  {
    family: 'canonical',
    token: 'attract',
    label: 'Attract',
    formula: 'v += û · (1 − d/r)² · S · 0.5   (+ orbital swirl)',
    attrs: ['strength', 'range'],
    desc: 'a soft gravity-like well, optionally bent into a spiral',
  },
  {
    family: 'canonical',
    token: 'repel',
    label: 'Repel',
    formula: 'v −= û · (1 − d/r)² · S · 0.5',
    attrs: ['strength', 'range'],
    desc: 'soft outward push — carves a void',
  },
  {
    family: 'canonical',
    token: 'vortex',
    label: 'Vortex',
    formula: 'v += û⊥ · (1 − d/r)^1.4 · S · 0.45 · spin   (+ 0.12 inward)',
    attrs: ['strength', 'range', 'spin'],
    desc: 'tangential swirl with light inward retention — a whirlpool',
  },
  {
    family: 'canonical',
    token: 'stream',
    label: 'Stream',
    formula: 'v += ĥ · (1 − d/r)^1.1 · S · 0.5',
    attrs: ['strength', 'range', 'angle'],
    desc: 'a steady directional current along a heading',
  },
  {
    family: 'canonical',
    token: 'drag',
    label: 'Drag',
    formula: 'v −= v · (1 − d/r) · (0.05 + 0.07·S)',
    attrs: ['strength', 'range'],
    desc: 'viscosity — thickens the medium, bleeding momentum',
  },
  {
    family: 'canonical',
    token: 'emitter',
    label: 'Emitter',
    formula: 'feed: v += û·(1 − d/r)²·(0.25 + 0.15·S);  at the nozzle (<24px): relaunch as a jet',
    attrs: ['strength', 'range', 'angle'],
    desc: 'a conduit — draws matter in, jets it out along a heading',
  },
  {
    family: 'canonical',
    token: 'spring',
    label: 'Spring',
    formula: 'v += û · (d − rest) · k · 0.985,  rest = 0.6·r',
    attrs: ['strength', 'range'],
    desc: 'a tether with a rest length — holds matter at a shell radius',
  },
  {
    family: 'canonical',
    token: 'reflect',
    label: 'Reflect',
    formula: 'inside box: push out the shallower axis, v_axis ← −0.85·v_axis',
    attrs: [],
    desc: 'an axis-aligned bouncing wall — sparks on hard impact',
  },
  {
    family: 'canonical',
    token: 'absorb',
    label: 'Absorb',
    formula: 'capture within absorbR; at capacity, release everything (supernova)',
    attrs: ['absorb', 'max'],
    desc: 'captures matter, holds it (conserved), then releases it',
  },

  // ── natural primitives (§20.10) ──────────────────────────────────────────────
  {
    family: 'natural',
    token: 'gravity',
    label: 'Gravity',
    formula: 'F = G·M·d̂ / (d² + ε²),  ε = r_s = 2GM/c²;  |v| ≤ c',
    attrs: ['strength', 'range'],
    desc: 'true softened inverse-square — a real 1/d² law',
  },
  {
    family: 'natural',
    token: 'charge',
    label: 'Charge',
    formula: 'F = −σ·q·GM·d̂ / (d² + ε²)',
    attrs: ['strength', 'range', 'spin'],
    desc: 'the signed sibling of gravity — like repels, opposite attracts',
  },
  {
    family: 'natural',
    token: 'magnetism',
    label: 'Magnetism',
    formula: 'F = q·B·(−v_y, v_x)',
    attrs: ['strength', 'range', 'spin'],
    desc: 'the Lorentz force — curves a moving charge, doing no work',
  },
  {
    family: 'natural',
    token: 'thermal',
    label: 'Thermal',
    formula: 'v += √(2T) · ξ,  ξ ~ N(0,1) per axis',
    attrs: ['strength', 'range'],
    desc: 'Langevin/Brownian agitation — a real temperature in the medium',
  },
  {
    family: 'natural',
    token: 'collide',
    label: 'Collide',
    formula: 'overlapping, approaching discs exchange normal momentum (e = S)',
    attrs: ['strength', 'range'],
    desc: 'elastic pairwise collision — the hard-sphere billiard force',
  },
  {
    family: 'natural',
    token: 'diffuse',
    label: 'Diffuse',
    formula: 'deposit φ; v += ∇φ · S;  field blurs ∂φ/∂t = D∇²φ',
    attrs: ['strength', 'range'],
    desc: 'a pheromone field — deposit a mark and follow the diffused gradient',
  },
  {
    family: 'natural',
    token: 'propagate',
    label: 'Propagate',
    formula: 'inject φ at the source; v += ∇φ · S;  ∂²φ/∂t² = c²∇²φ',
    attrs: ['strength', 'range'],
    desc: 'a travelling wave — particles ride the expanding front',
  },
  {
    family: 'natural',
    token: 'memory',
    label: 'Memory',
    formula: 'M(x) += λ where matter sits;  v += û · (1 − d/r)² · S · (1 + μ·M)',
    attrs: ['strength', 'range'],
    desc: 'the field remembers — occupancy wears in paths that pull harder',
  },

  // ── designed extended forces (§20.3) ─────────────────────────────────────────
  {
    family: 'extended',
    token: 'lens',
    label: 'Lens',
    formula: 'v ← rotate(v, θ_max · (1 − d/r) · sign)',
    attrs: ['strength', 'range', 'spin'],
    desc: 'rotates velocity, preserving speed — bends paths without adding energy',
  },
  {
    family: 'extended',
    token: 'gate',
    label: 'Gate',
    formula: 'if v·n < 0:  v −= 2(v·n)·n',
    attrs: ['angle'],
    desc: 'a one-way membrane — passes along its heading, reflects the reverse',
  },
  {
    family: 'extended',
    token: 'buoyancy',
    label: 'Buoyancy',
    formula: 'v_y −= (ρ_med − ρ_p)·g,  ρ_p = base / (size·(1 + heat))',
    attrs: ['strength', 'range'],
    desc: 'a constant lift/sink by density — light matter rises, dense settles',
  },
  {
    family: 'extended',
    token: 'shear',
    label: 'Shear',
    formula: 'v∥ += S · (offset⊥ / r) · (1 − d/r)',
    attrs: ['strength', 'range', 'angle'],
    desc: 'a laminar velocity gradient — flow grows with perpendicular offset',
  },
  {
    family: 'extended',
    token: 'crystallize',
    label: 'Crystallize',
    formula: 'if heat < ½:  v += (node − p)·k;  v *= 0.9',
    attrs: ['strength', 'range'],
    desc: 'snaps cool matter onto a lattice; melts and frees it when hot',
  },
  {
    family: 'extended',
    token: 'align',
    label: 'Align',
    formula: 'v += (ĥ·|v| − v)·k,  ĥ = neighbour-mean heading (or the body heading)',
    attrs: ['strength', 'range', 'angle'],
    desc: 'steers toward a heading, preserving speed — flock alignment',
  },
  {
    family: 'extended',
    token: 'wind',
    label: 'Wind',
    formula: 'v += curl(ψ)·S,  ψ = sin(x·s + t)·cos(y·s − t)',
    attrs: ['strength', 'range'],
    desc: 'divergence-free curl-noise turbulence',
  },
  {
    family: 'extended',
    token: 'cohesion',
    label: 'Cohesion',
    formula: 'neighbours: push if d < r₀, pull if r₀ < d < r₁',
    attrs: ['strength', 'range'],
    desc: 'short-range pressure + mid-range pull — surface tension',
  },
  {
    family: 'extended',
    token: 'pressure',
    label: 'Pressure',
    formula: 'ρ = Σ W(d, h);  v += −k·(ρ − ρ₀)·∇W  (push down the density gradient)',
    attrs: ['strength', 'range'],
    desc: 'SPH density relaxation — incompressible even-fill via mutual repulsion',
  },
  {
    family: 'extended',
    token: 'hunt',
    label: 'Hunt',
    formula: 'predator: v += seek(nearest prey)·S;  prey: v += flee(nearest predator)·S',
    attrs: ['strength', 'range'],
    desc: 'two-species pursuit — predators seek prey, prey flee predators',
  },
  {
    family: 'extended',
    token: 'spawn',
    label: 'Spawn',
    formula: 'while engaged: emit S·2 particles/frame along the heading, each living ~90 frames',
    attrs: ['strength', 'angle'],
    desc: 'a source [S] — creates matter along the heading, budgeted by a lifespan + pool ceiling',
  },
  {
    family: 'extended',
    token: 'resonate',
    label: 'Resonate',
    formula: 'modifier: scales sibling S by S(t) = 1 + sin(ω·t)',
    attrs: ['strength', 'spin'],
    desc: 'pulses its sibling forces with a time-varying strength',
  },
  {
    family: 'extended',
    token: 'spotlight',
    label: 'Spotlight',
    formula: 'modifier: gates siblings outside an angular cone of the heading',
    attrs: ['angle'],
    desc: 'a directional gate — confines sibling forces to a beam',
  },
  {
    family: 'extended',
    token: 'pigment',
    label: 'Pigment',
    formula: 'on overlap: c_p ← mix(c_p, tint, rate);  the colour advects with matter',
    attrs: ['range', 'color'],
    desc: 'conserved colour transport — matter takes on and carries a tint',
  },
];

/** Every force with its canonical colour + real-use example merged in. Grouped by `family`. */
export const MANUAL_FORCES: readonly ManualEntry[] = FORCES_RAW.map((e) => ({
  ...e,
  color: FORCE_COLORS[e.token] ?? '#ffffff',
  example: FORCE_EXAMPLES[e.token] ?? '',
}));

/** A preset definition: its name, the primitive tokens it composes, and a real use (§20.9). */
export interface ManualPreset {
  name: string;
  tokens: readonly string[];
  desc: string;
  example: string;
}

/** The cosmology/weather presets, as compositions (§20.9). */
export const MANUAL_PRESETS: readonly ManualPreset[] = [
  { name: 'blackhole', tokens: ['attract', 'vortex', 'absorb', 'lens'], desc: 'a well, an accretion disk, an event horizon, and lensing', example: 'A dramatic focal element — the field pours in, circles, and is swallowed.' },
  { name: 'whitehole', tokens: ['repel', 'stream'], desc: 'an emission horizon that throws matter out', example: 'A source that only emits — the field is pushed away and downwind.' },
  { name: 'star', tokens: ['gravity', 'thermal'], desc: 'hydrostatic equilibrium — gravity balanced by thermal pressure', example: 'A balanced body — gravity’s pull held off by thermal pressure.' },
  { name: 'quasar', tokens: ['attract', 'vortex', 'absorb', 'lens', 'emitter'], desc: 'an accreting black hole with polar jets', example: 'An accreting core with bright jets firing from its poles.' },
  { name: 'galaxy', tokens: ['attract', 'vortex', 'drag', 'lens'], desc: 'a spiral disk that settles into a plane', example: 'A spiral that winds the field into arms and settles into a disk.' },
  { name: 'nebula', tokens: ['thermal', 'drag', 'buoyancy'], desc: 'a warm, slow cloud with rising wisps', example: 'A warm, slow cloud — the field churns and light wisps rise.' },
  { name: 'tornado', tokens: ['vortex', 'stream', 'drag'], desc: 'a funnel with an updraft, calmed at the edges', example: 'A funnel that swirls the field up its axis, ragged at the edges.' },
  { name: 'fountain', tokens: ['spawn', 'gravity'], desc: 'a class-[S] source jetting matter up, arcing home under gravity', example: 'A literal fountain — matter sprays upward and falls back in an arc.' },
];

/** The `data-when` condition gates (§5). */
export const MANUAL_CONDITIONS: readonly { id: string; desc: string }[] = [
  { id: 'active', desc: 'the element is engaged (hover / focus / tap)' },
  { id: 'fast', desc: 'the particle is moving quickly' },
  { id: 'slow', desc: 'the particle is moving slowly' },
  { id: 'hot', desc: 'the particle is hot' },
  { id: 'cool', desc: 'the particle is cool' },
];
