/**
 * Shaped sources (field-systems plan, Stage C) — a `shaped` body references the nearest
 * point on its box, so matter gathers in a SHELL around the element's shape instead of
 * collapsing to its centre. Run on the real engine via the conformance runner.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScenario } from '../conformance/run.ts';
import { sdfRect } from './geometry.ts';
import type { Scenario } from '../conformance/types.ts';

function ring(n: number, r: number): { x: number; y: number; vx: number; vy: number }[] {
  const ps = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    ps.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0 });
  }
  return ps;
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const std = (xs: number[]): number => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

// a wide bar (hw 80 × hh 16) so the shell, if it forms, spreads far along x and stays
// thin in y — a clear signature distinct from a centre blob.
function settle(shaped: boolean) {
  const scenario: Scenario = {
    force: 'attract',
    tokens: ['attract'],
    label: `shaped=${shaped}`,
    family: 'canonical',
    klass: 'A',
    body: { strength: 1.5, range: 300, hw: 80, hh: 16, shaped },
    particles: ring(24, 130),
    frames: 300,
  };
  const r = runScenario(scenario);
  const last = r.trajectory[r.trajectory.length - 1]!;
  const bcx = r.body.cx;
  const bcy = r.body.cy;
  return {
    xSpread: std(last.map((p) => p.x - bcx)),
    meanDistCenter: mean(last.map((p) => Math.hypot(p.x - bcx, p.y - bcy))),
    meanSdf: mean(last.map((p) => sdfRect(p.x, p.y, r.body))),
  };
}

test('shaped attract gathers matter into a shell around the box, not its centre', () => {
  const sh = settle(true);
  const pt = settle(false);

  // the shell spans the wide box; the point source collapses tight
  assert.ok(
    sh.xSpread > pt.xSpread * 2,
    `shaped x-spread ${sh.xSpread.toFixed(1)} should be >2× point-source ${pt.xSpread.toFixed(1)}`,
  );
  // shaped matter hugs the box surface (signed distance near zero or inside)
  assert.ok(sh.meanSdf < 20, `shaped matter should hug the box; mean sdf ${sh.meanSdf.toFixed(1)}`);
  // the point source collapses near the centre
  assert.ok(
    pt.meanDistCenter < 40,
    `point source should collapse to centre; mean dist ${pt.meanDistCenter.toFixed(1)}`,
  );
});

test('shaped flag defaults off — a body with no flag is a point source', () => {
  // identical setup, shaped omitted entirely → must behave as the point-source case
  const r = runScenario({
    force: 'attract',
    tokens: ['attract'],
    label: 'no-flag',
    family: 'canonical',
    klass: 'A',
    body: { strength: 1.5, range: 300, hw: 80, hh: 16 },
    particles: ring(24, 130),
    frames: 300,
  });
  const last = r.trajectory[r.trajectory.length - 1]!;
  const md = mean(last.map((p) => Math.hypot(p.x - r.body.cx, p.y - r.body.cy)));
  assert.ok(md < 40, `default (no shaped) should collapse to centre; mean dist ${md.toFixed(1)}`);
});
