/**
 * Event agents (§22.5) — a force/condition firing on a body dispatches a
 * debounced CustomEvent, so the field can drive app behaviour, not just pixels.
 * Declared with `data-on="dense:field:lit, captured:field:dock"` (trigger:event,
 * comma-separated). Rising-edge debounced: fires once on cross, re-arms on reset.
 */

export interface EventBinding {
  trigger: string;
  event: string;
  /** true while the trigger is held (so we fire only on the rising edge). */
  armed: boolean;
}

/** Parse a `data-on` string into trigger→event bindings (event names may contain ':'). */
export function parseEventBindings(spec: string): EventBinding[] {
  return spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf(':');
      return { trigger: pair.slice(0, i).trim(), event: pair.slice(i + 1).trim(), armed: false };
    })
    .filter((b) => b.trigger && b.event);
}

/** Body state a trigger reads. */
export interface TriggerState {
  d: number;
  on: boolean;
  accreted: number;
}

/** Whether a trigger currently holds (rising-edge debounce handled by the caller). */
export function triggerActive(trigger: string, s: TriggerState): boolean {
  switch (trigger) {
    case 'dense':
      return s.d > 0.6;
    case 'sparse':
      return s.d < 0.2;
    case 'engaged':
      return s.on;
    case 'captured':
      return s.accreted > 0;
    default:
      return false;
  }
}
