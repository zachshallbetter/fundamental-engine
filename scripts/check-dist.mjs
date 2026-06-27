#!/usr/bin/env node
/**
 * Dist smoke check. For each published package, verify that:
 *   1. every declared entry point (`main` / `types` and the `exports` map) resolves
 *      to a real built file,
 *   2. every `files` entry exists, and
 *   3. the built entry actually imports — resolving its own deps and workspace deps.
 *
 * This catches build-output / exports-map / `files` mistakes that typecheck and unit tests
 * can't see. Run after `pnpm build`. Used by CI and the publish checklist (PUBLISHING.md).
 *
 * (not published to npm; validated here to keep the migration-path code honest). For deeper exports-map
 * and TypeScript-resolution checks, see scripts/check-packaging.mjs (publint + attw).
 */
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = [
  // every published @fundamental-engine/* package (via CI). `dom` is the canonical DOM binding
  // since 0.7.0; `platform` is its retained deprecated alias; `three` is the WebGL surface.
  'core', 'dom', 'platform', 'vanilla', 'elements', 'react', 'three',
];

/** Collect every relative file path the package.json points at as an entry point. */
function entryRefs(pkg) {
  const refs = new Set();
  for (const k of ['main', 'types']) if (typeof pkg[k] === 'string') refs.add(pkg[k]);
  const walk = (v) => {
    if (typeof v === 'string') refs.add(v);
    else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x);
  };
  if (pkg.exports) walk(pkg.exports);
  return [...refs].filter((r) => r.startsWith('.') && !r.endsWith('package.json'));
}

let failed = 0;
for (const p of PACKAGES) {
  const dir = join(root, 'packages', p);
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
  const problems = [];

  for (const ref of entryRefs(pkg)) {
    if (!existsSync(join(dir, ref))) problems.push(`entry not built: ${ref} (run "pnpm -r build")`);
  }
  for (const f of pkg.files ?? []) {
    const base = f.split('/')[0].replace(/\*.*$/, '');
    if (base && !existsSync(join(dir, base))) problems.push(`files[] path missing: ${f}`);
  }
  try {
    await import(pathToFileURL(join(dir, pkg.main ?? 'dist/index.js')).href);
  } catch (e) {
    problems.push(`import failed: ${e.message}`);
  }

  // The vanilla single-file (vendorable) build (#585): both standalone artifacts must exist, be
  // self-contained (no bare `@fundamental-engine/*` import a no-bundler consumer can't resolve),
  // and stay under a sane size budget so the "drop in one <script>" path doesn't silently bloat.
  if (p === 'vanilla') {
    const STANDALONE_MAX_KB = 160; // self-bundled vanilla→dom→core; well above ~90 kB today
    for (const f of ['dist/standalone.js', 'dist/standalone.global.js']) {
      const fp = join(dir, f);
      if (!existsSync(fp)) {
        problems.push(`standalone build missing: ${f} (run "pnpm --filter @fundamental-engine/vanilla build:standalone")`);
        continue;
      }
      const src = await readFile(fp, 'utf8');
      if (/(?:^|[^.\w])(?:import|from|require)\s*\(?\s*['"]@fundamental-engine\//.test(src)) {
        problems.push(`standalone build not self-contained: ${f} still has bare @fundamental-engine/* imports`);
      }
      const kb = statSync(fp).size / 1024;
      if (kb > STANDALONE_MAX_KB) {
        problems.push(`standalone build too large: ${f} is ${kb.toFixed(1)} kB (budget ${STANDALONE_MAX_KB} kB)`);
      }
    }
  }

  if (problems.length) {
    failed++;
    console.error(`✗ ${pkg.name}`);
    for (const pr of problems) console.error(`    ${pr}`);
  } else {
    console.log(`✓ ${pkg.name}`);
  }
}

if (failed) {
  console.error(`\n${failed} package(s) failed the dist smoke check.`);
  process.exit(1);
}
console.log(`\nAll ${PACKAGES.length} packages passed the dist smoke check.`);
