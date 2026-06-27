#!/usr/bin/env node
/**
 * Packaging correctness gate. Run after `pnpm build`.
 *
 * For each published @fundamental-engine/* package:
 *   1. publint  — exports map, types conditions, file presence in dist
 *   2. attw     — TypeScript resolution under all module/bundler conditions
 *
 * A clean run means `npm view <pkg> version` would deliver what the exports claim.
 * For entry-point file existence + live import checks, see scripts/check-dist.mjs.
 */
import { publint } from 'publint';
import { formatMessage } from 'publint/utils';
import { readFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = [
  // the published @fundamental-engine/* set (publish via CI). `dom` is the DOM-binding
  // layer; `platform` is the deprecated alias re-exporting it. The kit / fundamental-engine
  // umbrellas were retired (private) at 0.7.0.
  'core', 'dom', 'platform', 'vanilla', 'elements', 'react', 'three',
];

let failed = 0;

// ── 1. publint ───────────────────────────────────────────────────────────────

const SEP = '─'.repeat(50);
console.log(`publint\n${SEP}`);

for (const p of PACKAGES) {
  const dir = join(root, 'packages', p);
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
  const { messages } = await publint({ pkgDir: dir });

  const errors      = messages.filter(m => m.type === 'error');
  const warnings    = messages.filter(m => m.type === 'warning');
  const suggestions = messages.filter(m => m.type === 'suggestion');

  if (errors.length) {
    failed++;
    console.error(`✗ ${pkg.name}`);
    for (const m of errors)   console.error(`    error: ${formatMessage(m, pkg)}`);
  } else {
    const warnStr = warnings.length ? ` — ${warnings.length} warning(s)` : '';
    console.log(`✓ ${pkg.name}${warnStr}`);
  }
  for (const m of warnings)    console.warn(`    warn:  ${formatMessage(m, pkg)}`);
  for (const m of suggestions) console.log(`    hint:  ${formatMessage(m, pkg)}`);
}

// ── 2. @arethetypeswrong/cli (attw) ─────────────────────────────────────────
// Uses --pack so it packs the directory exactly as `pnpm publish` would. In a
// pnpm workspace, attw detects pnpm-lock.yaml and delegates to `pnpm pack`,
// which rewrites workspace:* deps to real semver before packing.

console.log(`\n@arethetypeswrong/cli\n${SEP}`);

const attw = join(root, 'node_modules', '.bin', 'attw');

// Per-package attw overrides. The vanilla single-file (vendorable) build (#585) adds two
// non-standard entrypoints: `./standalone` is a typed ESM import (it reuses the package types)
// but, being a subpath export, legitimately doesn't resolve under the legacy node10 algorithm —
// so `no-resolution` is ignored. `./standalone.global.js` is an IIFE `<script src>` artifact, not
// an importable typed module, so it is excluded from resolution checking entirely.
const ATTW_OVERRIDES = {
  vanilla: [
    '--ignore-rules', 'no-resolution',
    '--exclude-entrypoints', './standalone.global.js',
  ],
};

for (const p of PACKAGES) {
  const dir = join(root, 'packages', p);
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
  console.log(`\n${pkg.name}`);

  const result = spawnSync(attw, ['--pack', dir, ...(ATTW_OVERRIDES[p] ?? [])], {
    stdio: 'inherit',
    cwd:   root,
  });

  if (result.status !== 0) failed++;
}

// ── summary ──────────────────────────────────────────────────────────────────

if (failed > 0) {
  console.error(`\n✗ ${failed} package(s) failed packaging checks.`);
  process.exit(1);
}
console.log(`\n✓ All ${PACKAGES.length} packages passed packaging checks.`);
