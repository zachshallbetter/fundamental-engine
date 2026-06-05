/**
 * The React adapter (Phase 7) — `<ForcesField>` mounts the reciprocal field on a
 * canvas via the core engine, the same field the custom element and `mountField`
 * wrap. React is a peer dependency (the one framework dep; the core stays zero-dep).
 *
 * ```tsx
 * import { ForcesField } from '@forces-ui/react';
 * <ForcesField accent="#4da3ff" />            // a full-viewport reciprocal field
 * <ForcesField onReady={(f) => f.scan()} />   // grab the handle to drive it
 * ```
 *
 * The field reacts to `[data-body]` elements anywhere on the page (the field-reacts
 * law); call `field.scan()` from `onReady` after you render new bodies.
 */

import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactElement, RefObject } from 'react';
import { createField, type FieldHandle, type FieldOptions } from 'forces-ui';

export interface ForcesFieldProps extends FieldOptions {
  className?: string;
  style?: CSSProperties;
  /** called once the field is created, with its handle (scan/burst/setAccent/…). */
  onReady?: (field: FieldHandle) => void;
}

const FIXED: CSSProperties = {
  position: 'fixed',
  inset: 0,
  width: '100%',
  height: '100%',
  zIndex: 0,
  pointerEvents: 'none',
  display: 'block',
};

export function ForcesField({
  className,
  style,
  onReady,
  accent,
  density,
  waves,
  render,
  mass,
}: ForcesFieldProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const field = createField(canvas, { accent, density, waves, render, mass });
    onReadyRef.current?.(field);
    return () => field.destroy();
    // re-create only when an engine option actually changes
  }, [accent, density, waves, render, mass]);

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
  const { accent, density, waves, render, mass } = opts;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const field = createField(canvas, { accent, density, waves, render, mass });
    fieldRef.current = field;
    return () => {
      field.destroy();
      fieldRef.current = null;
    };
  }, [accent, density, waves, render, mass]);
  return { canvasRef, fieldRef };
}
