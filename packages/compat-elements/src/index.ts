/**
 * `@forces-ui/elements` — deprecated compatibility alias of `@field-ui/elements`.
 *
 * Renamed in the field-ui migration. The explicit side-effect import guarantees the custom
 * elements register (`forces-field` / `forces-cell` and their `field-*` aliases) even under a
 * tree-shaking bundler; the star re-export forwards the public API. Prefer `@field-ui/elements`
 * in new code; this alias is slated for removal in a future major.
 */
import '@field-ui/elements';
export * from '@field-ui/elements';
