/**
 * `forces-ui` — deprecated compatibility alias of `field-ui`.
 *
 * The core package was renamed `forces-ui` → `field-ui` in the field-ui migration. This shim
 * re-exports the entire `field-ui` surface so existing `import … from 'forces-ui'` keeps working
 * unchanged. Reach for `field-ui` in new code; this alias is slated for removal in a future
 * major (see `docs/planning-archive/field-ui-migration-plan.md` §15, Alias Implementation Contract).
 */
export * from '@field-ui/core';
