#!/usr/bin/env node
/**
 * RC-7 — the performance-budget gate. Compares measurements against docs/planning/perf-budgets.json
 * and exits non-zero on regression. Budgets are SOURCED FROM THE FACT SHEET, never invented (gate spec
 * §0.4): each budget is the measured value at the fact sheet's cut, times the headroom the sheet states.
 *
 *   node scripts/perf/check-budgets.mjs --compute perf/compute.json [--gpu perf/titan-dpr1.json ...]
 *
 * --compute: the JSON the Node bench emits with BENCH_JSON=1 (packages/core/bench/field-bench.ts).
 * --gpu:     one or more sweep-gpu.mjs measurement files (fill-rate + real-page LoAF / heap).
 * Each budget line is checked only when the corresponding measurement is present — a compute-only run
 * (e.g. a hosted runner) gates compute alone and says so.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const opt = (name) => { const out = []; for (let i = 0; i < argv.length; i++) if (argv[i] === `--${name}`) out.push(argv[++i]); return out; };
const budgets = JSON.parse(readFileSync(resolve(root, 'docs/planning/perf-budgets.json'), 'utf8'));
const failures = [];
const checks = [];
const check = (name, value, limit, unit, higherIsBetter = false) => {
  if (value == null || Number.isNaN(value)) { checks.push(`  · ${name}: (not measured)`); return; }
  const ok = higherIsBetter ? value >= limit : value <= limit;
  checks.push(`  ${ok ? '✓' : '✗'} ${name}: ${value.toFixed(2)} ${unit} (budget ${higherIsBetter ? '≥' : '≤'} ${limit} ${unit})`);
  if (!ok) failures.push(name);
};

for (const file of opt('compute')) {
  const m = JSON.parse(readFileSync(resolve(file), 'utf8'));
  console.log(`compute · ${file} (Node ${m.node})`);
  for (const b of budgets.compute.frameMs) {
    const row = m.frameScaling.find((r) => r.density === b.density);
    check(`frame ms (median) at density ${b.density}`, row?.medianMs, b.maxMedianMs, 'ms');
  }
  check('accumulator overhead', m.accumulatorOverheadPct, budgets.compute.accumulatorOverheadMaxPct, '%');
  check('query() global', m.readApi.queryGlobalMs, budgets.compute.queryGlobalMaxMs, 'ms');
  check('snapshot()', m.readApi.snapshotMs, budgets.compute.snapshotMaxMs, 'ms');
}
for (const file of opt('gpu')) {
  const m = JSON.parse(readFileSync(resolve(file), 'utf8'));
  const gb = budgets.gpu[m.label];
  if (!gb) { console.log(`gpu · ${file}: no budget block for label "${m.label}" — measured only, not gated`); continue; }
  console.log(`gpu · ${file} · ${m.gpu} · dpr ${m.dpr}`);
  for (const b of gb.sweep) {
    const row = m.sweep.find((r) => r.render === b.render && r.dprCap === b.dprCap && r.density === b.density);
    check(`frame ms (median) render=${b.render} dprCap=${b.dprCap} density=${b.density} (${row?.fpsMed ?? '?'} fps)`, row?.msMed, b.maxMsMed, 'ms');
  }
  for (const b of gb.compositing ?? []) {
    const row = m.compositing.find((r) => r.overlay === b.overlay && r.dprCap === b.dprCap);
    check(`compositing frame ms (median) overlay=${b.overlay} dprCap=${b.dprCap} (${row?.fpsMed ?? '?'} fps)`, row?.msMed, b.maxMsMed, 'ms');
  }
  for (const [path, b] of Object.entries(gb.pages ?? {})) {
    const p = m.pages[path];
    check(`${path} frame ms (median)`, p?.msMed, b.maxMsMed, 'ms');
    check(`${path} frame ms (p95)`, p?.msP95, b.maxMsP95, 'ms');
    checks.push(`  · ${path} long tasks ≥ 50 ms in ${p?.seconds ?? 20} s: ${p?.loafCount}  (recorded, not gated — measured ${b.measuredLongTasks} when the budgets were written)`);
    check(`${path} Total Blocking Time`, p?.tbtMs, b.maxTbtMs, 'ms');
    check(`${path} JS heap after ${p?.seconds ?? 20} s`, p?.heapEndMB, b.maxHeapMB, 'MB');
  }
}
console.log(checks.join('\n'));
if (failures.length) { console.log(`\n✗ ${failures.length} budget(s) exceeded — see docs/planning/fundamental-perf-fact-sheet.md for how budgets are sourced.`); process.exit(1); }
console.log('\n✓ every measured value is within its budget.');
