/**
 * @fundamental-engine/platform — DEPRECATED.
 *
 * This package was renamed to `@fundamental-engine/dom` (it is the DOM-binding layer:
 * `browserHost()`, the six registries, the frame scheduler, `lintPlatform`, `bindData`).
 * This alias re-exports it unchanged so existing installs keep working; switch your imports:
 *
 * ```diff
 * - import { browserHost } from '@fundamental-engine/platform';
 * + import { browserHost } from '@fundamental-engine/dom';
 * ```
 *
 * The alias will be removed in a future major. See https://fundamental-engine.com.
 */
export * from '@fundamental-engine/dom';
