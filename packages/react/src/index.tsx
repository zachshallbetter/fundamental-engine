/**
 * The React adapter (Phase 7) — `<FieldField>` mounts the reciprocal field on a
 * canvas via the core engine, the same field the custom element and `mountField`
 * wrap. React is a peer dependency (the one framework dep; the core stays zero-dep).
 *
 * ```tsx
 * import { FieldField } from '@fundamental-engine/react';
 * <FieldField accent="#4da3ff" />            // a full-viewport reciprocal field
 * <FieldField onReady={(f) => f.scan()} />   // grab the handle to drive it
 * ```
 *
 * The field reacts to `[data-body]` elements anywhere on the page (the field-reacts
 * law); call `field.scan()` from `onReady` after you render new bodies.
 */

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, RefObject } from 'react';
import { FIELD_CANVAS_STYLE, type FieldHandle, type FieldOptions, type OverlayInput } from '@fundamental-engine/core';
import {
  createBrowserField,
  bindData,
  type BindDataOptions,
  type DataBinding,
  type DataBindingInspection,
  type RecordMapper,
} from '@fundamental-engine/dom';

export interface FieldFieldProps extends FieldOptions {
  className?: string;
  style?: CSSProperties;
  /** called once the field is created, with its handle (scan/burst/setAccent/…). */
  onReady?: (field: FieldHandle) => void;
  // `overlay?: OverlayInput` is inherited from FieldOptions. The component creates and manages the
  // front overlay canvas automatically — callers only set the mode, not the canvas element.
}

// the fixed, click-through surface — shared with the vanilla mount via core/surface.ts.
const FIXED = FIELD_CANVAS_STYLE as CSSProperties;

export function FieldField({
  className,
  style,
  onReady,
  accent,
  density,
  depth,
  integrator,
  waves,
  waveStyle,
  waveCenter,
  background,
  render,
  overlay,
  overlayBackend,
  mass,
  palette,
  attention,
  causality,
  heatmap,
  dprCap,
  separation,
  rng,
  now,
  feedbackSink,
}: FieldFieldProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  /** Field Surfaces: the front overlay surface this component owns, lazily created. */
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Field Surfaces: lazily create the overlay canvas the first time an overlay is set.
    // Matches the element's pattern: fixed, full-viewport, click-through, above content.
    if (overlay !== undefined && overlay !== 'off' && !overlayCanvasRef.current && typeof document !== 'undefined') {
      const oc = document.createElement('canvas');
      oc.setAttribute('aria-hidden', 'true');
      oc.style.cssText =
        'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;mix-blend-mode:screen';
      document.body.appendChild(oc);
      overlayCanvasRef.current = oc;
    }

    const field = createBrowserField(canvas, {
      accent, density, depth, integrator, waves, waveStyle, waveCenter, background, render,
      overlay, overlayCanvas: overlayCanvasRef.current ?? undefined, overlayBackend,
      mass, palette, attention, causality, heatmap, dprCap, separation,
      rng, now, feedbackSink,
    });
    onReadyRef.current?.(field);
    return () => {
      field.destroy();
      // Field Surfaces: remove the overlay canvas this component owns on teardown.
      overlayCanvasRef.current?.remove();
      overlayCanvasRef.current = null;
    };
    // re-create only when a declarative engine option actually changes. The determinism/feedback
    // seams (rng/now/feedbackSink/overlayBackend) are config-set-once — forwarded above, but kept
    // out of the dep list so an inline value passed each render doesn't thrash the field.
  }, [accent, density, depth, integrator, waves, waveStyle, waveCenter, background, render, overlay, mass, palette, attention, causality, heatmap, dprCap, separation]);

  return (
    <canvas ref={canvasRef} aria-hidden="true" className={className} style={{ ...FIXED, ...style }} />
  );
}

/**
 * Hook form — returns a ref to attach to your own `<canvas>` and the live handle.
 * Use when you need to own the canvas element (sizing, placement) yourself.
 */
export function useFieldField(opts: FieldOptions = {}): {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  fieldRef: RefObject<FieldHandle | null>;
} {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<FieldHandle | null>(null);
  /** Field Surfaces: the front overlay surface this hook owns, lazily created. */
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const {
    accent, density, depth, integrator, waves, waveStyle, waveCenter, background, render, overlay, overlayBackend,
    mass, palette, attention, causality, heatmap, dprCap, separation, rng, now, feedbackSink,
  } = opts;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Field Surfaces: lazily create the overlay canvas when an overlay reading is requested.
    if (overlay !== undefined && overlay !== 'off' && !overlayCanvasRef.current && typeof document !== 'undefined') {
      const oc = document.createElement('canvas');
      oc.setAttribute('aria-hidden', 'true');
      oc.style.cssText =
        'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;mix-blend-mode:screen';
      document.body.appendChild(oc);
      overlayCanvasRef.current = oc;
    }

    const field = createBrowserField(canvas, {
      accent, density, depth, integrator, waves, waveStyle, waveCenter, background, render,
      overlay, overlayCanvas: overlayCanvasRef.current ?? undefined, overlayBackend,
      mass, palette, attention, causality, heatmap, dprCap, separation,
      rng, now, feedbackSink,
    });
    fieldRef.current = field;
    return () => {
      field.destroy();
      fieldRef.current = null;
      // Field Surfaces: remove the overlay canvas this hook owns on teardown.
      overlayCanvasRef.current?.remove();
      overlayCanvasRef.current = null;
    };
    // declarative options drive recreation; the seams (rng/now/feedbackSink/overlayBackend) forward but stay out of deps.
  }, [accent, density, depth, integrator, waves, waveStyle, waveCenter, background, render, overlay, mass, palette, attention, causality, heatmap, dprCap, separation]);
  return { canvasRef, fieldRef };
}

/**
 * The React wrapper for `bindData()` — drive a live field from React state. Records map to bodies
 * (via `mapper`), a recipe frames the field, and `bindData` does the record → body diffing
 * (added/removed records enter/decay rather than popping). Attach `containerRef` to your own host
 * element; whenever `records` changes, the hook calls `binding.update(records)` so the field stays
 * in step with React state — no manual mount/update wiring.
 *
 * ```tsx
 * const { containerRef, inspect } = useForcesData(results, toBody, { recipe: 'search-relevance-field' });
 * return <div ref={containerRef} />;   // inspect() → { records, bodies, relationships } | null
 * ```
 *
 * The hook owns the binding's lifecycle: created on the first render the container ref is set,
 * updated on each `records` change, and destroyed on unmount. `inspect()` reads the binding's live
 * metrics on demand (records/bodies/relationships counts), and `bindingRef` is the escape hatch to
 * the full `DataBinding` (`ids()`, `applied()`, …) for advanced consumers. Mirrors `useFieldField`.
 */
export function useForcesData<T>(
  records: T[],
  mapper: RecordMapper<T>,
  options: BindDataOptions<T> = {},
): {
  containerRef: RefObject<HTMLDivElement | null>;
  bindingRef: RefObject<DataBinding<T> | null>;
  inspect: () => DataBindingInspection | null;
} {
  const bindingRef = useRef<DataBinding<T> | null>(null);
  // The host node is tracked in STATE, not just a ref, so the mount effect RE-RUNS the moment the
  // node attaches. A plain `useRef` read once in a `[]`-dep effect stays null forever if the
  // container mounts after the first effect pass (the #989 bug) — the effect never re-runs.
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  // A STABLE RefObject-shaped view (built once) keeps the returned contract unchanged and avoids
  // detach/reattach churn: React assigns `.current` on attach (node) / detach (null) in the commit
  // phase; the setter records the node and — on a real change — flips state to wake the effect.
  const refView = useRef<RefObject<HTMLDivElement | null>>(undefined as unknown as RefObject<HTMLDivElement | null>);
  if (!refView.current) {
    let node: HTMLDivElement | null = null;
    refView.current = {
      get current() {
        return node;
      },
      set current(next: HTMLDivElement | null) {
        if (next === node) return;
        node = next;
        setContainerEl(next);
      },
    };
  }
  const containerRef = refView.current;
  // latest mapper/options/records held in refs so the binding can read them without re-creating
  // the binding (and re-mounting every body) when an inline closure changes identity each render.
  const mapperRef = useRef(mapper);
  mapperRef.current = mapper;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const recordsRef = useRef(records);
  recordsRef.current = records;

  // create/destroy the binding when the container element appears/disappears — keyed on the node,
  // so a container that attaches AFTER first render still gets bound (the null-first-pass fix).
  useEffect(() => {
    const container = containerEl;
    if (!container) return;
    const binding = bindData(container, recordsRef.current, (rec, i) => mapperRef.current(rec, i), optionsRef.current);
    bindingRef.current = binding;
    return () => {
      binding.destroy();
      bindingRef.current = null;
    };
    // re-mount when the container node identity changes; data flows through update() in the effect below.
  }, [containerEl]);

  // push every records change into the live binding (diff by id is bindData's job).
  useEffect(() => {
    bindingRef.current?.update(records);
  }, [records]);

  return { containerRef, bindingRef, inspect: () => bindingRef.current?.inspect() ?? null };
}

// Re-export the core types a React consumer needs off the handle (addAgent / atomAt / feedback),
// so they don't have to reach into @fundamental-engine/core separately.
export type {
  FieldHandle,
  FieldOptions,
  Vec2,
  AgentSpec,
  AgentHandle,
  AtomPayload,
  FeedbackSink,
  FeedbackChannels,
} from '@fundamental-engine/core';
// the running engine version constant — re-exported so a consumer can read it as a named import off
// this door. A missing named import aborts the whole ES module, so the door must carry it (#584).
export { FIELD_VERSION } from '@fundamental-engine/core';
// the bindData surface a useForcesData consumer needs to type its mapper/options/inspection,
// so they don't reach into @fundamental-engine/dom separately.
export type {
  RecordMapper,
  MappedRecord,
  MappedBody,
  MappedRelationship,
  BindDataOptions,
  DataBinding,
  DataBindingInspection,
} from '@fundamental-engine/dom';
