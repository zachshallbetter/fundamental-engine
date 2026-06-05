/**
 * The framework-free imperative mount now lives in `@forces-ui/vanilla` — the package with
 * no custom-element side effects, the natural home for a framework-free API. It is re-exported
 * here so `import { mountField } from '@forces-ui/elements'` keeps working unchanged.
 */

export { mountField } from '@forces-ui/vanilla';
export type { MountOptions } from '@forces-ui/vanilla';
