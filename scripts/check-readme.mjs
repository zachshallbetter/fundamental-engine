#!/usr/bin/env node
/**
 * Keeps the README files "living" — true to the code, not drifting from it. This is the README analog
 * of check:dist / check:api: it fails the build when a README states something the repository
 * contradicts. It checks the facts most prone to rot:
 *   1. every package has a README that names its real package (the title/install can't point at the
 *      wrong package),
 *   2. no README calls the core package `@field-ui/core` (it is published as `field-ui`),
 *   3. the root README's catalog counts (forces, presets, formations, render modes, recipes) match the
 *      live catalog,
 *   4. the root README names all five publishable packages.
 *
 * Run after a build (`pnpm -r build`). Wired into `pnpm check:readme` and CI.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const fail = (msg) => problems.push(msg);

const read = async (rel) => {
  const p = join(root, rel);
  if (!existsSync(p)) { fail(`missing file: ${rel}`); return ''; }
  return readFile(p, 'utf8');
};

// Every package directory that should carry a README naming its real package.
const PKG_DIRS = ['core', 'platform', 'elements', 'react', 'vanilla', 'compat-core', 'compat-elements', 'compat-react', 'compat-vanilla'];
const PUBLISHABLE = ['core', 'platform', 'elements', 'react', 'vanilla'];

// 1 · every package README exists and names its real package
for (const dir of PKG_DIRS) {
  const pkg = JSON.parse(await read(`packages/${dir}/package.json`) || '{}');
  const readme = await read(`packages/${dir}/README.md`);
  if (!readme) { fail(`packages/${dir}: README.md missing`); continue; }
  if (pkg.name && !readme.includes(pkg.name)) fail(`packages/${dir}/README.md does not name its package "${pkg.name}"`);
  // 2 · no README may use the wrong core name
  if (readme.includes('@field-ui/core')) fail(`packages/${dir}/README.md uses "@field-ui/core" — the core package is published as "field-ui"`);
}

const rootReadme = await read('README.md');
const docsReadme = await read('docs/README.md');
if (rootReadme.includes('@field-ui/core')) fail('README.md uses "@field-ui/core" — the core package is published as "field-ui"');
if (docsReadme.includes('@field-ui/core')) fail('docs/README.md uses "@field-ui/core" — the core package is published as "field-ui"');

// 3 · the root README's catalog counts match the live catalog
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
    ['recipes', len(core.FIELD_RECIPES)],
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

// 4 · the root README names all five publishable packages
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
console.log(`✓ READMEs are living — ${PKG_DIRS.length} package READMEs named correctly, catalog counts match, all five publishable packages referenced.`);
