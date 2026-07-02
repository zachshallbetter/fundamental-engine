/**
 * The native field visuals, renderer-free. `traceStreamline` (the pure tracing core) is pinned with
 * stub samplers; `vectorField` / `streamlineTubes` are pinned on OBJECT LIFECYCLE (the #921 pool
 * model): geometry built per visual, `update()` reuses pooled objects with no unbounded growth,
 * re-sampling runs on the `interval` cadence, and `dispose()` frees everything. Geometry
 * construction is CPU-side in three, so none of this needs a WebGL context — pixels can't be
 * asserted here and stay a manual on-GPU check.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Color, InstancedMesh, Mesh, type BufferGeometry, type Material } from 'three';
import { streamlineTubes, traceStreamline, vectorField, type FieldSampler } from './samplers.ts';
import { PlaneProjection, VolumeProjection } from './project.ts';

const bounds = { width: 1000, height: 600 };

test('a uniform field traces a straight line to the edge', () => {
  const right: FieldSampler = { sample: () => ({ x: 1, y: 0 }) }; // constant +x
  const line = traceStreamline(right, { x: 100, y: 300 }, { ...bounds, stepLen: 10, maxSteps: 200 });
  assert.ok(line.length > 2, 'it advanced');
  for (let i = 1; i < line.length; i++) assert.ok(line[i]!.x > line[i - 1]!.x, 'monotonic in x');
  assert.ok(line[line.length - 1]!.x > 900, 'reached near the right edge before stopping');
  assert.ok(Math.abs(line[line.length - 1]!.y - 300) < 1e-6, 'y unchanged');
});

test('the line is bidirectional through the seed (core traceFieldLine delegation, #421)', () => {
  const right: FieldSampler = { sample: () => ({ x: 1, y: 0 }) }; // constant +x
  const seed = { x: 500, y: 300 };
  const line = traceStreamline(right, seed, { ...bounds, stepLen: 10, maxSteps: 200 });
  // the core tracer is bidirectional — the seed sits mid-line, with points upstream AND downstream
  // (the old forward-only walk only ever stepped downstream).
  assert.ok(line.some((p) => p.x < seed.x - 50), 'extends upstream of the seed');
  assert.ok(line.some((p) => p.x > seed.x + 50), 'extends downstream of the seed');
});

test('a stalled (zero) field yields just the seed', () => {
  const dead: FieldSampler = { sample: () => ({ x: 0, y: 0 }) };
  const line = traceStreamline(dead, { x: 500, y: 300 }, bounds);
  assert.equal(line.length, 1, 'no step taken');
});

test('a radial-in field converges toward the centre', () => {
  const cx = 500;
  const cy = 300;
  const inward: FieldSampler = { sample: (x, y) => ({ x: cx - x, y: cy - y }) }; // points to centre
  const start = { x: 100, y: 100 };
  const line = traceStreamline(inward, start, { ...bounds, stepLen: 12, maxSteps: 200 });
  const d0 = Math.hypot(start.x - cx, start.y - cy);
  const last = line[line.length - 1]!;
  const d1 = Math.hypot(last.x - cx, last.y - cy);
  assert.ok(d1 < d0, 'ends closer to the centre than it started');
});

// ── vectorField lifecycle ────────────────────────────────────────────────────────────────────────

const grid = (): PlaneProjection => new PlaneProjection({ width: 400, height: 200, scale: 0.01 });
const right: FieldSampler = { sample: () => ({ x: 1, y: 0 }) };
const arrowsOf = (v: ReturnType<typeof vectorField>): InstancedMesh => v.object.children[0] as InstancedMesh;

test('vectorField builds ONE instanced mesh sized to the sampling grid', () => {
  const v = vectorField(right, { projection: grid(), step: 100 }); // 4 cols × 2 rows
  assert.equal(v.object.children.length, 1, 'a single scene object for the whole grid');
  const mesh = arrowsOf(v);
  assert.ok(mesh instanceof InstancedMesh, 'the grid is instanced, not per-arrow meshes');
  assert.equal(mesh.count, 8, 'one instance per grid cell (4×2)');
  v.dispose();
});

test('vectorField colours arrows by magnitude (color → hotColor lerp)', () => {
  // strong on the left half, near-still on the right — instance colors must differ.
  const split: FieldSampler = { sample: (x) => (x < 200 ? { x: 10, y: 0 } : { x: 0.01, y: 0 }) };
  const v = vectorField(split, { projection: grid(), step: 100, color: '#000000', hotColor: '#ffffff' });
  const mesh = arrowsOf(v);
  assert.ok(mesh.instanceColor, 'per-instance colors were written');
  const strong = new Color();
  const weak = new Color();
  mesh.getColorAt(0, strong); // col 0 → x = 50 (strong half)
  mesh.getColorAt(3, weak); // col 3 → x = 350 (weak half)
  assert.ok(strong.r > weak.r + 0.5, 'a strong cell sits far closer to hotColor than a weak one');
  v.dispose();
});

test('vectorField update() reuses the same mesh and instance buffers — no per-frame realloc', () => {
  const v = vectorField(right, { projection: grid(), step: 100 });
  const mesh = arrowsOf(v);
  const matrixAttr = mesh.instanceMatrix;
  const colorAttr = mesh.instanceColor;
  for (let i = 0; i < 5; i++) v.update();
  assert.equal(v.object.children.length, 1, 'no new scene objects across updates');
  assert.equal(arrowsOf(v), mesh, 'the InstancedMesh itself is reused');
  assert.equal(mesh.instanceMatrix, matrixAttr, 'instanceMatrix attribute reused (written in place)');
  assert.equal(mesh.instanceColor, colorAttr, 'instanceColor attribute reused (written in place)');
  v.dispose();
});

test('vectorField re-samples the field only on the interval cadence', () => {
  let calls = 0;
  const counting: FieldSampler = { sample: () => (calls++, { x: 1, y: 0 }) };
  const v = vectorField(counting, { projection: grid(), step: 100, interval: 3 });
  assert.equal(calls, 8, 'construction samples the grid once');
  v.update(); // cadence frame 1 — cached
  v.update(); // 2 — cached
  assert.equal(calls, 8, 'off-cadence updates never touch the field');
  v.update(); // 3 — resample
  assert.equal(calls, 16, 'the Nth update re-samples the grid');
  v.dispose();
});

test('vectorField dispose() frees the arrow geometry and material', () => {
  const v = vectorField(right, { projection: grid(), step: 100 });
  const mesh = arrowsOf(v);
  let geoDisposed = false;
  let matDisposed = false;
  (mesh.geometry as BufferGeometry).addEventListener('dispose', () => (geoDisposed = true));
  (mesh.material as Material).addEventListener('dispose', () => (matDisposed = true));
  v.dispose();
  assert.ok(geoDisposed, 'the shared cone geometry was disposed');
  assert.ok(matDisposed, 'the arrow material was disposed');
});

// ── streamlineTubes lifecycle ────────────────────────────────────────────────────────────────────

const seeds = [
  { x: 100, y: 150 },
  { x: 100, y: 450 },
];
const tubesOf = (v: ReturnType<typeof streamlineTubes>): Mesh[] => v.object.children as Mesh[];
const visibleTubes = (v: ReturnType<typeof streamlineTubes>): Mesh[] => tubesOf(v).filter((m) => m.visible);

test('streamlineTubes builds one tube mesh per traced line, sharing one material', () => {
  const proj = new PlaneProjection({ width: 1000, height: 600, scale: 0.01 });
  const v = streamlineTubes(right, { projection: proj, seeds, interval: 1 });
  const tubes = tubesOf(v);
  assert.equal(tubes.length, 2, 'one mesh per seed line');
  for (const tube of tubes) {
    assert.ok(tube instanceof Mesh, 'each line is a Mesh');
    assert.equal(tube.geometry.type, 'TubeGeometry', 'the line is tessellated as a tube');
    assert.ok(tube.geometry.getAttribute('position').count > 0, 'the tube has baked vertices');
  }
  assert.equal(tubes[0]!.material, tubes[1]!.material, 'the tubes share one material');
  v.dispose();
});

test('streamlineTubes sits just OFF the projected field plane (offset, not absolute z)', () => {
  // a centered volume puts the field plane (engine z = 0) at world z = -depth/2 · depthScale = -1.5;
  // the tubes must register against THAT plane, not the world origin.
  const proj = new VolumeProjection({ width: 1000, height: 600, scale: 0.01, depth: 300, centerZ: true });
  const radius = 0.03;
  const v = streamlineTubes(right, { projection: proj, seeds, z: 0.02, radius, interval: 1 });
  const pos = tubesOf(v)[0]!.geometry.getAttribute('position');
  const plane = -1.5 + 0.02; // projected plane + the z offset
  for (let i = 0; i < pos.count; i++) {
    assert.ok(Math.abs(pos.getZ(i) - plane) <= radius + 1e-6, `vertex ${i} hugs the projected plane`);
  }
  v.dispose();
});

test('streamlineTubes update() reuses the pooled meshes — geometry swapped, no unbounded growth', () => {
  const proj = new PlaneProjection({ width: 1000, height: 600, scale: 0.01 });
  const v = streamlineTubes(right, { projection: proj, seeds, interval: 1 });
  const before = tubesOf(v).slice();
  const oldGeo = before[0]!.geometry;
  let oldDisposed = false;
  oldGeo.addEventListener('dispose', () => (oldDisposed = true));
  for (let i = 0; i < 10; i++) v.update();
  const after = tubesOf(v);
  assert.equal(after.length, before.length, 'the pool never grows for a steady field');
  assert.equal(after[0], before[0], 'the same Mesh objects are reused across retraces');
  assert.equal(after[1], before[1], 'the same Mesh objects are reused across retraces');
  assert.ok(oldDisposed, 'a replaced TubeGeometry is disposed, not orphaned');
  assert.notEqual(after[0]!.geometry, oldGeo, 'the retrace swapped in fresh geometry');
  v.dispose();
});

test('streamlineTubes hides stalled lines (pooled) and revives them without new objects', () => {
  let on = true;
  const gated: FieldSampler = { sample: () => (on ? { x: 1, y: 0 } : { x: 0, y: 0 }) };
  const proj = new PlaneProjection({ width: 1000, height: 600, scale: 0.01 });
  const v = streamlineTubes(gated, { projection: proj, seeds, interval: 1 });
  assert.equal(visibleTubes(v).length, 2, 'both lines trace while the field flows');
  const pooled = tubesOf(v).slice();

  on = false; // the field stalls — every trace collapses to its seed
  v.update();
  assert.equal(visibleTubes(v).length, 0, 'stalled lines are hidden');
  assert.equal(tubesOf(v).length, 2, '…but their meshes stay pooled, not removed');

  on = true;
  v.update();
  assert.equal(visibleTubes(v).length, 2, 'the flow returning revives the lines');
  assert.equal(tubesOf(v)[0], pooled[0], 'revival reuses the pooled meshes');
  v.dispose();
});

test('streamlineTubes retraces only on the interval cadence (default: cached between)', () => {
  let calls = 0;
  const counting: FieldSampler = { sample: () => (calls++, { x: 1, y: 0 }) };
  const proj = new PlaneProjection({ width: 1000, height: 600, scale: 0.01 });
  const v = streamlineTubes(counting, { projection: proj, seeds, interval: 4 });
  const c0 = calls;
  assert.ok(c0 > 0, 'construction traces the lines once');
  v.update(); // 1 — cached
  v.update(); // 2 — cached
  v.update(); // 3 — cached
  assert.equal(calls, c0, 'off-cadence updates never touch the field');
  v.update(); // 4 — retrace
  assert.ok(calls > c0, 'the Nth update retraces');
  v.dispose();
});

test('streamlineTubes dispose() frees every tube geometry and the shared material', () => {
  const proj = new PlaneProjection({ width: 1000, height: 600, scale: 0.01 });
  const v = streamlineTubes(right, { projection: proj, seeds, interval: 1 });
  const tubes = tubesOf(v);
  let geosDisposed = 0;
  let matDisposed = false;
  for (const tube of tubes) tube.geometry.addEventListener('dispose', () => geosDisposed++);
  (tubes[0]!.material as Material).addEventListener('dispose', () => (matDisposed = true));
  v.dispose();
  assert.equal(geosDisposed, 2, 'every pooled tube geometry was disposed');
  assert.ok(matDisposed, 'the shared material was disposed');
  assert.equal(v.object.children.length, 0, 'the group was emptied');
});
