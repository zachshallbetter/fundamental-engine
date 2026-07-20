#!/usr/bin/env node
/**
 * Runtime half of the public-API freeze (the type/value half is `scripts/api-surface.ts`, typechecked
 * by tsconfig.api.json). This script verifies the parts tsc can't see:
 *   1. every frozen VALUE actually resolves at runtime in its package's built dist,
 *   2. every frozen TYPE is exported in the package source,
 *   3. every frozen custom-element TAG is registered (customElements.define) in the elements dist,
 *   4. the body contract — the `data-body` attribute — is still in core's BODY_SELECTOR,
 *   5. the hard gate (api-surface.ts) and this data file (api-surface.data.mjs) name the same symbols.
 *
 * Run after a build (`pnpm -r build`). Wired into `pnpm check:api` and CI, alongside `check:dist`.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import {
  PROTECTED_VALUES, PROTECTED_TYPES, PROTECTED_ELEMENTS, PROTECTED_BODY_ATTR,
} from './api-surface.data.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = { '@fundamental-engine/core': 'core', '@fundamental-engine/dom': 'dom', '@fundamental-engine/elements': 'elements', '@fundamental-engine/react': 'react', '@fundamental-engine/vanilla': 'vanilla' };
const distOf = (pkg) => join(root, 'packages', DIR[pkg], 'dist', 'index.js');
const srcOf = (pkg) => join(root, 'packages', DIR[pkg], 'src');

const problems = [];
const fail = (msg) => problems.push(msg);

// Cache each package's runtime module (by dist path — bare specifiers don't resolve from the root).
const mods = new Map();
async function moduleFor(pkg) {
  if (!mods.has(pkg)) {
    const p = distOf(pkg);
    if (!existsSync(p)) { fail(`${pkg}: dist not built (${p}) — run "pnpm -r build"`); mods.set(pkg, {}); }
    else mods.set(pkg, await import(pathToFileURL(p).href));
  }
  return mods.get(pkg);
}

// grep helper (returns true if the pattern is found anywhere under dir)
function greps(dir, pattern) {
  try {
    execFileSync('grep', ['-rqE', pattern, dir]);
    return true;
  } catch {
    return false;
  }
}

// 1 · frozen values resolve at runtime
for (const { pkg, name } of PROTECTED_VALUES) {
  const mod = await moduleFor(pkg);
  if (!(name in mod)) fail(`removed from the public surface: ${pkg} → ${name} (no longer exported by the built dist). If this removal is intended, drop it from api-surface.data.mjs in this change and add a CHANGELOG migration note.`);
}

// 2 · frozen types exported in source
for (const { pkg, name } of PROTECTED_TYPES) {
  const pat = `export (interface|type|class|enum) ${name}\\b|export (type )?\\{[^}]*\\b${name}\\b`;
  if (!greps(srcOf(pkg), pat)) fail(`removed from the public surface: ${pkg} → ${name} (no exported type declaration found in src). If intended, drop it from api-surface.data.mjs and add a CHANGELOG migration note.`);
}

// 3 · frozen custom-element tags registered
for (const { pkg, tag } of PROTECTED_ELEMENTS) {
  const distDir = join(root, 'packages', DIR[pkg], 'dist');
  if (!greps(distDir, `customElements\\.define\\('${tag}'`)) fail(`removed from the public surface: <${tag}> (no customElements.define('${tag}') in ${pkg} dist). If intended, drop it from api-surface.data.mjs and add a CHANGELOG migration note.`);
}

// 4 · the body attribute contract
const core = await moduleFor('@fundamental-engine/core');
if (typeof core.BODY_SELECTOR !== 'string' || !core.BODY_SELECTOR.includes(`[${PROTECTED_BODY_ATTR}]`)) {
  fail(`body contract broken: core BODY_SELECTOR no longer matches [${PROTECTED_BODY_ATTR}] (got: ${JSON.stringify(core.BODY_SELECTOR)})`);
}

// 5 · the hard gate (api-surface.ts) and this data file name the same frozen values
const lockSrc = await readFile(join(root, 'scripts', 'api-surface.ts'), 'utf8');
for (const { name } of PROTECTED_VALUES) {
  if (!new RegExp(`\\b${name}\\b`).test(lockSrc)) fail(`drift: ${name} is listed in api-surface.data.mjs but not referenced in api-surface.ts (the type/value gate)`);
}
for (const { name } of PROTECTED_TYPES) {
  if (!new RegExp(`\\b${name}\\b`).test(lockSrc)) fail(`drift: type ${name} is listed in api-surface.data.mjs but not referenced in api-surface.ts`);
}

const total = PROTECTED_VALUES.length + PROTECTED_TYPES.length + PROTECTED_ELEMENTS.length + 1;
if (problems.length) {
  console.error(`✗ public API surface check failed (${problems.length} problem(s)):`);
  for (const p of problems) console.error(`    ${p}`);
  console.error('\nThe frozen 0.x surface changed. If this is intentional, update scripts/api-surface.{ts,data.mjs}');
  console.error('and docs/canonical/api-stability.md with a migration note + a 0.MINOR bump.');
  process.exit(1);
}
console.log(`✓ public API surface intact (no removals) — ${total} protected entries (${PROTECTED_VALUES.length} values, ${PROTECTED_TYPES.length} types, ${PROTECTED_ELEMENTS.length} elements, the [${PROTECTED_BODY_ATTR}] body contract).`);
