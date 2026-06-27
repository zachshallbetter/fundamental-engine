#!/usr/bin/env node
/**
 * Single-file (vendorable) build for the "no build step" consumer (#585).
 *
 * The shipped dist is unbundled ESM whose cross-package imports (`@fundamental-engine/dom`,
 * `@fundamental-engine/core`) a plain `<script type=module>` / `file://` / vendored copy
 * cannot resolve without a bundler or import map. This emits two self-contained artifacts so
 * a consumer can drop in one `<script>` with no bundler and no import map:
 *
 *   dist/standalone.js        — bundled ESM   (`import { createField } from '.../standalone.js'`)
 *   dist/standalone.global.js — IIFE that exposes a `Fundamental` global (no module loader at all)
 *
 * Run after the tsc build (it bundles from `dist/index.js`). Wired as `pnpm --filter
 * @fundamental-engine/vanilla build:standalone`; CI runs it in the build gate and check-dist
 * size-checks the result.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { statSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = resolve(here, '..');
const entry = join(pkgDir, 'dist', 'index.js');
const outEsm = join(pkgDir, 'dist', 'standalone.js');
const outIife = join(pkgDir, 'dist', 'standalone.global.js');

const banner = {
  js:
    '/*! @fundamental-engine/vanilla — single-file build (no bundler, no import map). ' +
    'See README "Vendor / CDN (single file)". MIT. */',
};

// Bundle the ESM door: every @fundamental-engine/* import is inlined, so the output has no
// bare specifiers and resolves from a plain <script type=module> or a vendored file.
await build({
  entryPoints: [entry],
  outfile: outEsm,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  banner,
});

// Bundle the IIFE door: same surface under a `Fundamental` global, for pages that want zero
// module machinery (`<script src=...>` then `Fundamental.createField(...)`).
//
// `logOverride` silences the benign `empty-import-meta` warning: the only `import.meta.url`
// use is in the opt-in off-thread render bridge (`attachOffthreadRender`), which the vanilla
// door never re-exports, so it is tree-shaken out of both bundles (a Worker is a separate file
// and cannot be inlined into a single artifact anyway). Verified absent in build verification.
await build({
  entryPoints: [entry],
  outfile: outIife,
  bundle: true,
  format: 'iife',
  globalName: 'Fundamental',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  banner,
  logOverride: { 'empty-import-meta': 'silent' },
});

const kb = (p) => (statSync(p).size / 1024).toFixed(1);
console.log(`✓ standalone ESM   dist/standalone.js        ${kb(outEsm)} kB`);
console.log(`✓ standalone IIFE  dist/standalone.global.js ${kb(outIife)} kB`);
