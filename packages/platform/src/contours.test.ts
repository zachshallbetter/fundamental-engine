/**
 * Contour primitive tests (#363) — font-agnostic glyph-outline generation. Exercised with a stub
 * font (the ContourFont structural contract opentype.js satisfies) and fake elements, the same
 * no-real-DOM pattern as the other platform suites: layout math (advance + kerning), path
 * concatenation, the generated SVG's binding contract, and the computed-font-size default.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contourPathData, contourSvgFor, type ContourFont } from './contours.ts';

/** A 1000-upm stub face: every glyph advances 500 units and draws a marker square. */
function stubFont(kern = 0): ContourFont {
  return {
    unitsPerEm: 1000,
    ascender: 800,
    charToGlyph: (ch: string) => ({
      advanceWidth: 500,
      getPath: (x: number, y: number, size: number) => ({
        toPathData: () => `M${x.toFixed(0)} ${y.toFixed(0)}h${(size / 10).toFixed(0)}[${ch}]`,
      }),
    }),
    getKerningValue: () => kern,
  };
}

test('contourPathData: per-glyph advances accumulate; paths concatenate in order', () => {
  const p = contourPathData(stubFont(), 'AB', 100); // scale 0.1 → advance 50/glyph
  assert.equal(p.fontSize, 100);
  assert.match(p.d, /M0 80h10\[A\]/); // first glyph at x=0, baseline at ascent 80
  assert.match(p.d, /M50 80h10\[B\]/); // second at x=50
  assert.ok(p.d.indexOf('[A]') < p.d.indexOf('[B]'));
});

test('contourPathData: kerning shifts the following glyph', () => {
  const p = contourPathData(stubFont(-100), 'AB', 100); // kern -100 units → -10px at scale 0.1
  assert.match(p.d, /M40 80h10\[B\]/);
});

test('contourPathData: the viewBox is the padded em box', () => {
  const p = contourPathData(stubFont(), 'A', 100, { pad: 10 });
  assert.equal(p.viewBox, '-10.0 -10.0 70.0 120.0'); // width = advance 50 + 2·pad, height = size + 2·pad
});

function fakeDoc() {
  const make = (tag: string) => {
    const attrs: Record<string, string> = {};
    const children: unknown[] = [];
    return {
      tagName: tag,
      attrs,
      children,
      setAttribute: (k: string, v: string) => void (attrs[k] = v),
      getAttribute: (k: string) => attrs[k] ?? null,
      appendChild(c: unknown) {
        children.push(c);
        return c;
      },
      remove() {},
    };
  };
  return { createElementNS: (_ns: string, tag: string) => make(tag) } as unknown as Document;
}

test('contourSvgFor: the SVG carries the full binding contract and N rings, innermost last', () => {
  const doc = fakeDoc();
  let inserted: unknown = null;
  const el = {
    id: 'hero-title',
    textContent: '  Contour  ',
    ownerDocument: doc,
    insertAdjacentElement: (_pos: string, node: unknown) => void (inserted = node),
  } as unknown as HTMLElement;

  const h = contourSvgFor(el, stubFont(), { fontSize: 96, rings: 3 });
  const svg = h.svg as unknown as { attrs: Record<string, string>; children: { attrs: Record<string, string> }[] };
  assert.equal(svg.attrs['aria-hidden'], 'true');
  assert.equal(svg.attrs['data-field-visual-for'], 'hero-title');
  assert.equal(svg.attrs['data-field-visual-role'], 'representation');
  assert.equal(svg.children.length, 3);
  assert.equal(svg.children[0]!.attrs.class, 'ring ring-3'); // widest first (painted under)
  assert.equal(svg.children[2]!.attrs.class, 'ring ring-1');
  assert.ok(svg.children[0]!.attrs.d!.includes('[C]'), 'path data from the trimmed textContent');
  assert.equal(inserted, h.svg, 'attached after the element by default');
});

test('contourSvgFor: assigns an id when the element has none; attach:false leaves the DOM alone', () => {
  const doc = fakeDoc();
  let inserted = false;
  const el = {
    id: '',
    textContent: 'Field',
    ownerDocument: doc,
    insertAdjacentElement: () => void (inserted = true),
  } as unknown as HTMLElement;
  const h = contourSvgFor(el, stubFont(), { fontSize: 50, attach: false });
  assert.ok(el.id.startsWith('contour-'), 'id assigned for the binding');
  assert.equal((h.svg as unknown as { attrs: Record<string, string> }).attrs['data-field-visual-for'], el.id);
  assert.equal(inserted, false);
});
