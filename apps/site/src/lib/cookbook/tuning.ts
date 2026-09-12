// PERFORMANCE TUNING — the three dials that actually move the cost.
//
//   density      the particle-count multiplier. The pool is `130 × density`, rounded — a FIELD-WIDE
//                count, NOT a per-area one. (This is why a small contained field reads a low `--d`:
//                the same 130 particles are spread across the whole volume, so a card-sized field
//                needs a HIGHER density, not a lower one.)
//   dprCap       the device-pixel-ratio ceiling. Effective DPR is `min(devicePixelRatio, dprCap)`;
//                the backing store is the dominant fill cost on a retina display.
//   qualityTier  the degradation ladder: 0 full, 1 effects reduced, 2 minimal, 3 paused. The engine
//                caps DPR and drops the heatmap at tier 2+ on its own levers, reversibly.
//
// `inspectBudget(counts)` judges a CONFIGURATION against the shipped budget before you ship it.
import { createField, headlessHost, seededRng, inspectBudget, DEFAULT_BUDGET } from '@fundamental-engine/core';

export interface TuningResult {
  /** the pool at density 1 — the `130 × density` rule, measured. */
  particlesAtDensity1: number;
  /** …and at 0.25: a quarter of the matter, a quarter of the integration cost. */
  particlesAtQuarter: number;
  /** the shipped budget's particle ceiling. */
  budgetParticles: number;
  /** a deliberately over-budget configuration, judged before it ships. */
  findings: { field: string; value: number; limit: number; over: number }[];
  /** JS takes the tier but exposes NO read-back property for it — `setQualityTier` is write-only
   *  here, where the Swift and Kotlin handles both publish a `qualityTier` property. */
  tierReadableBackOnJs: boolean;
}

function poolAt(density: number): number {
  const host = headlessHost({ width: 1200, height: 800 });
  const field = createField(undefined as unknown as HTMLCanvasElement, {
    host,
    render: 'none',
    density,
    rng: seededRng(29),
  });
  host.tick();
  const n = field.particleCount();
  field.destroy();
  return n;
}

export function runTuning(): TuningResult {
  const particlesAtDensity1 = poolAt(1);
  const particlesAtQuarter = poolAt(0.25);

  // judge a configuration against the shipped budget — no field required
  const findings = inspectBudget({ particles: 900, bodies: 40, dprCap: 3 }).map((f) => ({
    field: String(f.field),
    value: f.value,
    limit: f.limit,
    over: f.over,
  }));

  // a sustained-overrun response: the governor detects, you forward the tier, the engine adapts
  const host = headlessHost({ width: 1200, height: 800 });
  const field = createField(undefined as unknown as HTMLCanvasElement, {
    host,
    render: 'none',
    density: 1,
    dprCap: 2,
    rng: seededRng(31),
  });
  field.setQualityTier(2); // what QualityGovernor.feed() would hand you on a slow device
  host.tick();
  // Measured, not assumed: the JS handle carries no `qualityTier` property to read it back from.
  const tierReadableBackOnJs = 'qualityTier' in field;
  field.destroy();

  return {
    particlesAtDensity1,
    particlesAtQuarter,
    budgetParticles: DEFAULT_BUDGET.particles,
    findings,
    tierReadableBackOnJs,
  };
}
