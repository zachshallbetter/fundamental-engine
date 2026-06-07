/**
 * The framework-free imperative mount now lives in `@field-ui/vanilla` — the package with
 * no custom-element side effects, the natural home for a framework-free API. It is re-exported
 * here so `import { mountField } from '@field-ui/elements'` keeps working unchanged.
 */

export { mountField } from '@field-ui/vanilla';
export type { MountOptions } from '@field-ui/vanilla';
