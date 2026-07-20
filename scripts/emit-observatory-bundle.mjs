#!/usr/bin/env node
/**
 * Emit the Observatory evidence bundle.
 *
 * The runtime is authoritative: this script calls `captureBundle()` and writes what it returns. It
 * computes no findings, and it is the ONLY path by which evidence reaches the Observatory — the app
 * cannot import core (core's `exports` map is closed and it must stay DOM-free), which is what keeps
 * the instrument strictly downstream.
 *
 *   node scripts/emit-observatory-bundle.mjs [--out <path>]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outIndex = process.argv.indexOf('--out');
const outPath = outIndex > -1 && process.argv[outIndex + 1]
  ? resolve(process.argv[outIndex + 1])
  : join(root, 'apps', 'observatory', 'public', 'bundle.json');

function commit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function coreVersion() {
  try {
    return JSON.parse(readFileSync(join(root, 'packages', 'core', 'package.json'), 'utf8')).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

const { captureBundle } = await import(join(root, 'packages', 'core', 'src', 'world', 'observatory', 'capture.ts'));
const bundle = captureBundle({ commit: commit(), coreVersion: coreVersion() });

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(bundle, null, 2));

const kb = Math.round(Buffer.byteLength(JSON.stringify(bundle)) / 1024);
console.log(`✓ observatory bundle → ${outPath.replace(root + '/', '')} (${kb} KB)`);
console.log(`  revision ${bundle.revision.commit} · schema ${bundle.revision.bundleSchema}`);
console.log(`  ${bundle.runs.length} runs · ${bundle.projections.length} projections · ${bundle.detections.length} detections · ${bundle.ablations.length} ablations`);
console.log(`  ${bundle.evidence.length} evidence nodes · ${bundle.pendingSubstrates.length} pending substrates`);
