/**
 * Field states (worldclass §9, interaction §23 "state machines as physical scenes"). A small,
 * named state set plus the field behavior each implies — so a component's state machine can map
 * directly onto field behavior. Pure data + transition validation; node-testable.
 */

export type FieldState =
  // page/scene-level (worldclass §9)
  | 'idle'
  | 'focused'
  | 'searching'
  | 'navigating'
  | 'reading'
  | 'warning'
  | 'critical'
  | 'celebrating'
  // control-level (interaction §23 ButtonFieldState)
  | 'hovered'
  | 'pressed'
  | 'loading'
  | 'success'
  | 'error';

/** state → the field behavior it produces (interaction §23 table). */
export const FIELD_STATES: Readonly<Record<FieldState, string>> = {
  idle: 'ambient',
  focused: 'attract + feedback',
  searching: 'scatter → wells',
  navigating: 'stream',
  reading: 'memory trail',
  warning: 'entropy / thermal',
  critical: 'reduce sources / warn',
  celebrating: 'burst / emission',
  hovered: 'attract',
  pressed: 'sink (capture)',
  loading: 'stream / swirl',
  success: 'release',
  error: 'repel + thermal',
};

/** Whether a string is a known field state. */
export function isFieldState(s: string): s is FieldState {
  return s in FIELD_STATES;
}
