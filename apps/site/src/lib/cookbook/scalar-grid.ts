// SCALAR GRIDS — a persistent buffer the field carries for you.
//
// `field.grid(name)` returns a viewport-sized scalar buffer: `deposit` adds, `sample` reads it back
// bilinearly, `gradient` gives the up-slope direction, `decay`/`clear` fade it. The grid is created
// on first access (nothing is allocated until then) and advanced once per frame by a mode INFERRED
// FROM ITS NAME: `wave…` runs the wave scheme, `memory…` decays slowly, anything else diffuses.
//
// A force of the same name shares the same buffer — so a host can read what a force writes. Pick a
// distinct name (`'scent'`) to keep an authored field of your own.
import { createField, headlessHost, seededRng } from '@fundamental-engine/core';

export interface GridResult {
  /** value at the deposit point, right after depositing. */
  atSource: number;
  /** the same point after the grid's per-frame diffusion has run. */
  afterDiffusion: number;
  /** value 80px away — diffusion has carried some of it outward. */
  nearby: number;
  /** the up-slope direction at the nearby point: it points back toward the source. */
  gradientPointsToSource: boolean;
  /** after `decay(1)` the buffer is cleared. */
  afterDecay: number;
}

export function runScalarGrid(): GridResult {
  const host = headlessHost({ width: 1000, height: 700 });
  const field = createField(undefined as unknown as HTMLCanvasElement, {
    host,
    render: 'none',
    rng: seededRng(3),
  });

  // A named buffer of your own. 'scent' matches no force, so nothing else writes to it.
  const scent = field.grid('scent');

  const SX = 500;
  const SY = 350;
  scent.deposit(SX, SY, 100);
  const atSource = Number(scent.sample(SX, SY).toFixed(3));

  // let the grid's own per-frame stepping (diffusion, for this name) run
  for (let i = 0; i < 20; i++) host.tick();

  const afterDiffusion = Number(scent.sample(SX, SY).toFixed(3));
  const nearby = Number(scent.sample(SX + 80, SY).toFixed(4));

  // ∇ points up-slope — from a point to the right of the source, back toward it (negative x).
  const g = scent.gradient(SX + 80, SY);
  const gradientPointsToSource = g.x < 0;

  scent.decay(1); // 1 = clear
  const afterDecay = Number(scent.sample(SX, SY).toFixed(3));

  field.destroy();
  return { atSource, afterDiffusion, nearby, gradientPointsToSource, afterDecay };
}
