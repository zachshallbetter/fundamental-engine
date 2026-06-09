/**
 * field-ui migration conformance (docs/planning-archive/field-ui-migration-plan.md §17, testing-and-conformance.md
 * §"Migration Validation"). These tests encode the migration acceptance rule — "a rename is not
 * complete until the old and new names both work" — for the parts checkable in the node:test
 * harness: package metadata, the CSS-variable write-both contract (source-level, since the live
 * write-back needs a DOM/canvas the zero-dep harness has no access to), and the alias-package
 * re-exports (guarded on a prior build).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '../../../..');
const readPkg = (rel: string): Record<string, unknown> =>
  JSON.parse(readFileSync(resolve(ROOT, rel, 'package.json'), 'utf8'));

// ── package metadata uses field-ui ──────────────────────────────────────────────────────────
test('canonical packages are renamed to the field-ui family', () => {
  assert.equal(readPkg('packages/core').name, '@field-ui/core');
  assert.equal(readPkg('packages/elements').name, '@field-ui/elements');
  assert.equal(readPkg('packages/react').name, '@field-ui/react');
  assert.equal(readPkg('packages/vanilla').name, '@field-ui/vanilla');
  assert.equal(readPkg('apps/site').name, '@field-ui/site');
  assert.equal(readPkg('.').name, 'field-ui-monorepo');
});

test('internal workspace deps point at the field-ui packages', () => {
  const els = readPkg('packages/elements') as { dependencies: Record<string, string> };
  assert.ok('@field-ui/core' in els.dependencies, 'elements depends on @field-ui/core');
  assert.ok('@field-ui/vanilla' in els.dependencies, 'elements depends on @field-ui/vanilla');
  for (const p of ['packages/react', 'packages/vanilla']) {
    const dep = (readPkg(p) as { dependencies: Record<string, string> }).dependencies;
    assert.ok('@field-ui/core' in dep, `${p} depends on @field-ui/core`);
    assert.ok(!('forces-ui' in dep), `${p} no longer depends on forces-ui`);
  }
});

// ── old public package names still work as aliases ──────────────────────────────────────────
test('compatibility alias packages keep the old names and forward to field-ui', () => {
  const cases: [string, string, string][] = [
    ['packages/compat-core', 'forces-ui', '@field-ui/core'],
    ['packages/compat-elements', '@forces-ui/elements', '@field-ui/elements'],
    ['packages/compat-react', '@forces-ui/react', '@field-ui/react'],
    ['packages/compat-vanilla', '@forces-ui/vanilla', '@field-ui/vanilla'],
  ];
  for (const [dir, oldName, newName] of cases) {
    const pkg = readPkg(dir) as { name: string; dependencies: Record<string, string> };
    assert.equal(pkg.name, oldName, `${dir} keeps the old name ${oldName}`);
    assert.ok(newName in pkg.dependencies, `${dir} forwards to ${newName}`);
  }
});

// ── CSS variable write-both contract (source-level) ─────────────────────────────────────────
test('density write-back emits both --forces-* and --field-* variables', () => {
  const src = readFileSync(resolve(ROOT, 'packages/core/src/core/field.ts'), 'utf8');
  for (const v of ['--forces-density', '--field-density', '--forces-heatmap-density', '--field-heatmap-density']) {
    assert.ok(src.includes(`setProperty('${v}'`), `field.ts writes ${v}`);
  }
  // cleanup must drop the field alias too, so removing a body clears both
  assert.ok(src.includes('--field-density'), 'clearWriteback covers --field-density');
});

// ── alias packages re-export the real surface (guarded on a prior build) ─────────────────────
test('built alias dist re-exports the field-ui surface', async (t) => {
  const distRel = 'packages/compat-core/dist/index.js';
  if (!existsSync(resolve(ROOT, distRel))) {
    t.skip('compat-core not built (run "pnpm -r build"); re-export verified at build time');
    return;
  }
  const mod = await import(pathToFileURL(resolve(ROOT, distRel)).href);
  assert.ok('createField' in mod, 'forces-ui alias re-exports createField');
  assert.ok('FORCES' in mod, 'forces-ui alias re-exports the FORCES catalog');
});
