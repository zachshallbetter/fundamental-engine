// Shared benchmark harness for the Fundamental core perf suite. Pure Node — no DOM, no GPU. Deterministic
// (a seeded LCG stands in for Math.random, which the engine never calls in the sim hot path anyway), so
// two runs on the same machine are comparable. Timing is wall-clock via performance.now(); we report the
// MEDIAN and p95 of per-iteration times after a warmup, because a mean is dominated by GC/JIT outliers.
//
// IMPORTANT (see docs/engineering-practices.md): the JS field is FILL-RATE-bound, not particle-bound. This suite measures the
// ALGORITHMIC cost of the engine (step/query/snapshot/accumulator) in Node, where there is no compositor.
// The fps/fill-rate/DPR/mix-blend numbers that actually gate the homepage live on real GPU hardware and
// are intentionally NOT measured here — Node software-rasterizes and would mislead. See performance.md.

import type { FieldHost } from '../src/core/host.ts';

/** A seeded LCG — deterministic pseudo-randomness for laying out bench particles/bodies. */
export function lcg(seed = 0x2545f491): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** A headless host that lets the bench pump frames by hand (the rAF callback is stashed, then invoked). */
export function tickHost(width = 1440, height = 900, dpr = 1): { host: FieldHost; tick: (dt?: number) => void } {
  let frame: ((t: number) => void) | null = null;
  let t = 0;
  const root = { querySelectorAll: () => [], querySelector: () => null, contains: () => false } as unknown as ParentNode;
  const host: FieldHost = {
    root,
    viewport: () => ({ width, height, dpr }),
    scrollY: () => 0,
    scrollHeight: () => height,
    reducedMotion: () => false,
    hidden: () => false,
    raf: (cb) => { frame = cb; return 1; },
    cancelRaf: () => { frame = null; },
    createCanvas: () => { throw new Error('no canvas in bench'); },
    onResize: () => () => {},
    onScroll: () => () => {},
    onVisibility: () => () => {},
    onInput: () => () => {},
    onBodyEvent: () => () => {},
  };
  return { host, tick: (dt = 1000 / 60) => { t += dt; const cb = frame; cb?.(t); } };
}

export interface Stat {
  median: number;
  p95: number;
  min: number;
  iters: number;
}

/** Time `fn` `iters` times after `warmup` untimed iterations; return median/p95/min in ms. */
export function timeIt(fn: () => void, iters: number, warmup = Math.ceil(iters * 0.2)): Stat {
  for (let i = 0; i < warmup; i++) fn();
  const samples: number[] = new Array(iters);
  for (let i = 0; i < iters; i++) {
    const a = performance.now();
    fn();
    samples[i] = performance.now() - a;
  }
  samples.sort((a, b) => a - b);
  const at = (q: number) => samples[Math.min(samples.length - 1, Math.floor(samples.length * q))]!;
  return { median: at(0.5), p95: at(0.95), min: samples[0]!, iters };
}

const ms = (n: number) => (n < 0.01 ? n.toFixed(4) : n < 1 ? n.toFixed(3) : n.toFixed(2));

/** Render rows as a fixed-width markdown-ish table. `cols` are header labels; each row is string cells. */
export function table(cols: string[], rows: string[][]): string {
  const widths = cols.map((c, i) => Math.max(c.length, ...rows.map((r) => (r[i] ?? '').length)));
  const line = (cells: string[]) => '| ' + cells.map((c, i) => c.padEnd(widths[i]!)).join(' | ') + ' |';
  const sep = '|' + widths.map((w) => '-'.repeat(w + 2)).join('|') + '|';
  return [line(cols), sep, ...rows.map(line)].join('\n');
}

export { ms };
