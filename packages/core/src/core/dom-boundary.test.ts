/**
 * DOM-boundary guard. @field-ui/core must stay renderer-agnostic: it computes field/force/particle/
 * metric/diagnostic logic and must not reach for browser globals. The two allowlisted exceptions are
 * `core/browser-host.ts` (the engine's one environment adapter — the default FieldHost) and
 * `export.ts` (the download-anchor helper). The engine (`core/field.ts`) routes every DOM touchpoint
 * through the injected FieldHost, so it is now DOM-global-free.
 *
 * This test scans every other core source file for DOM-global *call-sites* (matched as access /
 * construction patterns, so prose like "scan the document" or "debounce window" doesn't trip it) and
 * fails if a new one appears — so the boundary can't silently regress.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/core/src

// allowlisted DOM modules (paths relative to src, normalized to forward slashes): the browser host
// adapter (the engine's one environment binding) and the download-anchor helper. The engine itself
// (core/field.ts) is now renderer-agnostic — it routes all DOM access through the injected FieldHost.
const ALLOW = new Set(['core/browser-host.ts', 'export.ts']);

// DOM-global call-sites — access/construction patterns that won't appear in ordinary prose.
const FORBIDDEN: Array<[string, RegExp]> = [
  ['document.<member>', /\bdocument\.(querySelector|querySelectorAll|getElementById|createElement|documentElement|body|head|addEventListener|removeEventListener|hidden|dispatchEvent)\b/],
  ['window.<member>', /\bwindow\.(innerWidth|innerHeight|addEventListener|removeEventListener|scrollY|scrollX|devicePixelRatio|matchMedia|getComputedStyle)\b/],
  ['rAF/timers/media call', /\b(requestAnimationFrame|cancelAnimationFrame|getComputedStyle|matchMedia)\s*\(/],
  ['new <Observer>', /\bnew\s+(ResizeObserver|IntersectionObserver|MutationObserver)\b/],
];

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...tsFiles(full));
    else if (ent.name.endsWith('.ts') && !ent.name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

test('core stays renderer-agnostic: no DOM-global call-sites outside the allowlist', () => {
  const offenders: string[] = [];
  for (const file of tsFiles(SRC)) {
    const rel = relative(SRC, file).split(sep).join('/');
    if (ALLOW.has(rel)) continue;
    const code = readFileSync(file, 'utf8');
    for (const [label, re] of FORBIDDEN) {
      const m = re.exec(code);
      if (m) offenders.push(`${rel}: ${label} — "${m[0]}"`);
    }
  }
  assert.deepEqual(offenders, [], `core must not touch DOM globals outside ${[...ALLOW].join(', ')}:\n${offenders.join('\n')}`);
});

test('the allowlisted DOM modules still exist (guard stays honest)', () => {
  for (const rel of ALLOW) {
    assert.doesNotThrow(() => readFileSync(join(SRC, rel), 'utf8'), `${rel} should exist`);
  }
});
