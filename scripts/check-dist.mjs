#!/usr/bin/env node
/**
 * Pre-publish dist smoke check. For each published package, verify that:
 *   1. every declared entry point (`main` / `module` / `types` and the `exports` map) resolves
 *      to a real built file,
 *   2. every `files` entry exists, and
 *   3. the built entry actually imports — resolving its own deps and workspace deps.
 *
 * This catches the exports-map / `files` / build-output mistakes that typecheck and unit tests
 * can't see: the class of bug that only surfaces on the first `npm publish`. Run after a build
 * (`pnpm -r build`). Used by CI and the publish checklist (PUBLISHING.md).
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = ['core', 'platform', 'vanilla', 'elements', 'react'];

/** Collect every relative file path the package.json points at as an entry point. */
function entryRefs(pkg) {
  const refs = new Set();
  for (const k of ['main', 'module', 'types']) if (typeof pkg[k] === 'string') refs.add(pkg[k]);
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
