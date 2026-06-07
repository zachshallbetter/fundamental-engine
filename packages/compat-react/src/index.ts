/**
 * `@forces-ui/react` — deprecated compatibility alias of `@field-ui/react`.
 *
 * Renamed in the field-ui migration. This shim re-exports `@field-ui/react` unchanged so existing
 * `import { ForcesField, useForcesField } from '@forces-ui/react'` keeps working. Prefer
 * `@field-ui/react` in new code; this alias is slated for removal in a future major.
 */
export * from '@field-ui/react';
