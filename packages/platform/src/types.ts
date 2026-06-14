/**
 * @fundamental-engine/platform — shared contracts for the platform-adjacent registries. These describe the
 * native primitives Fundamental wishes the browser had (frame-stable geometry, typed element state,
 * relationships, visual-semantic pairing) built on the ones it has. Pure data shapes; no DOM here.
 */

/** A measured rectangle in a coordinate space, with the centre precomputed. */
export interface FieldRect {
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type CoordinateSpace = 'viewport' | 'document' | 'field-root' | 'canvas';

/** One element's frame-stable measurement. */
export interface FieldMeasurement {
  element: Element;
  rect: FieldRect;
  visible: boolean;
  /** fraction of the element's area within the viewport, ∈ [0,1]. */
  visibilityRatio: number;
  coordinateSpace: CoordinateSpace;
  /** the frame time this snapshot was taken. */
  timestamp: number;
}

/** A typed, observable element state value — numeric/boolean/string/vector2 (NOT ARIA). */
export type FieldStateValue =
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'string'; value: string }
  | { type: 'vector2'; x: number; y: number };

/** A viewport box for visibility computation (so measurement is testable without a window). */
export interface Viewport {
  width: number;
  height: number;
}
