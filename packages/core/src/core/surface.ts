/**
 * The decorative full-viewport canvas surface (§13, §18) — one source of truth for the
 * fixed, click-through, behind-everything styling every managed mount uses. The vanilla
 * `mountField` / `ForcesField` and the React `<ForcesField>` render this exact surface; the
 * web component styles its shadow host to match.
 */

/** The surface as a style object (React `CSSProperties`-compatible). */
export const FIELD_CANVAS_STYLE = {
  position: 'fixed',
  inset: '0',
  width: '100%',
  height: '100%',
  zIndex: '0',
  pointerEvents: 'none',
  display: 'block',
} as const;

/** The same surface as a `cssText` string (camelCase keys → kebab-case), for `style.cssText`. */
export const FIELD_CANVAS_CSS = Object.entries(FIELD_CANVAS_STYLE)
  .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${v}`)
  .join(';');
