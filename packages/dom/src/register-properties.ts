/**
 * registerFieldProperties — register the engine's field-density channels as typed, compositor-
 * interpolable CSS custom properties via `CSS.registerProperty`. Once a property is registered with
 * `syntax: '<number>'`, the browser can interpolate it on the compositor thread, so consumers can
 * `transition`/`animate` `var(--field-density)` (and its compact alias `var(--d)`) smoothly instead
 * of getting an all-or-nothing swap (untyped custom properties are treated as `<custom-ident>` and
 * jump rather than tween).
 *
 * Called once at browser-host boot. Feature-detected (`CSS.registerProperty` is not universal) and
 * idempotent — registering the same property twice throws a `SyntaxError`, so each registration is
 * guarded in its own try/catch and a module-level flag short-circuits repeat calls.
 */

/** The density channels written by the feedback registry that benefit from typed interpolation. */
const DENSITY_PROPERTIES = ['--field-density', '--d'] as const;

let registered = false;

/**
 * Register `--field-density` and its compact alias `--d` as typed `<number>` custom properties so
 * consumers can transition/animate them on the compositor. Safe to call repeatedly: a no-op once
 * registered, when `CSS.registerProperty` is unavailable, or when a property is already registered
 * (the per-property throw is swallowed). Returns the names actually registered by this call.
 */
export function registerFieldProperties(): string[] {
  if (registered) return [];
  registered = true;

  const css = (globalThis as { CSS?: { registerProperty?: (def: PropertyDefinition) => void } }).CSS;
  if (!css || typeof css.registerProperty !== 'function') return [];

  const done: string[] = [];
  for (const name of DENSITY_PROPERTIES) {
    try {
      css.registerProperty({ name, syntax: '<number>', inherits: true, initialValue: '0' });
      done.push(name);
    } catch {
      // Already registered (registering twice throws) or rejected by the engine — graceful no-op.
    }
  }
  return done;
}

/**
 * Reset the module-level "already registered" latch. Test-only seam — there is no production reason
 * to re-run registration within a single document. Underscore-prefixed; not part of the frozen API.
 */
export function _resetFieldPropertiesForTest(): void {
  registered = false;
}

/** Shape of the descriptor passed to `CSS.registerProperty` (subset we use). */
interface PropertyDefinition {
  name: string;
  syntax: string;
  inherits: boolean;
  initialValue: string;
}
