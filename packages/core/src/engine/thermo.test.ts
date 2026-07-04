/**
 * Measured thermodynamics (workover v0.3 §"Metrics") — the pure math.
 *
 * entropy = (1 − R)·min(1, s̄/1.5) with R = |Σv|/Σ|v| (alignment); coherence = 1 − entropy;
 * temperature = ½·h̄ + ½·min(1, s̄²/9). Measured, never applied — these tests pin the
 * formulas and the documented expected directions (thermal ↑ entropy, drag ↓ entropy,
 * align ↑ coherence) without an engine.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { thermoMetrics, type ThermoAcc } from './thermo.ts';

/** Build an accumulator from explicit velocity/heat samples. */
function acc(samples: { vx: number; vy: number; heat?: number }[]): ThermoAcc {
  const a: ThermoAcc = { n: 0, sx: 0, sy: 0, ss: 0, ss2: 0, sh: 0 };
  for (const s of samples) {
    const s2 = s.vx * s.vx + s.vy * s.vy;
    a.n++;
    a.sx += s.vx;
    a.sy += s.vy;
    a.ss += Math.sqrt(s2);
    a.ss2 += s2;
    a.sh += s.heat ?? 0;
  }
  return a;
}

test('an empty (or absent) sample reads as a quiet region: entropy 0, coherence 1, temperature 0', () => {
  assert.deepEqual(thermoMetrics(undefined), { entropy: 0, coherence: 1, temperature: 0 });
  assert.deepEqual(thermoMetrics({ n: 0, sx: 0, sy: 0, ss: 0, ss2: 0, sh: 0 }), {
    entropy: 0,
    coherence: 1,
    temperature: 0,
  });
});

test('perfectly aligned fast matter is fully coherent (entropy 0) — the align/cohesion direction', () => {
  const m = thermoMetrics(acc([{ vx: 2, vy: 0 }, { vx: 2, vy: 0 }, { vx: 2, vy: 0 }]));
  assert.equal(m.entropy, 0);
  assert.equal(m.coherence, 1);
});

test('isotropic fast matter is maximally entropic — the thermal direction', () => {
  // four equal speeds in opposing directions: R = 0; mean speed 2 ≥ the 1.5 agitation ref.
  const m = thermoMetrics(
    acc([{ vx: 2, vy: 0 }, { vx: -2, vy: 0 }, { vx: 0, vy: 2 }, { vx: 0, vy: -2 }]),
  );
  assert.ok(m.entropy > 0.999, `entropy ${m.entropy} should be ~1`);
  assert.ok(m.coherence < 0.001);
});

test('damping lowers entropy: the same disorder at near-zero speed reads as ordered — the drag direction', () => {
  // identical directional dispersion (R = 0), but the agitation gate scales it by s̄/1.5.
  const fast = thermoMetrics(acc([{ vx: 1.5, vy: 0 }, { vx: -1.5, vy: 0 }]));
  const slow = thermoMetrics(acc([{ vx: 0.15, vy: 0 }, { vx: -0.15, vy: 0 }]));
  assert.ok(slow.entropy < fast.entropy * 0.2, `slow ${slow.entropy} vs fast ${fast.entropy}`);
  // a fully damped region is fully ordered
  const still = thermoMetrics(acc([{ vx: 0, vy: 0 }, { vx: 0, vy: 0 }]));
  assert.equal(still.entropy, 0);
  assert.equal(still.coherence, 1);
});

test('temperature rises with heat and with kinetic agitation, clamped to [0,1]', () => {
  const cold = thermoMetrics(acc([{ vx: 0, vy: 0, heat: 0 }]));
  const warm = thermoMetrics(acc([{ vx: 0, vy: 0, heat: 0.8 }]));
  const kinetic = thermoMetrics(acc([{ vx: 3, vy: 0, heat: 0 }])); // |v|² = 9 = the reference
  const blazing = thermoMetrics(acc([{ vx: 30, vy: 0, heat: 1 }]));
  assert.equal(cold.temperature, 0);
  assert.ok(warm.temperature > cold.temperature);
  assert.ok(Math.abs(warm.temperature - 0.4) < 1e-12); // ½ · 0.8
  assert.ok(Math.abs(kinetic.temperature - 0.5) < 1e-12); // ½ · min(1, 9/9)
  assert.equal(blazing.temperature, 1); // clamped
});

test('all three metrics stay in [0,1] across mixed samples', () => {
  const m = thermoMetrics(
    acc([
      { vx: 5, vy: -3, heat: 0.9 },
      { vx: -1, vy: 0.2, heat: 0.1 },
      { vx: 0, vy: 0, heat: 0 },
      { vx: 0.4, vy: 4, heat: 1 },
    ]),
  );
  for (const [k, v] of Object.entries(m)) {
    assert.ok(v >= 0 && v <= 1, `${k} = ${v} out of [0,1]`);
  }
  assert.ok(Math.abs(m.entropy + m.coherence - 1) < 1e-12, 'coherence = 1 − entropy');
});
