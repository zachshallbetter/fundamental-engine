/**
 * The DOM scanner — turns `[data-body]` elements into bodies the engine reads
 * (§2.1, §3.1). The *parsing* is a pure function (testable without a DOM); the
 * *measurement* (`getBoundingClientRect`) is thin glue.
 */

import type { Body } from './types.ts';

/** A minimal attribute accessor — `name` is the suffix after `data-`. */
export interface BodyAttrs {
  get(name: string): string | null | undefined;
  has(name: string): boolean;
}

/** The static (non-runtime) fields of a Body, parsed from attributes. */
export type StaticBody = Pick<
  Body,
  | 'tokens'
  | 'strength'
  | 'range'
  | 'absorbR'
  | 'capacity'
  | 'spin'
  | 'angle'
  | 'ux'
  | 'uy'
  | 'when'
  | 'feedback'
  | 'fmin'
  | 'fmax'
  | 'opsz'
  | 'M'
>;

/** Parse a body's static parameters from its `data-*` attributes (pure). */
export function parseBodyParams(a: BodyAttrs): StaticBody {
  const num = (name: string, def: number): number => {
    const v = Number.parseFloat(a.get(name) ?? '');
    return Number.isFinite(v) ? v : def;
  };
  const strength = num('strength', 0.5);
  const angle = (num('angle', 0) * Math.PI) / 180;
  const spinRaw = a.get('spin');
  const spin =
    spinRaw == null ? 1 : Number.isFinite(Number.parseFloat(spinRaw)) ? Number.parseFloat(spinRaw) : 0;
  return {
    tokens: (a.get('body') ?? '').split(/\s+/).filter(Boolean),
    strength,
    range: num('range', 280),
    absorbR: num('absorb', 64),
    capacity: num('max', 60),
    spin,
    angle,
    ux: Math.cos(angle),
    uy: Math.sin(angle),
    when: a.get('when') ?? '',
    feedback: a.has('feedback'),
    fmin: num('fmin', 0),
    fmax: num('fmax', 0),
    opsz: a.get('opsz') ?? '',
    // source mass M = strength · k_g (k_g = 1 for now, §20.10).
    M: strength,
  };
}

/** Scan a DOM subtree for `[data-body]` elements → bodies (browser only). */
export function scanBodies(root: ParentNode): Body[] {
  const bodies: Body[] = [];
  root.querySelectorAll('[data-body]').forEach((node) => {
    const el = node as HTMLElement;
    const attrs: BodyAttrs = {
      get: (name) => el.getAttribute('data-' + name),
      has: (name) => el.hasAttribute('data-' + name),
    };
    bodies.push({
      el,
      ...parseBodyParams(attrs),
      cx: 0,
      cy: 0,
      hw: 0,
      hh: 0,
      on: false,
      vis: true,
      accreted: 0,
      count: 0,
      d: 0,
    });
  });
  return bodies;
}

/** Refresh each body's measured rect, visibility, and engaged state (§2.1). */
export function measureBodies(bodies: readonly Body[], W: number, H: number): void {
  const margin = H * 0.15;
  for (const b of bodies) {
    const r = b.el.getBoundingClientRect();
    b.cx = r.left + r.width / 2;
    b.cy = r.top + r.height / 2;
    b.hw = r.width / 2;
    b.hh = r.height / 2;
    b.on = b.el.dataset.active === '1';
    b.vis =
      r.bottom > -margin && r.top < H + margin && r.right > -margin && r.left < W + margin;
  }
}
