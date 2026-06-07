/**
 * The DOM scanner — turns `[data-body]` elements into bodies the engine reads
 * (§2.1, §3.1). The *parsing* is a pure function (testable without a DOM); the
 * *measurement* (`getBoundingClientRect`) is thin glue.
 */

import type { Body } from './types.ts';
import { PRESETS, type PresetEntry } from '../config/presets.ts';
import { compileIntent } from '../recipes/intent.ts';

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
  | 'shaped'
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
    shaped: a.has('shaped'), // data-shaped → forces sample the element's box surface (Stage C)
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

/** Read an element's own `data-*` attributes as a `BodyAttrs` view. */
function elementAttrs(el: HTMLElement): BodyAttrs {
  return {
    get: (name) => el.getAttribute('data-' + name),
    has: (name) => el.hasAttribute('data-' + name),
  };
}

/** Build a single body from an element, parsing its `data-*` (or an explicit `attrs` view,
 *  for event-registered shadow-DOM hosts whose attrs may be supplied out of band). */
export function bodyFromElement(el: HTMLElement, attrs?: BodyAttrs): Body {
  return makeBody(el, parseBodyParams(attrs ?? elementAttrs(el)));
}

/**
 * Default force tokens per `data-field-role` (worldclass §12). Force-like roles map to a token;
 * `sensor`/`display` are feedback-only responders (no token, density still sampled). Used only when
 * a role element has no explicit `data-body`/`data-intent`.
 */
const FIELD_ROLE_TOKENS: Readonly<Record<string, string>> = {
  source: 'jet',
  sink: 'sink',
  anchor: 'tether',
  boundary: 'wall',
  sensor: '', // feedback-only
  display: '', // feedback-only
};

/**
 * A `BodyAttrs` for an element authored via `data-intent` or `data-field-role` instead of a raw
 * `data-body`. The intent is compiled (authoring §4) or the role mapped to a default token; explicit
 * `data-*` on the element still wins over the compiled defaults (precedence §3 — component props beat
 * intent defaults). Returns null when the element carries neither an intent nor a known role.
 */
export function authoredAttrs(el: HTMLElement): BodyAttrs | null {
  let compiled: Record<string, string> | null = null;

  const intent = el.getAttribute('data-intent');
  if (intent) {
    const intensityAttr = el.getAttribute('data-intensity');
    const c = compileIntent(intent, {
      intensity: intensityAttr != null ? Number(intensityAttr) : undefined,
      risk: (el.getAttribute('data-risk') as 'low' | 'medium' | 'high' | null) ?? undefined,
    });
    if (c) {
      compiled = { body: c.body };
      if (c.strength != null) compiled.strength = String(c.strength);
      if (c.range != null) compiled.range = String(c.range);
      if (c.feedback) compiled.feedback = '';
    }
  }

  if (!compiled) {
    const role = el.getAttribute('data-field-role');
    if (role != null && role in FIELD_ROLE_TOKENS) compiled = { body: FIELD_ROLE_TOKENS[role]!, feedback: '' };
  }
  if (!compiled) return null;

  const defaults = compiled;
  return {
    get: (name) => el.getAttribute('data-' + name) ?? defaults[name] ?? null,
    has: (name) => el.hasAttribute('data-' + name) || name in defaults,
  };
}

/** Scan a DOM subtree for `[data-body]` and `[data-preset]` elements → bodies (§2.1,
 *  §20.9). A preset element emits one virtual body per entry, all sharing its rect;
 *  the plain `data-body` path is unchanged. */
export function scanBodies(root: ParentNode): Body[] {
  const bodies: Body[] = [];
  root.querySelectorAll('[data-body]').forEach((node) => {
    bodies.push(bodyFromElement(node as HTMLElement));
  });
  root.querySelectorAll('[data-preset]').forEach((node) => {
    const el = node as HTMLElement;
    for (const sb of expandPreset(el.dataset.preset ?? '')) bodies.push(makeBody(el, sb));
  });
  // authored via intent/role rather than a raw data-body (authoring §4, worldclass §12). An
  // explicit data-body always takes the plain path above, so these never double-register.
  root
    .querySelectorAll('[data-intent]:not([data-body]), [data-field-role]:not([data-body]):not([data-intent])')
    .forEach((node) => {
      const a = authoredAttrs(node as HTMLElement);
      if (a) bodies.push(bodyFromElement(node as HTMLElement, a));
    });
  return bodies;
}

/** Refresh each body's measured rect, visibility, and engaged state (§2.1). */
export function measureBodies(bodies: readonly Body[], W: number, H: number): void {
  const margin = H * 0.15;
  for (const b of bodies) {
    // a shadow-DOM body may carry a custom rect provider (closed root, internal core); the
    // host's own box is the default (shadow-dom.md §10/§16).
    const r = b.rect ? b.rect() : b.el.getBoundingClientRect();
    b.cx = r.left + r.width / 2;
    b.cy = r.top + r.height / 2;
    b.hw = r.width / 2;
    b.hh = r.height / 2;
    b.on = b.el.dataset.active === '1';
    b.vis =
      r.bottom > -margin && r.top < H + margin && r.right > -margin && r.left < W + margin;
  }
}
