/**
 * The React adapter (Phase 7) — `<ForcesField>` mounts the reciprocal field on a
 * canvas via the core engine, the same field the custom element and `mountField`
 * wrap. React is a peer dependency (the one framework dep; the core stays zero-dep).
 *
 * ```tsx
 * import { ForcesField } from '@field-ui/react';
 * <ForcesField accent="#4da3ff" />            // a full-viewport reciprocal field
 * <ForcesField onReady={(f) => f.scan()} />   // grab the handle to drive it
 * ```
 *
 * The field reacts to `[data-body]` elements anywhere on the page (the field-reacts
 * law); call `field.scan()` from `onReady` after you render new bodies.
 */

import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactElement, RefObject } from 'react';
import { FIELD_CANVAS_STYLE, type FieldHandle, type FieldOptions } from '@field-ui/core';
import { createBrowserField } from '@field-ui/platform';

export interface FieldFieldProps extends FieldOptions {
  className?: string;
  style?: CSSProperties;
  /** called once the field is created, with its handle (scan/burst/setAccent/…). */
  onReady?: (field: FieldHandle) => void;
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
  mass,
  palette,
  attention,
  causality,
}: FieldFieldProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const field = createBrowserField(canvas, { accent, density, waves, background, render, mass, palette, attention, causality });
    onReadyRef.current?.(field);
    return () => field.destroy();
    // re-create only when an engine option actually changes
  }, [accent, density, waves, background, render, mass, palette, attention, causality]);

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
  const { accent, density, waves, background, render, mass, palette, attention, causality } = opts;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const field = createBrowserField(canvas, { accent, density, waves, background, render, mass, palette, attention, causality });
    fieldRef.current = field;
    return () => {
      field.destroy();
      fieldRef.current = null;
    };
  }, [accent, density, waves, background, render, mass, palette, attention, causality]);
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
