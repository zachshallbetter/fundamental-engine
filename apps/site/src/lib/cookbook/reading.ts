// READING THE FIELD OVER TIME — snapshot → tick → snapshot → diff.
//
// The reference covers the three GRAINS of reading (a probe at a point, a `query` over a region, a
// `snapshot` of the whole field). This is the worked version of the third: capture what the field
// was doing, let it run, capture again, and ask what changed. A diff is derived purely from the two
// snapshots — no recording, no instrumentation, nothing retained between them.
//
// This is the shape a change-monitor, a regression test, or an agent's "what happened since my last
// turn" all want.
import { createField, headlessHost, seededRng } from '@fundamental-engine/core';

export interface ReadingResult {
  /** bodies visible to the reading. */
  bodies: number;
  /** the probe 100px right of the well: a force VECTOR, not a scalar — it points back at the well. */
  forceBesideWell: { x: number; y: number };
  /** the probe at the well's exact centre: zero, because the pull cancels by symmetry. */
  forceAtCentre: { x: number; y: number };
  /** the probe beyond `range`: zero, because the body's influence ends there. */
  forceBeyondRange: { x: number; y: number };
  /** how far the two snapshots are apart, in frames. */
  framesBetween: number;
  /** the diff's own account of what moved. */
  bodyChanges: number;
  metricChanges: number;
  /** a diff names the two snapshots it compared. */
  diffIsIdentified: boolean;
}

export function runReading(): ReadingResult {
  const host = headlessHost({ width: 1000, height: 700 });
  const field = createField(undefined as unknown as HTMLCanvasElement, {
    host,
    render: 'none',
    density: 0.5,
    rng: seededRng(37),
  });

  field.addBody({
    tokens: ['attract'],
    strength: 3,
    range: 400,
    identity: 'well', // a stable id, so a reading can refer to it by name across frames
    rect: () => ({ left: 460, top: 310, width: 80, height: 80 }),
  });
  for (let i = 0; i < 30; i++) host.tick();

  // grain 1 — a probe at a point: the net force VECTOR there.
  // Three probes, because where you sample is the whole lesson: beside the well the force points
  // back at it; at the exact centre it cancels to zero; past `range` there is nothing to feel.
  const vec = (x: number, y: number): { x: number; y: number } => {
    const f = field.sample(x, y);
    return { x: Number(f.x.toFixed(3)), y: Number(f.y.toFixed(3)) };
  };
  const forceBesideWell = vec(600, 350);
  const forceAtCentre = vec(500, 350);
  const forceBeyondRange = vec(950, 350);

  // grain 2 — a structured question about the whole field
  const reading = field.query();

  // grain 3 — change over time
  const before = field.snapshot();
  const framesBetween = 60;
  for (let i = 0; i < framesBetween; i++) host.tick();
  const after = field.snapshot();
  const changed = field.diff(before, after);

  field.destroy();
  return {
    bodies: reading.bodies.length,
    forceBesideWell,
    forceAtCentre,
    forceBeyondRange,
    framesBetween,
    bodyChanges: changed.bodyChanges.length,
    metricChanges: changed.metricChanges.length,
    diffIsIdentified: changed.from === before.id && changed.to === after.id,
  };
}
