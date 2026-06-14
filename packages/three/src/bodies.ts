/**
 * Meshes as bodies — the 3D form of Fundamental's core idea ("every element is a body"). A
 * `THREE.Object3D` registers as a field body: it bends the field (bodies are force sources), the
 * swarm responds to it, and the field's local density bends *it* back through feedback. And because
 * a body **carries a data record**, a mesh can be a meaningful agent — a bloom carrying its genome,
 * a hive accumulating honey — not just a force.
 *
 * It needs no core change: the engine builds a body from anything implementing the small element
 * contract (`getAttribute` / `hasAttribute` / `dataset` / `getBoundingClientRect`), so each body is a
 * lightweight non-DOM "virtual element" whose rect is the mesh's position projected onto the field
 * plane, refreshed live as the mesh moves. Feedback is routed to the body via a custom sink, so
 * `density` / `load` / `lit` land on the mesh (drive a uniform, accumulate a value) instead of CSS.
 */

import { Vector3 } from 'three';
import type { Object3D } from 'three';
import type { FeedbackChannels, FeedbackSink } from '@fundamental-engine/core';
import type { FieldProjection } from './project.ts';

const _w = new Vector3();

export interface FieldBodySpec {
  /** force token(s) the body radiates — e.g. `'attract'`, `'gravity'`, `['charge', 'swirl']`. */
  tokens: string | readonly string[];
  /** force magnitude (`data-strength`). */
  strength?: number;
  /** influence radius in field pixels (`data-range`). */
  range?: number;
  /** swirl / charge sign (`data-spin`). */
  spin?: number;
  /** heading in radians for directional forces (`data-angle`). */
  angle?: number;
  /** the body's tint (`data-color`) — the `pigment` force dyes passing matter with it, so the
   *  swarm visibly carries this body's color to wherever it drifts next (conserved color transport). */
  color?: string;
  /** species tag this body stamps on matter it emits (a `spawn` source) — for multi-ecology fields. */
  species?: number;
  /** restrict this body's forces to these species (a selective body); omit to act on all matter. */
  affects?: readonly number[];
  /** opt into density/load feedback back onto the mesh (default `true`). */
  feedback?: boolean;
  /** the body's box half-size in field pixels — its footprint, not its range (default 20). */
  sizePx?: number;
  /** the carried record: a genome, an inventory, anything. Opaque to the engine; yours to read. */
  data?: unknown;
  /** raw `data-*` passthrough (without the `data-` prefix) for tokens this spec doesn't model. */
  attrs?: Record<string, string>;
  /** called each frame the body has feedback, with its live channels — drive a uniform from here. */
  onFeedback?: (channels: FeedbackChannels, body: FieldBody) => void;
}

export interface FieldBody {
  /** the registered scene object. */
  readonly object: Object3D;
  /** the carried record — read it when a pollinator reaches this bloom, mutate it freely. */
  data: unknown;
  /** the body's most recent feedback (density/load/lit/…); `{}` until the field writes. */
  readonly channels: Readonly<FeedbackChannels>;
  /** update force params live — applied within a frame on the measure cadence, no re-scan
   *  (a fox getting hungrier, a lure fading). `angle` in degrees, for directional forces. */
  set(params: { strength?: number; range?: number; angle?: number; spin?: number }): void;
  /** unregister this body from the field. */
  remove(): void;
}

/** The non-DOM element the engine reads. Carries a back-reference to its FieldBody. */
interface VirtualBodyElement {
  dataset: Record<string, string>;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  getBoundingClientRect(): {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
    x: number;
    y: number;
    toJSON(): unknown;
  };
  __body?: BodyImpl;
}

class BodyImpl implements FieldBody {
  readonly object: Object3D;
  data: unknown;
  channels: FeedbackChannels = {};
  readonly el: VirtualBodyElement;
  /** the live attr map the virtual element reads — mutating it makes params reactive (see set). */
  private readonly attrs: Record<string, string>;
  private readonly onFeedback?: (channels: FeedbackChannels, body: FieldBody) => void;
  private readonly registry: FieldBodyRegistry;

  constructor(registry: FieldBodyRegistry, object: Object3D, spec: FieldBodySpec) {
    this.registry = registry;
    this.object = object;
    this.data = spec.data;
    this.onFeedback = spec.onFeedback;

    const tokens = Array.isArray(spec.tokens) ? spec.tokens.join(' ') : String(spec.tokens);
    const attrs: Record<string, string> = { 'data-body': tokens, ...prefixed(spec.attrs) };
    if (spec.strength != null) attrs['data-strength'] = String(spec.strength);
    if (spec.range != null) attrs['data-range'] = String(spec.range);
    if (spec.spin != null) attrs['data-spin'] = String(spec.spin);
    if (spec.angle != null) attrs['data-angle'] = String(spec.angle);
    if (spec.species != null) attrs['data-species'] = String(spec.species);
    if (spec.affects != null && spec.affects.length) attrs['data-affects'] = spec.affects.join(',');
    if (spec.feedback ?? true) attrs['data-feedback'] = '';
    this.attrs = attrs; // the virtual element's getAttribute closes over this same object

    const half = (spec.sizePx ?? 20) / 2;
    const self = this;
    this.el = {
      // the scanner reads tint from `el.dataset.color` (not getAttribute), so it lives here
      dataset: spec.color != null ? { color: spec.color } : {},
      getAttribute: (n) => attrs[n] ?? null,
      hasAttribute: (n) => n in attrs,
      getBoundingClientRect: () => {
        const f = registry.projectToField(self.object);
        return {
          left: f.x - half,
          top: f.y - half,
          right: f.x + half,
          bottom: f.y + half,
          width: half * 2,
          height: half * 2,
          x: f.x - half,
          y: f.y - half,
          toJSON: () => ({}),
        };
      },
      __body: this,
    };
  }

  /** routed from the registry's sink — store the channels and notify. */
  receive(channels: FeedbackChannels): void {
    this.channels = channels;
    this.onFeedback?.(channels, this);
  }

  set(params: { strength?: number; range?: number; angle?: number; spin?: number }): void {
    if (params.strength != null) this.attrs['data-strength'] = String(params.strength);
    if (params.range != null) this.attrs['data-range'] = String(params.range);
    if (params.angle != null) this.attrs['data-angle'] = String(params.angle);
    if (params.spin != null) this.attrs['data-spin'] = String(params.spin);
    // no re-scan: the engine re-reads these on the next measure cycle (reactive params)
  }

  remove(): void {
    this.registry.remove(this);
  }
}

function prefixed(attrs?: Record<string, string>): Record<string, string> {
  if (!attrs) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) out[k.startsWith('data-') ? k : `data-${k}`] = v;
  return out;
}

/**
 * Manages the mesh-bodies for one field. Provides the `root` the host scans and the `sink` that
 * routes feedback to meshes; a `FieldLayer` wires both. Add via `layer.addBody(...)`.
 */
export class FieldBodyRegistry {
  private bodies: BodyImpl[] = [];
  private projection: FieldProjection;
  private onChange: () => void = () => {};

  constructor(projection: FieldProjection) {
    this.projection = projection;
  }

  /** project a scene object's world position onto the field plane (field pixels). */
  projectToField(object: Object3D): { x: number; y: number } {
    object.getWorldPosition(_w);
    return this.projection.toField(_w);
  }

  /** internal — the FieldLayer re-points this if the projection changes. */
  setProjection(projection: FieldProjection): void {
    this.projection = projection;
  }

  /** internal — the FieldLayer wires this to `field.scan()` so adds/removes re-register. */
  setOnChange(fn: () => void): void {
    this.onChange = fn;
  }

  /** the scan root the host hands the engine: `[data-body]` queries return the live mesh-bodies. */
  get root(): ParentNode {
    const self = this;
    return {
      querySelectorAll: (sel: string) => (sel.startsWith('[data-body]') ? self.bodies.map((b) => b.el) : []),
      querySelector: () => null,
    } as unknown as ParentNode;
  }

  /** the feedback sink the field writes through — lands density/load/lit on the body's mesh. */
  get sink(): FeedbackSink {
    return ((el: unknown, channels: FeedbackChannels) => {
      (el as VirtualBodyElement).__body?.receive(channels);
    }) as FeedbackSink;
  }

  add(object: Object3D, spec: FieldBodySpec): FieldBody {
    const body = new BodyImpl(this, object, spec);
    this.bodies.push(body);
    this.onChange();
    return body;
  }

  remove(body: FieldBody): void {
    const i = this.bodies.indexOf(body as BodyImpl);
    if (i >= 0) {
      this.bodies.splice(i, 1);
      this.onChange();
    }
  }

  /** every registered body (read-only). */
  all(): readonly FieldBody[] {
    return this.bodies;
  }

  /** Drop every body and break the body↔element reference cycle (`el.__body`). Without this a
   *  retained `FieldBody` handle keeps the whole registry — and every body's `Object3D` — alive
   *  after the layer is destroyed. Also silences `onChange` so a late `remove()` can't re-scan a
   *  torn-down field. Called from `FieldLayer.destroy()`. */
  clear(): void {
    for (const b of this.bodies) (b.el as { __body?: BodyImpl }).__body = undefined;
    this.bodies.length = 0;
    this.onChange = () => {};
  }
}
