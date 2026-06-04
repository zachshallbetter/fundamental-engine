/**
 * The DOM scanner — turns `[data-body]` elements into bodies the engine reads
 * (§2.1, §3.1). The *parsing* is a pure function (testable without a DOM); the
 * *measurement* (`getBoundingClientRect`) is thin glue.
 */

import type { Body } from './types.ts';
import { PRESETS, type PresetEntry } from '../config/presets.ts';

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

/** A `BodyAttrs` view over one preset entry, so it parses through the very same
 *  defaults as a real `data-*` element (single source of truth in `parseBodyParams`).
 *  The entry's keys map to the attribute suffixes the parser already reads. */
function entryAttrs(e: PresetEntry): BodyAttrs {
  const map: Record<string, string> = { body: e.body };
  if (e.strength != null) map.strength = String(e.strength);
  if (e.range != null) map.range = String(e.range);
  if (e.spin != null) map.spin = String(e.spin);
  if (e.angle != null) map.angle = String(e.angle);
  if (e.absorb != null) map.absorb = String(e.absorb);
  if (e.max != null) map.max = String(e.max);
  return {
    get: (name) => map[name] ?? null,
    has: (name) => name in map,
  };
}

/** Expand a preset name into the static params of its virtual bodies (pure, §20.9).
 *  An unknown preset yields `[]` — the element simply contributes nothing. */
export function expandPreset(name: string): StaticBody[] {
  const entries = PRESETS[name];
  return entries ? entries.map((e) => parseBodyParams(entryAttrs(e))) : [];
}

/** A fresh Body from static params, all runtime fields zeroed — shared by both paths. */
function makeBody(el: HTMLElement, sb: StaticBody): Body {
  return {
    el,
    ...sb,
    tint: el.dataset.color, // data-color → pigment tint (§20.8); undefined if absent
    cx: 0,
    cy: 0,
    hw: 0,
    hh: 0,
    on: false,
    vis: true,
    accreted: 0,
    count: 0,
    d: 0,
    attn: 1,
  };
}

/** Scan a DOM subtree for `[data-body]` and `[data-preset]` elements → bodies (§2.1,
 *  §20.9). A preset element emits one virtual body per entry, all sharing its rect;
 *  the plain `data-body` path is unchanged. */
export function scanBodies(root: ParentNode): Body[] {
  const bodies: Body[] = [];
  root.querySelectorAll('[data-body]').forEach((node) => {
    const el = node as HTMLElement;
    const attrs: BodyAttrs = {
      get: (name) => el.getAttribute('data-' + name),
      has: (name) => el.hasAttribute('data-' + name),
    };
    bodies.push(makeBody(el, parseBodyParams(attrs)));
  });
  root.querySelectorAll('[data-preset]').forEach((node) => {
    const el = node as HTMLElement;
    for (const sb of expandPreset(el.dataset.preset ?? '')) bodies.push(makeBody(el, sb));
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
