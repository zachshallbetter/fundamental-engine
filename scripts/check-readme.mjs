#!/usr/bin/env node
/**
 * Keeps the README files "living" — true to the code, not drifting from it. This is the README analog
 * of check:dist / check:api: it fails the build when a README states something the repository
 * contradicts. It checks the facts most prone to rot:
 *   1. every package has a README that names its real package (the title/install can't point at the
 *      wrong package),
 *   2. the root README's catalog counts (forces, presets, formations, render modes, patterns) match the
 *      live catalog,
 *   3. the root README names every publishable package.
 *
 * Run after a build (`pnpm -r build`). Wired into `pnpm check:readme` and CI.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const fail = (msg) => problems.push(msg);

const read = async (rel) => {
  const p = join(root, rel);
  if (!existsSync(p)) { fail(`missing file: ${rel}`); return ''; }
  return readFile(p, 'utf8');
};

// Every package directory that should carry a README naming its real package.
const PKG_DIRS = ['core', 'dom', 'elements', 'react', 'vanilla', 'three'];
const PUBLISHABLE = ['core', 'dom', 'elements', 'react', 'vanilla', 'three'];

// 1 · every package README exists and names its real package
for (const dir of PKG_DIRS) {
  const pkg = JSON.parse(await read(`packages/${dir}/package.json`) || '{}');
  const readme = await read(`packages/${dir}/README.md`);
  if (!readme) { fail(`packages/${dir}: README.md missing`); continue; }
  if (pkg.name && !readme.includes(pkg.name)) fail(`packages/${dir}/README.md does not name its package "${pkg.name}"`);
}

const rootReadme = await read('README.md');

// 2 · the root README's catalog counts match the live catalog
const core = await import(pathToFileURL(join(root, 'packages/core/dist/index.js')).href).catch((e) => {
  fail(`could not import core dist (run "pnpm -r build"): ${e.message}`);
  return null;
});
if (core) {
  const len = (x) => (Array.isArray(x) ? x.length : x?.size ?? Object.keys(x ?? {}).length);
  const COUNTS = [
    ['forces', len(core.MANUAL_FORCES)],
    ['presets', len(core.MANUAL_PRESETS)],
    ['formations', len(core.FORMATIONS)],
    ['render modes', len(core.RENDER_MODES)],
    ['patterns', len(core.FIELD_PATTERNS)],
  ];
  for (const [noun, n] of COUNTS) {
    // accept "<n> <noun>" anywhere (markdown bold/punctuation around the number is fine)
    const re = new RegExp(`\\b${n}\\s+${noun.replace(/ /g, '\\s+')}\\b`, 'i');
    if (!re.test(rootReadme)) {
      const stated = rootReadme.match(new RegExp(`\\b(\\d+)\\s+${noun.replace(/ /g, '\\s+')}\\b`, 'i'));
      fail(`README.md says "${stated ? stated[1] : '(none)'} ${noun}" but the catalog has ${n}. Update the count.`);
    }
  }
}

// 3 · the root README names every publishable package
for (const dir of PUBLISHABLE) {
  const name = JSON.parse(await read(`packages/${dir}/package.json`) || '{}').name;
  if (name && !rootReadme.includes(name)) fail(`README.md does not mention the package "${name}"`);
}

if (problems.length) {
  console.error(`✗ README check failed (${problems.length} problem(s)):`);
  for (const p of problems) console.error(`    ${p}`);
  console.error('\nThe READMEs drifted from the code. Update them (and re-run) so they stay living.');
  process.exit(1);
}
console.log(`✓ READMEs are living — ${PKG_DIRS.length} package READMEs named correctly, catalog counts match, all ${PUBLISHABLE.length} publishable packages referenced.`);
