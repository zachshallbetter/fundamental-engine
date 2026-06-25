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

import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactElement, RefObject } from 'react';
import { FIELD_CANVAS_STYLE, type FieldHandle, type FieldOptions, type OverlayInput } from '@fundamental-engine/core';
import { createBrowserField } from '@fundamental-engine/dom';

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
      accent, density, depth, waves, waveStyle, waveCenter, background, render,
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
  }, [accent, density, depth, waves, waveStyle, waveCenter, background, render, overlay, mass, palette, attention, causality, heatmap, dprCap, separation]);

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
    accent, density, depth, waves, waveStyle, waveCenter, background, render, overlay, overlayBackend,
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
      accent, density, depth, waves, waveStyle, waveCenter, background, render,
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
  }, [accent, density, depth, waves, waveStyle, waveCenter, background, render, overlay, mass, palette, attention, causality, heatmap, dprCap, separation]);
  return { canvasRef, fieldRef };
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
