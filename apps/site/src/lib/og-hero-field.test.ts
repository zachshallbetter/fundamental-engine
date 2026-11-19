/**
 * The homepage social card's field (/og/home.png) is a real, reproducible engine frame.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renderOgHeroField, OG_W, OG_H } from './og-hero-field.ts';

test('og hero field: a seeded run draws a populated frame at the card size', () => {
  const { svg, particles } = renderOgHeroField();
  assert.ok(particles > 100, `the field has matter to draw (got ${particles})`);
  assert.ok(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}"`));
  assert.ok((svg.match(/<circle /g) ?? []).length > 100, 'particles are drawn');
});

test('og hero field: the same seed draws the same frame (every build ships the same card)', () => {
  assert.equal(renderOgHeroField().svg, renderOgHeroField().svg);
});
