/**
 * The React adapter (Phase 7) — `<ForcesField>` mounts the reciprocal field on a
 * canvas via the core engine, the same field the custom element and `mountField`
 * wrap. React is a peer dependency (the one framework dep; the core stays zero-dep).
 *
 * ```tsx
 * import { ForcesField } from '@fundamental-engine/react';
 * <ForcesField accent="#4da3ff" />            // a full-viewport reciprocal field
 * <ForcesField onReady={(f) => f.scan()} />   // grab the handle to drive it
 * ```
 *
 * The field reacts to `[data-body]` elements anywhere on the page (the field-reacts
 * law); call `field.scan()` from `onReady` after you render new bodies.
 */

import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactElement, RefObject } from 'react';
import { FIELD_CANVAS_STYLE, type FieldHandle, type FieldOptions, type OverlayInput } from '@fundamental-engine/core';
import { createBrowserField } from '@fundamental-engine/platform';

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
  waves,
  background,
  render,
  overlay,
  mass,
  palette,
  attention,
  causality,
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
      accent, density, waves, background, render,
      overlay, overlayCanvas: overlayCanvasRef.current ?? undefined,
      mass, palette, attention, causality,
    });
    onReadyRef.current?.(field);
    return () => {
      field.destroy();
      // Field Surfaces: remove the overlay canvas this component owns on teardown.
      overlayCanvasRef.current?.remove();
      overlayCanvasRef.current = null;
    };
    // re-create only when an engine option actually changes
  }, [accent, density, waves, background, render, overlay, mass, palette, attention, causality]);

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
  const { accent, density, waves, background, render, overlay, mass, palette, attention, causality } = opts;
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
      accent, density, waves, background, render,
      overlay, overlayCanvas: overlayCanvasRef.current ?? undefined,
      mass, palette, attention, causality,
    });
    fieldRef.current = field;
    return () => {
      field.destroy();
      fieldRef.current = null;
      // Field Surfaces: remove the overlay canvas this hook owns on teardown.
      overlayCanvasRef.current?.remove();
      overlayCanvasRef.current = null;
    };
  }, [accent, density, waves, background, render, overlay, mass, palette, attention, causality]);
  return { canvasRef, fieldRef };
}

// ── deprecated field-ui-migration aliases ──────────────────────────────────────
// `Field*` (above) are canonical; these `Forces*` exports keep working unchanged until the
// migration removal version (docs/planning-archive/field-ui-migration-plan.md §3).
/** @deprecated alias of {@link FieldFieldProps}. */
export type ForcesFieldProps = FieldFieldProps;
/** @deprecated alias of {@link FieldField}. */
export const ForcesField = FieldField;
/** @deprecated alias of {@link useFieldField}. */
export const useForcesField = useFieldField;
