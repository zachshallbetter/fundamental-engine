// THE 50 DEMONSTRATIONS, TRIAGED — the data behind /docs/demonstrations.
//
// An older long-form post proposed "50 API demonstrations" and asked, in its own words, to
// "separate real API demonstrations from ideas that depend on host code or experimental behavior."
// This module is that separation, done against the engine rather than from memory: every item is
// verified against packages/core/src/engine/types.ts (the FieldHandle interface), the
// check:docs-enforced tables in src/lib/docs-api.ts, packages/core/src/engine/conditions.ts, and
// packages/core/src/forces/extended.ts. The verdicts:
//
//   · stable        — a frozen-tier public method / attribute; safe to build on today.
//   · shipped       — shipped but explicitly NOT frozen ("Shipped-but-unfrozen"); the signature may
//                     still move before 1.0. Real and usable, flagged so.
//   · experimental  — marked EXPERIMENTAL in the engine (query/snapshot/diff/replay, focus, forAgent).
//   · host          — the API exists, but the DEMONSTRATION only means something with host code
//                     (a renderer, a form handler, a registered channel). The seam is real; the demo
//                     is a pattern, not a one-liner. (Composable with any tier above via `host`.)
//   · not-in-api    — the post asked for something the engine does NOT expose. Kept visible, labelled,
//                     and pointed at the real levers — honesty over a tidy list.
//
// The post's own framing is preserved: the DOM stays the source of meaning, and the particles are one
// rendering of field activity. The page arranges these as short lessons — change an input, watch the
// field respond, read the resulting state, inspect how the DOM presents it.
//
// `runDemonstrations()` below is not prose: it constructs a real headless field at build time and
// invokes the stable/shipped/headless-experimental methods the catalog references, so the page can
// show that they ran — the same anti-drift discipline the cookbook uses. A method that did not exist
// would throw and fail the build.
import { createField, headlessHost, seededRng } from '@fundamental-engine/core';

export type Tier = 'stable' | 'shipped' | 'experimental' | 'not-in-api' | 'reference';

export interface Demo {
  /** the post's own item number (1..50), preserved so the triage is reviewable against the source. */
  n: number;
  title: string;
  /** the public symbol(s) the demo exercises, as written in the API reference. */
  api: string;
  tier: Tier;
  /** true when the demonstration needs host code to mean anything (a renderer, a handler, a channel). */
  host: boolean;
  /** the lesson shape, in the post's own flow: change an input → watch → read → inspect the DOM. */
  change: string;
  watch: string;
  /** where this already lives on the site, worked or in the generated reference. */
  href: string;
  /** source-of-truth note: where the symbol is confirmed, or the correction when the post drifted. */
  evidence: string;
}

export interface DemoSection {
  key: string;
  title: string;
  lede: string;
  demos: Demo[];
}

const IMP = '/docs/api/imperative';
const DECL = '/docs/api/declarative';
const STAB = '/docs/api/stability';
const READ = '/docs/cookbook/reading-the-field';
const COND = '/docs/cookbook/conditions-and-formations';
const CHAN = '/docs/field-channels';
const SNAP = '/docs/snapshots';
const INSP = '/docs/inspector';

export const SECTIONS: DemoSection[] = [
  {
    key: 'motion',
    title: 'Motion and interaction',
    lede: 'Inputs that redirect the matter already in the field — a flow focus, a one-shot, the wave spine, the separation between particles. The verbs are stable; the pointer and keyboard versions are host wiring over them.',
    demos: [
      { n: 1, title: 'Pointer flow', api: 'flowTo(x, y)', tier: 'stable', host: true,
        change: 'Feed a pointermove position into flowTo() each frame.',
        watch: 'Free matter curves toward the moving focus; the streamlines bend.',
        href: IMP, evidence: 'types.ts:1880 — flowTo is a stable handle method. The pointer wiring is the host’s (a pointermove handler).' },
      { n: 2, title: 'Clear the flow', api: 'clearFlow()', tier: 'stable', host: false,
        change: 'Call clearFlow().',
        watch: 'The focus is removed and the field relaxes back to its bodies-only shape.',
        href: IMP, evidence: 'types.ts:1882 — stable; the paired release for flowTo.' },
      { n: 3, title: 'One-shot burst', api: 'burst(x, y, hex?)', tier: 'stable', host: false,
        change: 'Trigger burst() at a point.',
        watch: 'A temporary shove + heat near the point — compare the transient impulse with a continuous flow focus.',
        href: IMP, evidence: 'types.ts:1854 — stable one-shot. Distinct from pulse(), which flares a body and moves no matter.' },
      { n: 4, title: 'Wave center', api: 'setWaveCenter(center)', tier: 'stable', host: false,
        change: 'Move the wave origin with setWaveCenter() (needs waves on, circular style).',
        watch: 'Concentric currents re-center on the new point.',
        href: IMP, evidence: 'types.ts:1798 + OPTIONS waveCenter. Only affects circular waves; waves default OFF (#979).' },
      { n: 5, title: 'Wave style', api: "setWaveStyle('linear' | 'circular')", tier: 'stable', host: false,
        change: 'Switch setWaveStyle() between linear and circular.',
        watch: 'Parallel horizontal waves vs concentric orbits around the wave center.',
        href: IMP, evidence: 'types.ts:1796 + OPTIONS waveStyle. Needs waves: true.' },
      { n: 6, title: 'Formation presets', api: 'setFormation(name)', tier: 'stable', host: false,
        change: 'Change the global particle arrangement with setFormation().',
        watch: 'The ambient bias shifts — drift, wander, orbit, spread, converge.',
        href: COND, evidence: 'types.ts:1794; worked in the conditions-and-formations cookbook.' },
      { n: 7, title: 'Separation', api: 'setSeparation(strength)', tier: 'stable', host: false,
        change: 'Raise or lower setSeparation().',
        watch: 'Short-range particle repulsion breaks up clumps or lets matter gather.',
        href: IMP, evidence: 'types.ts:1800 + OPTIONS separation.' },
      { n: 8, title: 'Damped response (“drag settings”)', api: 'no public drag control', tier: 'not-in-api', host: false,
        change: 'The post asks to compare movement under different drag settings in a live field.',
        watch: 'There is no public drag / friction / damping setter — FRICTION is an internal constant. The real motion levers are restingMotion, ambientWander, separation and integrator.',
        href: IMP, evidence: 'No setDrag/setFriction on FieldHandle (types.ts:1778–2199) and no drag option in OPTIONS. Dropped from live demos; the closest authorable dials are linked.' },
      { n: 9, title: 'Hover as influence', api: 'flowTo() / pointer()', tier: 'stable', host: true,
        change: 'Let pointer position drive flowTo() while the element keeps its DOM meaning.',
        watch: 'The field responds to the cursor without the cursor stopping being a cursor.',
        href: IMP, evidence: 'flowTo is stable (types.ts:1880). pointer() (types.ts:1901) is the purpose-built cursor participant — marked Experimental in docs-api.' },
      { n: 10, title: 'Keyboard as influence', api: 'flowTo() / burst()', tier: 'stable', host: true,
        change: 'Wire keydown handlers to the same flowTo()/burst() calls a pointer would make.',
        watch: 'Identical field changes from the keyboard — the accessible path to the same verbs.',
        href: IMP, evidence: 'The verbs are stable; the key bindings are host code. A reduced-motion-safe parity pattern.' },
    ],
  },
  {
    key: 'render',
    title: 'Color, rendering, and visibility',
    lede: 'The same physics drawn differently, and the signals that stay live even when nothing is drawn. Every setter here is stable except setVisible, which is shipped-but-unfrozen.',
    demos: [
      { n: 11, title: 'Render modes', api: 'setRender(mode)', tier: 'stable', host: false,
        change: "Switch setRender() across modes, including 'none'.",
        watch: "The matter layer changes or disappears while the simulation keeps running — 'none' is the default signals-only engine.",
        href: IMP, evidence: 'types.ts:1841 + RENDER_MODES table (none/dots/trails/…).' },
      { n: 12, title: 'Additive overlays', api: 'setOverlay(mode | mode[])', tier: 'stable', host: true,
        change: 'Pass setOverlay() one reading or an additive stack.',
        watch: 'Streamlines, grid, temperature, energy and data readings compose on the front surface.',
        href: IMP, evidence: 'types.ts:1850 + OVERLAY_MODES. Draws on an overlay canvas the host (or <field-root>) provides.' },
      { n: 13, title: 'Accent color', api: 'setAccent(hex)', tier: 'stable', host: false,
        change: 'Change setAccent().',
        watch: 'The travelling accent recolors the hot end of the matter.',
        href: IMP, evidence: 'types.ts:1790.' },
      { n: 14, title: 'Palette selection', api: 'setPalette(name | hex[])', tier: 'stable', host: false,
        change: 'Compare setPalette() choices against the same particle state.',
        watch: 'The accent template swaps live; the pool is unchanged.',
        href: IMP, evidence: 'types.ts:1792.' },
      { n: 15, title: 'Heatmap', api: 'setHeatmap(on)', tier: 'stable', host: false,
        change: 'Toggle setHeatmap().',
        watch: 'A glow of where matter pools appears, and sampleScalar/sampleGradient start returning real values.',
        href: IMP, evidence: 'types.ts:1806 + OPTIONS heatmap.' },
      { n: 16, title: 'Background mode', api: "setBackground('opaque' | 'transparent')", tier: 'stable', host: false,
        change: 'Compare transparent and opaque substrate.',
        watch: 'Transparent lets the underlay composite over light content; trails fade to transparent, not black.',
        href: IMP, evidence: 'types.ts:2190 + OPTIONS background.' },
      { n: 17, title: 'Attention signal', api: 'setAttention(on)', tier: 'stable', host: false,
        change: 'Toggle setAttention().',
        watch: 'One finite strength budget — engaging a body starves the others.',
        href: IMP, evidence: 'types.ts:1802 + OPTIONS attention.' },
      { n: 18, title: 'Causality view', api: 'setCausality(on)', tier: 'stable', host: false,
        change: 'Toggle setCausality().',
        watch: 'A saturated body spills density to its neighbours (the --lit channel).',
        href: IMP, evidence: 'types.ts:1804 + OPTIONS causality.' },
      { n: 19, title: 'Wave appearance', api: 'setWaveStyle / setAccent / setWaveCenter', tier: 'stable', host: false,
        change: 'Vary wave style, color and center while leaving the particle pool unchanged.',
        watch: 'The carrier waves restyle; the matter is untouched.',
        href: IMP, evidence: 'Composition of three stable setters; needs waves: true.' },
      { n: 20, title: 'Render pause', api: 'setVisible(on)', tier: 'shipped', host: false,
        change: 'Call setVisible(false), then setVisible(true).',
        watch: 'Drawing stops and resumes while the simulation, --d/--load and events keep flowing — no field state replaced.',
        href: IMP, evidence: 'types.ts:2184 — Shipped-but-unfrozen.' },
    ],
  },
  {
    key: 'bodies',
    title: 'DOM bodies and authored meaning',
    lede: 'The declarative half: elements author meaning as data-* attributes, the field measures them, and it writes measured --field-* signals back. The attributes are stable; some demos are host patterns (a form, a focus handler) over them.',
    demos: [
      { n: 21, title: 'Whole-container mass', api: 'data-shaped', tier: 'stable', host: false,
        change: 'Mark a container data-shaped.',
        watch: 'Forces reference the nearest point on the element box, so matter shells the shape instead of bunching at a center point.',
        href: DECL, evidence: 'ATTRS data-shaped; Body.shaped in types.ts.' },
      { n: 22, title: 'Force selection', api: 'data-body + rescan()', tier: 'stable', host: false,
        change: "Change the body's declared force token, then rescan().",
        watch: 'The same particles respond to a different verb.',
        href: DECL, evidence: 'ATTRS data-body. Token classification happens at scan, so a token change needs rescan().' },
      { n: 23, title: 'Strength control', api: 'data-strength + rescan()', tier: 'stable', host: false,
        change: 'Adjust authored data-strength and rescan().',
        watch: 'The force magnitude S changes; the response scales.',
        href: DECL, evidence: 'ATTRS data-strength (default 0.5).' },
      { n: 24, title: 'Body color', api: 'data-color + rescan()', tier: 'stable', host: false,
        change: "Change the body's declared data-color and rescan().",
        watch: 'The accent override on engage (and the carried pigment color) changes.',
        href: DECL, evidence: 'ATTRS data-color.' },
      { n: 25, title: 'Conditional behavior', api: 'data-when', tier: 'stable', host: false,
        change: "Switch data-when: active, fast, slow, hot, cool, scrolling.",
        watch: 'The force gates on the condition — engagement, particle speed/heat, or page scroll.',
        href: COND, evidence: 'conditions.ts:10–16 registers all six; ATTRS data-when.' },
      { n: 26, title: 'Potential source', api: 'data-potential + relief force', tier: 'stable', host: true,
        change: 'Declare data-potential on a relief body and register the named channel.',
        watch: 'Matter is transported down the channel’s gradient (−∇Φ).',
        href: CHAN, evidence: 'ATTRS data-potential; relief force at extended.ts:631. A no-op until the host registers the channel via addField — hence host-flagged.' },
      { n: 27, title: 'Scroll interaction', api: "data-when='scrolling' / scrollV()", tier: 'stable', host: false,
        change: 'Scroll the page as an input to the scrolling condition.',
        watch: 'The gate opens only while the page is actually scrolling; scrollV() reports the eased velocity.',
        href: COND, evidence: "conditions.ts:16 (scrolling gate); scrollV() types.ts:2175 (Shipped-but-unfrozen). The browser host feeds scroll automatically." },
      { n: 28, title: 'Form as field input', api: 'setAttribute + rescan()', tier: 'stable', host: true,
        change: 'Let a form control write a body’s data-* attributes, then rescan().',
        watch: 'The field’s returned --field-* signals move with the control.',
        href: DECL, evidence: 'Stable attributes; the input→attribute→rescan wiring is host code.' },
      { n: 29, title: 'Focus as influence', api: 'data-hot → data-active', tier: 'stable', host: true,
        change: 'Focus a data-hot element (keyboard or pointer).',
        watch: 'The engine sets data-active="1" and the body engages — standard focus behavior retained.',
        href: DECL, evidence: 'ATTRS data-active/data-hot. NOTE: this is DOM focus, not the experimental focus() attention substrate (#40/#49).' },
      { n: 30, title: 'Before/after body state', api: 'data-* vs --field-*', tier: 'stable', host: false,
        change: 'Place authored attributes beside the measured --field-* outputs.',
        watch: 'Authored input and engine-measured output stay visibly distinct — the reciprocal loop in one view.',
        href: CHAN, evidence: 'WRITEBACK vars (--d, --load, --temperature, …) vs authored data-*.' },
    ],
  },
  {
    key: 'reading',
    title: 'Reading and inspecting the field',
    lede: 'The read side. query() and forAgent() are experimental; the particle and sample reads are shipped-but-unfrozen; seed()/atomAt() are stable. Every call here is read-only and works headless.',
    demos: [
      { n: 31, title: 'Live query', api: 'query(q?)', tier: 'experimental', host: false,
        change: 'Display query() output.',
        watch: 'Plain serializable data — bodies, metrics, relationships, per-force influence. Identify which values are engine measurements.',
        href: READ, evidence: 'types.ts:1983 — EXPERIMENTAL, not yet in the frozen surface.' },
      { n: 32, title: 'Particle state', api: 'readParticles(out)', tier: 'shipped', host: false,
        change: 'Copy live state into a Float32Array (stride 5).',
        watch: 'Positions/heat/size, zero-allocation and read-only.',
        href: READ, evidence: 'types.ts:2143 — Shipped-but-unfrozen (stride may widen before 1.0).' },
      { n: 33, title: 'Particle identity', api: 'readParticleIds(out)', tier: 'shipped', host: false,
        change: 'Read stable ids into a Uint32Array parallel to readParticles.',
        watch: 'ids[i] is the identity of the particle at stride offset i*5 — track a seeded entity across frames.',
        href: READ, evidence: 'types.ts:2152 — Shipped-but-unfrozen.' },
      { n: 34, title: 'Particle channels', api: 'readParticleChannels(channels, out)', tier: 'shipped', host: false,
        change: "Read named channels (x/y/z/vx/vy/heat/size/m/id/age/charge) column-wise.",
        watch: 'A subset of per-particle channels into caller-owned buffers; unknown channels write 0.',
        href: READ, evidence: 'types.ts:2158 — Shipped-but-unfrozen.' },
      { n: 35, title: 'Point sample', api: 'sample(x, y)', tier: 'shipped', host: false,
        change: 'Call sample() at the pointer.',
        watch: 'The net force vector a still test particle would feel there — where you sample is most of the answer.',
        href: READ, evidence: 'types.ts:2055 — Shipped-but-unfrozen.' },
      { n: 36, title: 'Scalar sample', api: 'sampleScalar(x, y)', tier: 'shipped', host: false,
        change: 'Read sampleScalar() at a point (heatmap on).',
        watch: 'The smooth diffused density ∈ [0,1]; returns 0 when the heatmap layer is off.',
        href: READ, evidence: 'types.ts:2064 — Shipped-but-unfrozen. Requires heatmap: true.' },
      { n: 37, title: 'Gradient sample', api: 'sampleGradient(x, y)', tier: 'shipped', host: false,
        change: 'Read sampleGradient() at a point (heatmap on).',
        watch: 'Direction + steepness of increasing density — the cue forage-by-gradient steers by.',
        href: READ, evidence: 'types.ts:2086 — Shipped-but-unfrozen. Requires heatmap: true.' },
      { n: 38, title: 'Nearest-record sample', api: 'seed(atoms) + atomAt(x, y)', tier: 'stable', host: false,
        change: 'Seed host records, then atomAt() near the pointer.',
        watch: 'The record on the nearest seeded particle within ~24px, or null — the hover-to-inspect affordance. (The “sample operation” for records is atomAt, not sample().)',
        href: READ, evidence: 'types.ts:1940 (seed) + 2023 (atomAt) — stable.' },
      { n: 39, title: 'Energy readout', api: 'energy()', tier: 'shipped', host: false,
        change: 'Read energy().',
        watch: '{ kinetic, thermal, total, count } for the frame — a distinct runtime reading with documented units.',
        href: IMP, evidence: 'types.ts:2044 — Shipped-but-unfrozen.' },
      { n: 40, title: 'Scoped agent read', api: "forAgent({ capabilities: ['read:metrics'] })", tier: 'experimental', host: false,
        change: 'Derive a read-only view with only read:metrics and call its query().',
        watch: 'The restricted reader sees less than the full query — an allow-list that tightens, never widens.',
        href: INSP, evidence: 'types.ts:1833 — EXPERIMENTAL; AGENT_CAPABILITIES allow-list.' },
    ],
  },
  {
    key: 'data',
    title: 'Data, relationships, and host integration',
    lede: 'The substrate and non-DOM surfaces. snapshot/diff/replay are experimental; addField/grid/addBody/addEdge are shipped-but-unfrozen; threads is stable. The last two items are cross-cutting patterns, not single calls.',
    demos: [
      { n: 41, title: 'Snapshot', api: 'snapshot(opts?)', tier: 'experimental', host: false,
        change: 'Capture snapshot().',
        watch: 'A portable, serializable record of what the field is DOING — label it a state snapshot, not a timeline.',
        href: SNAP, evidence: 'types.ts:1987 — EXPERIMENTAL.' },
      { n: 42, title: 'Snapshot diff', api: 'diff(a, b)', tier: 'experimental', host: false,
        change: 'Compare two snapshots with diff().',
        watch: 'Body, relationship, metric and formation changes — derived purely from the two snapshots.',
        href: READ, evidence: 'types.ts:1990 — EXPERIMENTAL.' },
      { n: 43, title: 'Replay (cause, not restore)', api: 'replay(a, b, opts?)', tier: 'experimental', host: false,
        change: 'Call replay() on two snapshots.',
        watch: 'An ordered, narrated sequence of CAUSES of the change. CORRECTION: replay() does NOT restore state — it explains how the field changed; the engine has no state-restore call.',
        href: SNAP, evidence: 'types.ts:1994 — EXPERIMENTAL. The post’s “restored state” framing is wrong; replay returns a CausalReplay, not a mutation.' },
      { n: 44, title: 'Host scalar field', api: 'addField(name, sampler) + sampleField()', tier: 'shipped', host: true,
        change: 'Register a deterministic sampler through addField() and read it back.',
        watch: 'Your data on the engine’s read path — one field to query, not two.',
        href: CHAN, evidence: 'types.ts:2019 — Shipped-but-unfrozen. The sampler is host-supplied.' },
      { n: 45, title: 'Grid data', api: 'grid(name)', tier: 'shipped', host: false,
        change: 'Deposit into and read back a named ScalarGrid.',
        watch: 'A host-authorable field buffer — deposit/sample/gradient/decay/clear; the name chooses the physics.',
        href: READ, evidence: 'types.ts:2099 — Shipped-but-unfrozen.' },
      { n: 46, title: 'Host records as bodies', api: 'addBody(spec)', tier: 'shipped', host: true,
        change: 'Make visible host records participate via addBody() — no DOM, no particles spawned.',
        watch: 'A programmatic emitter the engine measures; it carries a data record and takes per-body feedback.',
        href: READ, evidence: 'types.ts:1964 — Shipped-but-unfrozen. The sanctioned non-DOM host path.' },
      { n: 47, title: 'Declared edge', api: 'addEdge(a, b) + readEdges()', tier: 'shipped', host: true,
        change: 'Relate two programmatic bodies with addEdge() and inspect with readEdges().',
        watch: 'A live relationship that strengthens while its source is salient and accumulates memory — no DOM.',
        href: IMP, evidence: 'types.ts:1974 + 1978 — Shipped-but-unfrozen.' },
      { n: 48, title: 'DOM relationship projection', api: 'threads(list | null)', tier: 'stable', host: true,
        change: 'Pass threads() a set of element pairs.',
        watch: 'Glowing connector lines render the declared relationships in the DOM — a separate projection from the matter.',
        href: IMP, evidence: 'types.ts:1852 — stable. The host supplies the element pairs.' },
      { n: 49, title: 'Data provenance panel', api: 'data-* / --field-* / threads()', tier: 'stable', host: true,
        change: 'Label each value host-authored, engine-measured, or host-projected.',
        watch: 'Authored input (data-*), measured output (--field-* / --d), and projection (threads) stay distinct — a pattern, not a single call.',
        href: CHAN, evidence: 'Composition of stable surfaces; the panel is host presentation.' },
      { n: 50, title: 'Host comparison', api: 'parity matrix / platform guides', tier: 'reference', host: true,
        change: 'Link one conceptual example to web, native, renderer and headless hosts.',
        watch: 'State which capabilities each host supports — the parity matrix is the honest answer.',
        href: '/docs/api/parity', evidence: 'Cross-plane reference: /docs/implementations + /docs/api/parity. Not a single API.' },
    ],
  },
];

/** The flat list, for counts and the triage table. */
export const DEMOS: Demo[] = SECTIONS.flatMap((s) => s.demos);

export const TIER_COUNTS: Record<Tier, number> = DEMOS.reduce(
  (acc, d) => ((acc[d.tier] = (acc[d.tier] ?? 0) + 1), acc),
  {} as Record<Tier, number>,
);

export const HOST_COUNT = DEMOS.filter((d) => d.host).length;

export interface DemoReceipt {
  /** the stable/shipped/headless-experimental methods invoked on a real field at build time. */
  invoked: string[];
  invokedCount: number;
  /** a force vector read beside an attract well — proof sample() ran and returned real numbers. */
  forceBesideWell: { x: number; y: number };
  /** query() body count. */
  queryBodies: number;
  /** diff() of two snapshots over 60 frames. */
  bodyChanges: number;
  /** energy() for the frame. */
  energyTotal: number;
  /** focusState() entries after an operator deposit. */
  focusEntries: number;
  /** the scoped agent view returned fewer-or-equal bodies than the full query. */
  agentScoped: boolean;
  /** readEdges() after one addEdge(). */
  edges: number;
}

/**
 * Invoke the catalog's stable / shipped / headless-experimental methods on a real headless field, at
 * build time. Everything here is read-only or construction; nothing is drawn. A method that did not
 * exist on the public handle would throw and fail the build — which is the point.
 */
export function runDemonstrations(): DemoReceipt {
  const invoked: string[] = [];
  const mark = (name: string): void => {
    invoked.push(name);
  };

  const host = headlessHost({ width: 1000, height: 700 });
  const field = createField(undefined as unknown as HTMLCanvasElement, {
    host,
    render: 'none',
    density: 0.6,
    heatmap: true,
    rng: seededRng(42),
  });

  // declarative/body side — a well, a second body, and a relationship between two more.
  const well = field.addBody({
    tokens: ['attract'],
    strength: 3,
    range: 400,
    identity: 'well',
    rect: () => ({ left: 460, top: 310, width: 80, height: 80 }),
  });
  mark('addBody');
  const a = field.addBody({ tokens: ['attract'], rect: () => ({ left: 120, top: 120, width: 40, height: 40 }), data: { id: 'a' } });
  const b = field.addBody({ tokens: ['attract'], rect: () => ({ left: 820, top: 540, width: 40, height: 40 }), data: { id: 'b' } });
  const edge = field.addEdge(a, b, { type: 'relates' });
  mark('addEdge');
  void edge;

  // seed records into the matter, register a host channel, open a grid.
  field.seed([{ weight: 0.8, label: 'alpha' }, { weight: 0.4, label: 'beta' }]);
  mark('seed');
  const channel = field.addField('height', (x, y) => (x + y) / 2000);
  mark('addField');
  void field.sampleField('height', 100, 100);
  mark('sampleField');
  const scent = field.grid('scent');
  scent.deposit(500, 350, 1);
  mark('grid');

  // stable motion + render setters (no draw under render: 'none').
  field.setSeparation(0.2);
  mark('setSeparation');
  field.setAttention(true);
  mark('setAttention');
  field.setCausality(true);
  mark('setCausality');
  field.setHeatmap(true);
  mark('setHeatmap');
  field.flowTo(300, 300);
  mark('flowTo');
  field.clearFlow();
  mark('clearFlow');
  // NOTE: setRender('dots') is intentionally NOT invoked here — switching FROM 'none' acquires a 2D
  // context the headless host has no canvas for, which throws. It is a stable method (demo #11); this
  // receipt only exercises what runs without a drawing surface.
  const unsubscribe = field.on('captured', () => {});
  mark('on');
  unsubscribe();

  // let the field settle so the reads have something to report.
  for (let i = 0; i < 30; i++) host.tick();

  // read side.
  const f = field.sample(600, 350);
  mark('sample');
  const forceBesideWell = { x: Number(f.x.toFixed(3)), y: Number(f.y.toFixed(3)) };
  void field.sampleScalar(500, 350);
  mark('sampleScalar');
  void field.sampleGradient(500, 350);
  mark('sampleGradient');
  const count = field.particleCount();
  mark('particleCount');
  const positions = new Float32Array(count * 5);
  field.readParticles(positions);
  mark('readParticles');
  const ids = new Uint32Array(count);
  field.readParticleIds(ids);
  mark('readParticleIds');
  field.readParticleChannels(['x', 'y'], [new Float32Array(count), new Float32Array(count)]);
  mark('readParticleChannels');
  void field.atomAt(500, 350);
  mark('atomAt');
  const energy = field.energy();
  mark('energy');
  void field.scrollV();
  mark('scrollV');

  // substrate: query, snapshot, diff, replay (all experimental, all headless).
  const reading = field.query();
  mark('query');
  const before = field.snapshot();
  mark('snapshot');
  for (let i = 0; i < 60; i++) host.tick();
  const after = field.snapshot();
  const changed = field.diff(before, after);
  mark('diff');
  field.replay(before, after);
  mark('replay');

  // focus/attention substrate (experimental) + scoped agent view (experimental).
  field.focus('well', { source: 'operator' });
  mark('focus');
  const focus = field.focusState();
  mark('focusState');
  const view = field.forAgent({ capabilities: ['read:metrics'] });
  mark('forAgent');
  const scoped = view.query();
  const edges = field.readEdges();
  mark('readEdges');

  void well;
  void channel;
  field.destroy();

  return {
    invoked,
    invokedCount: invoked.length,
    forceBesideWell,
    queryBodies: reading.bodies.length,
    bodyChanges: changed.bodyChanges.length,
    energyTotal: Number(energy.total.toFixed(3)),
    focusEntries: focus.entries.length,
    agentScoped: scoped.bodies.length <= reading.bodies.length,
    edges: edges.length,
  };
}
