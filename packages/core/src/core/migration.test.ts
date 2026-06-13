/**
 * Packaging conformance — the @fundamental-engine package family. After the field-ui →
 * fundamental-engine rename (a HARD rename: no compatibility shims, since there are no external
 * consumers yet), these tests pin the package metadata and the CSS-variable write-both contract
 * (source-level, since the live write-back needs a DOM/canvas the zero-dep harness can't reach).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../../..');
const readPkg = (rel: string): Record<string, unknown> =>
  JSON.parse(readFileSync(resolve(ROOT, rel, 'package.json'), 'utf8'));

// ── package metadata: the @fundamental-engine family ────────────────────────────────────────
test('canonical packages carry the @fundamental-engine scope', () => {
  assert.equal(readPkg('packages/core').name, '@fundamental-engine/core');
  assert.equal(readPkg('packages/elements').name, '@fundamental-engine/elements');
  assert.equal(readPkg('packages/react').name, '@fundamental-engine/react');
  assert.equal(readPkg('packages/vanilla').name, '@fundamental-engine/vanilla');
  assert.equal(readPkg('packages/three').name, '@fundamental-engine/three');
  assert.equal(readPkg('apps/site').name, '@fundamental-engine/site');
  // the bare one-install umbrella (was @field-ui/field-ui)
  assert.equal(readPkg('packages/fundamental-engine').name, 'fundamental-engine');
  assert.equal(readPkg('.').name, 'fundamental-engine-monorepo');
});

test('internal workspace deps point at the @fundamental-engine packages — no legacy scopes', () => {
  const els = readPkg('packages/elements') as { dependencies: Record<string, string> };
  assert.ok('@fundamental-engine/core' in els.dependencies, 'elements depends on @fundamental-engine/core');
  assert.ok('@fundamental-engine/vanilla' in els.dependencies, 'elements depends on @fundamental-engine/vanilla');
  for (const p of ['packages/react', 'packages/vanilla']) {
    const dep = (readPkg(p) as { dependencies: Record<string, string> }).dependencies;
    assert.ok('@fundamental-engine/core' in dep, `${p} depends on @fundamental-engine/core`);
    assert.ok(!('forces-ui' in dep) && !('@field-ui/core' in dep), `${p} carries no legacy (forces-ui / field-ui) scope`);
  }
});

// ── CSS variable write-back contract (source-level) ─────────────────────────────────────────
test('density write-back emits the --field-* variables (no --forces-* alias)', () => {
  // the engine's one write path is the sink contract (#228): the internal default sink
  // (feedback-sink.ts) performs the direct writes when no platform sink is configured.
  const src = readFileSync(resolve(ROOT, 'packages/core/src/core/feedback-sink.ts'), 'utf8');
  for (const v of ['--d', '--field-density', '--field-heatmap-density']) {
    assert.ok(src.includes(`setProperty('${v}'`), `feedback-sink.ts writes ${v}`);
  }
  assert.ok(!src.includes('--forces-'), 'feedback-sink.ts no longer writes any --forces-* alias');
  // cleanup must drop the field var too, so removing a body clears it
  const fieldSrc = readFileSync(resolve(ROOT, 'packages/core/src/core/field.ts'), 'utf8');
  assert.ok(fieldSrc.includes('--field-density'), 'clearWriteback covers --field-density');
});
