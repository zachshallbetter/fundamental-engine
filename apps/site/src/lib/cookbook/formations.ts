// FORMATIONS — the one global bias every free particle carries.
//
// A formation is not a force and not a body: it is a field-wide posture, five numbers
// (`driftX, wander, orbit, spread, conv`) the engine EASES toward so a change glides rather than
// snaps. `setFormation(name)` switches it at runtime; `<section data-formation="lanes">` switches
// it as a section crosses mid-viewport (the conductor), and after ~6s of no input the field drifts
// back to the calm `ambient` posture on its own.
//
// The catalog is closed — five formations. Authoring means CHOOSING one and tuning the two
// declared `ambient` dials; the preset numbers themselves are engine-owned.
import { createField, headlessHost, seededRng, FORMATIONS } from '@fundamental-engine/core';

export interface FormationResult {
  /** the catalog — the whole authorable vocabulary. */
  available: string[];
  /** mean horizontal speed under `ambient` (resting drift). */
  ambientDriftX: number;
  /** …and under `lanes`, whose preset carries a real `driftX`: a current now carries the matter. */
  lanesDriftX: number;
  /** the switch is observable in the matter itself, not just in a flag. */
  lanesDriftsFaster: boolean;
}

/** mean signed horizontal velocity across the live pool. */
function meanVx(field: ReturnType<typeof createField>): number {
  const n = field.particleCount();
  const vx = new Float32Array(n);
  field.readParticleChannels(['vx'], [vx]);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += vx[i]!;
  return n ? sum / n : 0;
}

export function runFormations(): FormationResult {
  const host = headlessHost({ width: 1200, height: 800 });
  const field = createField(undefined as unknown as HTMLCanvasElement, {
    host,
    render: 'none',
    density: 1,
    rng: seededRng(23),
  });

  field.setFormation('ambient');
  for (let i = 0; i < 90; i++) host.tick();
  const ambientDriftX = Number(meanVx(field).toFixed(4));

  // the formation eases in — give it frames to glide, exactly as a reader would see
  field.setFormation('lanes');
  for (let i = 0; i < 180; i++) host.tick();
  const lanesDriftX = Number(meanVx(field).toFixed(4));

  field.destroy();
  return {
    available: FORMATIONS.map((f) => f.id),
    ambientDriftX,
    lanesDriftX,
    lanesDriftsFaster: Math.abs(lanesDriftX) > Math.abs(ambientDriftX),
  };
}
