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
import { createField, FIELD_CANVAS_STYLE, type FieldHandle, type FieldOptions } from 'field-ui';

export interface ForcesFieldProps extends FieldOptions {
  className?: string;
  style?: CSSProperties;
  /** called once the field is created, with its handle (scan/burst/setAccent/…). */
  onReady?: (field: FieldHandle) => void;
}

// the fixed, click-through surface — shared with the vanilla mount via core/surface.ts.
const FIXED = FIELD_CANVAS_STYLE as CSSProperties;

export function ForcesField({
  className,
  style,
  onReady,
  accent,
  density,
  waves,
  render,
  mass,
  palette,
  attention,
  causality,
}: ForcesFieldProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const field = createField(canvas, { accent, density, waves, render, mass, palette, attention, causality });
    onReadyRef.current?.(field);
    return () => field.destroy();
    // re-create only when an engine option actually changes
  }, [accent, density, waves, render, mass, palette, attention, causality]);

  return (
    <canvas ref={canvasRef} aria-hidden="true" className={className} style={{ ...FIXED, ...style }} />
  );
}

/**
 * Hook form — returns a ref to attach to your own `<canvas>` and the live handle.
 * Use when you need to own the canvas element (sizing, placement) yourself.
 */
export function useForcesField(opts: FieldOptions = {}): {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  fieldRef: RefObject<FieldHandle | null>;
} {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<FieldHandle | null>(null);
  const { accent, density, waves, render, mass, palette, attention, causality } = opts;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const field = createField(canvas, { accent, density, waves, render, mass, palette, attention, causality });
    fieldRef.current = field;
    return () => {
      field.destroy();
      fieldRef.current = null;
    };
  }, [accent, density, waves, render, mass, palette, attention, causality]);
  return { canvasRef, fieldRef };
}

// ── field-ui-migration aliases ─────────────────────────────────────────────────
// `Field*` are the field-first names; the `Forces*` exports above keep working unchanged
// until the migration removal version (docs/field-ui-migration-plan.md §3).
/** Alias of {@link ForcesFieldProps}. */
export type FieldFieldProps = ForcesFieldProps;
/** Alias of {@link ForcesField}. */
export const FieldField = ForcesField;
/** Alias of {@link useForcesField}. */
export const useFieldField = useForcesField;
