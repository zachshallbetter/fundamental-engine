/**
 * `sideEffects` must list every module that registers a custom element at import time. A bundler that
 * honours the field (webpack, Rollup, esbuild, Vite) drops a module flagged side-effect-free when none
 * of its exports are used — and `import '@fundamental-engine/elements'` uses none. `field-cell.js`
 * (reached from index.js only via `export *`) was missing, so a bundled page never defined
 * `<field-cell>` (engine audit 2026-10-14, M13; reproduced with esbuild). This keeps the list in step
 * with the source: any module that calls `customElements.define` at its top level must be listed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const src = new URL('./', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { sideEffects: string[] | boolean };

// A registration at module scope starts at column 0 — the package's idiom is a guarded
// `if (typeof customElements !== 'undefined' …)` block (or a bare `customElements.define(`). Calls
// indented inside a class or function don't run on import and aren't matched.
const registersAtTopLevel = (code: string): boolean => /^(if \(typeof customElements|customElements\.define\()/m.test(code);

test('every module that registers a custom element on import is listed in sideEffects', () => {
  assert.ok(Array.isArray(pkg.sideEffects), 'sideEffects is an explicit list');
  const listed = new Set(pkg.sideEffects as string[]);
  const registering = readdirSync(src)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.d.ts'))
    .filter((f) => registersAtTopLevel(readFileSync(new URL(f, src), 'utf8')))
    .map((f) => `./dist/${f.replace(/\.ts$/, '.js')}`);
  assert.ok(registering.includes('./dist/index.js'), 'the scan finds index.js (<field-root>) — guard is not vacuous');
  assert.ok(registering.includes('./dist/field-cell.js'), 'the scan finds field-cell.js (<field-cell>)');
  for (const m of registering) assert.ok(listed.has(m), `${m} registers a custom element but is not in sideEffects`);
});
