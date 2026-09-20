/**
 * The Lab's snippet export (#1184) — turn a Lab configuration into code you can paste into a page.
 *
 * The Lab's other three exports DESCRIBE an experiment: `exportJSON` writes a measurement record,
 * `copyReport` writes the checks as text, the share button writes a link back to the same state.
 * None of them emits the code that reproduces the configuration, so everything learned in the Lab
 * had to be hand-transcribed — and `data-body` / tokens / strength / range / spin is exactly the
 * kind of surface that is easy to get subtly wrong by hand.
 *
 * Lives here rather than inline in `lab.astro` so it can be tested: the page is a script tag, and a
 * snippet emitter whose output nobody asserts is a snippet emitter that quietly drifts from the
 * attributes the scanner actually reads.
 */

/** The scanner's own defaults (`packages/core/src/engine/scanner.ts`). */
export const SCANNER_DEFAULTS = {
  strength: 0.5,
  range: 280,
  spin: 1,
  angle: 0,
  absorb: 64,
} as const;

/** A Lab scenario body, resolved — the shape `buildScenario()` produces. */
export interface SnippetBody {
  tokens?: string[] | string;
  strength?: number | null;
  range?: number | null;
  spin?: number | null;
  /** RADIANS, as the scenario carries it. The emitter converts to degrees for markup. */
  angle?: number | null;
  absorbR?: number | null;
  /** half-extents; the element box is twice these */
  hw?: number | null;
  hh?: number | null;
}

export interface SnippetInput {
  body: SnippetBody;
  /** fallback token when the body carries none */
  force: string;
  /** human label for the header comment */
  label: string;
  symbol?: string;
  /** a link that reopens this exact configuration */
  link?: string;
}

const trim = (n: number): string => String(Math.round(n * 1000) / 1000);
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

function tokensOf(body: SnippetBody, force: string): string[] {
  if (Array.isArray(body.tokens) && body.tokens.length) return body.tokens.slice();
  if (typeof body.tokens === 'string' && body.tokens.trim()) return body.tokens.trim().split(/\s+/);
  return [force];
}

/** Degrees, from the radians a scenario body carries. */
export function angleDegrees(body: SnippetBody): number | null {
  return body.angle == null ? null : (body.angle * 180) / Math.PI;
}

/**
 * The `data-*` attributes that reproduce this body.
 *
 * An attribute is emitted only when its value DIFFERS from the scanner's default, so every line in
 * the snippet is load-bearing. A body sitting on a default emits nothing for it — which is the
 * honest result: the default is what reproduces it.
 */
export function bodyAttributes(input: SnippetInput): [string, string][] {
  const b = input.body;
  const attrs: [string, string][] = [['data-body', tokensOf(b, input.force).join(' ')]];
  const put = (name: string, v: number | null | undefined, def: number): void => {
    if (v == null || near(v, def)) return;
    attrs.push([name, trim(v)]);
  };
  put('data-strength', b.strength, SCANNER_DEFAULTS.strength);
  put('data-range', b.range, SCANNER_DEFAULTS.range);
  put('data-spin', b.spin, SCANNER_DEFAULTS.spin);
  put('data-angle', angleDegrees(b), SCANNER_DEFAULTS.angle);
  put('data-absorb', b.absorbR, SCANNER_DEFAULTS.absorb);
  return attrs;
}

/** The declarative form — the body is an element on the page. */
export function markupSnippet(input: SnippetInput): string {
  const b = input.body;
  const attrs = bodyAttributes(input);
  // hw/hh are half-extents. In the DOM a body's box comes from CSS, not an attribute, so the size
  // is emitted as a style rather than silently dropped — the geometry is part of what reproduces it.
  const w = b.hw != null ? Math.round(b.hw * 2) : null;
  const h = b.hh != null ? Math.round(b.hh * 2) : null;
  const style = w != null && h != null && w > 0 && h > 0 ? ` style="width:${w}px;height:${h}px"` : '';
  const attrStr = attrs.map(([k, v]) => `${k}="${v}"`).join('\n     ');
  return `<!-- ${input.label} — exported from the Fundamental Lab -->\n<div ${attrStr}${style}></div>`;
}

/** The imperative form — the body is created in code. */
export function createFieldSnippet(input: SnippetInput): string {
  const b = input.body;
  const deg = angleDegrees(b);
  const opts: string[] = [`  tokens: [${tokensOf(b, input.force).map((t) => `'${t}'`).join(', ')}],`];
  if (b.strength != null) opts.push(`  strength: ${trim(b.strength)},`);
  if (b.range != null) opts.push(`  range: ${trim(b.range)},`);
  if (b.spin != null && !near(b.spin, SCANNER_DEFAULTS.spin)) opts.push(`  spin: ${trim(b.spin)},`);
  if (deg != null && !near(deg, 0)) opts.push(`  angle: ${trim(deg)},`);
  if (b.absorbR != null) opts.push(`  absorbR: ${trim(b.absorbR)},`);
  opts.push('  rect: () => el.getBoundingClientRect(),');
  return [
    `import { createField } from '@fundamental-engine/vanilla';`,
    ``,
    `const el = document.getElementById('body');`,
    `const field = createField(document.getElementById('field'));`,
    `field.addBody({`,
    ...opts,
    `});`,
  ].join('\n');
}

/** Both forms, with a header and a link back to the Lab state that produced them. */
export function labSnippet(input: SnippetInput): string {
  const head = input.symbol ? `${input.label} (${input.symbol})` : input.label;
  const out = [
    `/* Fundamental Lab → ${head} */`,
    ``,
    `/* Declarative — the body is an element on the page */`,
    markupSnippet(input),
    ``,
    `/* Imperative — the body is created in code */`,
    createFieldSnippet(input),
  ];
  if (input.link) out.push(``, `/* Reopen this exact configuration: ${input.link} */`);
  return out.join('\n');
}
