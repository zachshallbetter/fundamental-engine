#!/usr/bin/env node
/**
 * Typechecks the TypeScript code blocks in the READMEs against the built packages' public types.
 *
 * check:readme keeps the READMEs' catalog *counts* true; this keeps their *code* true. A README
 * example once passed `rect: () => ({ x, y, width, height })` where the API takes `left`/`top` — it
 * typechecks as an error, but nothing compiled it, so the flagship headless example silently built an
 * empty field. Every ```ts / ```tsx block in the scanned READMEs is now compiled as its own module
 * against `packages/<pkg>/dist/index.d.ts` (strict). Snippets may reference the handful of ambient
 * names declared in PRELUDE (a field handle, an element, …) without declaring them; anything else
 * must compile as written.
 *
 * Two HTML-comment directives (invisible in rendered markdown) go on the line directly above a fence:
 *   <!-- check:readme-code prelude: declare const card: HTMLElement; -->
 *     — single-line TypeScript prepended to that block only: the setup a fragment assumes (an element,
 *       a data array, an import the surrounding prose already showed). The block is still checked.
 *   <!-- check:readme-code skip -->
 *     — the block is not compiled at all. Reserve it for pseudo-code and snippets that need a
 *       dependency this check does not install (e.g. `three`).
 *
 * Run after a build (`pnpm -r build`). Wired into `pnpm check:readme-code` and CI.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requireFrom = (pkgDir) => createRequire(join(root, pkgDir, 'package.json'));
const ts = requireFrom('packages/core')('typescript');

const READMES = [
  'README.md',
  'packages/core/README.md',
  'packages/dom/README.md',
  'packages/vanilla/README.md',
  'packages/react/README.md',
  'packages/three/README.md',
];
const SKIP = '<!-- check:readme-code skip -->';
const PRELUDE_RE = /^<!-- check:readme-code prelude: (.*) -->$/;

// Free names a README snippet may use without declaring them — the "you already have one of these"
// context every example assumes. A snippet that declares its own shadows these (module scope).
const PRELUDE = `
import type { FieldHandle } from '@fundamental-engine/core';
declare global {
  const field: FieldHandle;
  const el: HTMLElement;
  const root: HTMLElement;
  const canvas: HTMLCanvasElement;
}
export {};
`;

const pkgTypes = (p) => [join(root, `packages/${p}/dist/index.d.ts`)];
const paths = {
  '@fundamental-engine/core': pkgTypes('core'),
  '@fundamental-engine/dom': pkgTypes('dom'),
  '@fundamental-engine/vanilla': pkgTypes('vanilla'),
  '@fundamental-engine/react': pkgTypes('react'),
  '@fundamental-engine/elements': pkgTypes('elements'),
  '@fundamental-engine/three': pkgTypes('three'),
};

// ── extract the blocks ────────────────────────────────────────────────────────────────────────
const blocks = [];
let skipped = 0;
for (const rel of READMES) {
  const lines = readFileSync(join(root, rel), 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const open = /^```(ts|tsx|typescript)\s*$/.exec(lines[i]);
    if (!open) continue;
    const start = i;
    const body = [];
    for (i++; i < lines.length && !/^```\s*$/.test(lines[i]); i++) body.push(lines[i]);
    const above = lines[start - 1]?.trim() ?? '';
    if (above === SKIP) { skipped++; continue; }
    const prelude = PRELUDE_RE.exec(above)?.[1] ?? '';
    blocks.push({ rel, line: start + 1, ext: open[1] === 'tsx' ? 'tsx' : 'ts', prelude, code: body.join('\n') });
  }
}

// ── compile each block as its own module ──────────────────────────────────────────────────────
const dir = mkdtempSync(join(tmpdir(), 'readme-code-'));
const files = [join(dir, 'prelude.ts')];
writeFileSync(files[0], PRELUDE);
const origin = new Map();
blocks.forEach((b, n) => {
  const f = join(dir, `block-${n}.${b.ext}`);
  // the prelude is file line 0, so the block's first line is file line 1
  writeFileSync(f, `${b.prelude}\n${b.code}\nexport {};\n`);
  files.push(f);
  origin.set(f, b);
});

const reactTypes = dirname(requireFrom('packages/react').resolve('@types/react/package.json'));
const threeTypes = dirname(requireFrom('packages/three').resolve('@types/three/package.json'));
const program = ts.createProgram(files, {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  types: [],
  baseUrl: dir,
  paths: { ...paths, react: [join(reactTypes, 'index.d.ts')], 'react/jsx-runtime': [join(reactTypes, 'jsx-runtime.d.ts')], three: [join(threeTypes, 'index.d.ts')] },
});

const problems = [];
for (const d of ts.getPreEmitDiagnostics(program)) {
  const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
  const b = d.file && origin.get(d.file.fileName);
  if (b && d.start !== undefined) {
    const { line } = d.file.getLineAndCharacterOfPosition(d.start);
    const where = line === 0 ? `${b.line - 1} (prelude)` : `${b.line + line}`;
    problems.push(`${b.rel}:${where}  ${msg}`);
  } else {
    problems.push(`${d.file?.fileName ?? '(global)'}  ${msg}`);
  }
}
rmSync(dir, { recursive: true, force: true });

if (problems.length) {
  console.error(`✗ README code check failed (${problems.length} error(s) across ${blocks.length} blocks):`);
  for (const p of problems) console.error(`    ${p}`);
  console.error(`\nFix the example (or, for a deliberate fragment, put "${SKIP}" on the line above its fence).`);
  process.exit(1);
}
console.log(`✓ README code compiles — ${blocks.length} TypeScript blocks typechecked against the built packages (${skipped} marked skip).`);
