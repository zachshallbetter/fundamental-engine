/**
 * The framework-free imperative mount now lives in `@fundamental-engine/vanilla` — the package with
 * no custom-element side effects, the natural home for a framework-free API. It is re-exported
 * here so `import { mountField } from '@fundamental-engine/elements'` keeps working unchanged.
 */

export { mountField } from '@fundamental-engine/vanilla';
export type { MountOptions } from '@fundamental-engine/vanilla';
