/**
 * Visual language tests (Phase 6). The mappings are pure, so each is checked deterministically:
 * ranged mapping + falloff math, bounded typography/color/emission, the accessibility caps, the
 * lint rules firing on misconfigured scenes, and the semantic-text fallback.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerp } from '../core/math.ts';
import { clamp01, mapRange, falloff, curve } from './mapping.ts';
import { typography, typographyCss, fieldColor, hslString, emission, DEFAULT_COLOR_CAPS, type Hsl } from './channels.ts';
import { runVisualLint } from './lint.ts';
import { hasAccessibleText, semanticGlyphMarkup, type TextNodeLike } from './semantic-text.ts';
import { VISUAL_CONTRACTS, VISUAL_AUTHORING_ATTRIBUTES } from './index.ts';
import { FIELD_DESIGN_TOKENS, fieldTokensCss, isFieldRole, FIELD_OUTPUT_VARS } from './tokens.ts';

test('mapping primitives: clamp, lerp, mapRange, falloff, curve', () => {
  assert.equal(clamp01(2), 1);
  assert.equal(clamp01(-1), 0);
  assert.equal(lerp(0, 10, 0.5), 5);
  assert.equal(mapRange(5, 0, 10, 0, 100), 50);
  assert.equal(mapRange(99, 0, 10, 0, 100), 100, 'clamps above range');
  assert.equal(falloff(0, 100), 1);
  assert.equal(falloff(100, 100), 0);
  assert.ok(falloff(50, 100) > 0 && falloff(50, 100) < 1);
  assert.equal(curve(0.5, 'ease'), 0.5, 'smoothstep midpoint');
});

test('typography maps density→weight/opsz and attention→glow, bounded', () => {
  const lo = typography({ density: 0, attention: 0 });
  const hi = typography({ density: 1, attention: 1 });
  assert.equal(lo.weight, 300);
  assert.equal(hi.weight, 800);
  assert.ok(hi.opsz > lo.opsz);
  assert.equal(lo.glow, 0);
  assert.ok(hi.glow > 0);
  const css = typographyCss(hi);
  assert.match(css['font-variation-settings']!, /"wght" 800/);
  assert.match(css['text-shadow']!, /px/);
  assert.equal(typographyCss(lo)['text-shadow'], 'none');
});

test('fieldColor stays within the accessibility caps', () => {
  const base: Hsl = { h: 210, s: 0.5, l: 0.5, a: 1 };
  const hot = fieldColor(base, { heat: 1, attention: 1, density: 1, entropy: 0 });
  assert.ok(hot.s <= DEFAULT_COLOR_CAPS.maxSat, 'saturation capped');
  assert.ok(hot.l >= DEFAULT_COLOR_CAPS.minL && hot.l <= DEFAULT_COLOR_CAPS.maxL, 'lightness clamped');
  assert.ok(hot.h >= 0 && hot.h < 360);
  assert.match(hslString(hot), /^hsl\(/);
});

test('emission is capped and flattened under reduced motion', () => {
  const full = emission({ heat: 1 }, { maxGlow: 24, reducedMotion: false });
  const reduced = emission({ heat: 1 }, { maxGlow: 24, reducedMotion: true });
  assert.ok(full.radius <= 24);
  assert.ok(reduced.alpha < full.alpha, 'reduced motion dims the glow');
});

test('lint flags inactive magnetism, missing field source, unbudgeted source, a11y gaps', () => {
  const findings = runVisualLint({
    forces: ['magnetism', 'fieldflow'],
    hasChargedParticles: false,
    hasFieldSource: false,
    fieldLinesEnabled: true,
    sources: [{ token: 'spawn', budgeted: false }],
    reducedMotionFallback: false,
    colorOnlyMeaning: true,
    saturation: 1.0,
    saturationCap: 0.9,
  });
  const rules = findings.map((f) => f.rule);
  assert.ok(rules.includes('inactive-force'), 'magnetism without charge');
  assert.ok(rules.includes('no-field-source'), 'fieldflow without a field');
  assert.ok(rules.includes('field-lines-no-source'));
  assert.ok(rules.includes('unbudgeted-source'));
  assert.ok(rules.includes('missing-reduced-motion'));
  assert.ok(rules.includes('color-only-meaning'));
  assert.ok(rules.includes('saturation-over-cap'));
  // a clean scene yields nothing
  assert.deepEqual(runVisualLint({ forces: ['attract'], reducedMotionFallback: true }), []);
});

test('semantic-text fallback: detects accessible text and builds the pattern', () => {
  const node = (over: Partial<TextNodeLike> & { sr?: boolean } = {}): TextNodeLike => ({
    textContent: over.textContent ?? null,
    getAttribute: (n) => (n === 'aria-label' ? (over as { label?: string }).label ?? null : null),
    querySelector: (s) => (s === '.sr-only' && over.sr ? {} : null),
  });
  assert.equal(hasAccessibleText(node({ textContent: 'Hello' })), true);
  assert.equal(hasAccessibleText({ ...node(), getAttribute: () => 'Labelled', querySelector: () => null }), true);
  assert.equal(hasAccessibleText(node({ sr: true })), true);
  assert.equal(hasAccessibleText(node()), false, 'glyph-only fails');
  const markup = semanticGlyphMarkup('Field & Co', '<path/>');
  assert.match(markup, /class="sr-only">Field &amp; Co</);
  assert.match(markup, /aria-hidden="true"/);
});

test('the Visual Language Contract and authoring attributes are published', () => {
  assert.ok(VISUAL_CONTRACTS.some((c) => c.name === 'Visual Language Contract'));
  assert.ok(VISUAL_AUTHORING_ATTRIBUTES.includes('data-field-material'));
});

test('design tokens, field roles, and the output-var catalog (BA4)', () => {
  assert.equal(FIELD_DESIGN_TOKENS['--field-range-md'], '320px');
  assert.match(fieldTokensCss(), /:root \{[\s\S]*--field-motion-calm: 0\.2;[\s\S]*\}/);
  assert.equal(isFieldRole('sensor'), true);
  assert.equal(isFieldRole('nope'), false);
  assert.ok(FIELD_OUTPUT_VARS.includes('--field-attention-share'));
  assert.ok(FIELD_OUTPUT_VARS.includes('--field-layout-shift'));
});

test('lint flags duplicate pull forces on one body', () => {
  const f = runVisualLint({ bodyTokens: [['gravity', 'attract']], reducedMotionFallback: true });
  assert.ok(f.some((x) => x.rule === 'duplicate-pull'));
  // a single pull force is fine
  assert.deepEqual(runVisualLint({ bodyTokens: [['attract']], reducedMotionFallback: true }), []);
});
