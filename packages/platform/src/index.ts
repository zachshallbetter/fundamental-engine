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
 * The alias is removed at 1.0. See https://fundamental-engine.com and
 * docs/canonical/deprecation-plan.md.
 */
export * from '@fundamental-engine/dom';

// One-time dev-only deprecation notice on import (#709). This is the compat *package* alias — the
// only living migration package (the old `compat-*` packages were removed at 0.7.0). Gated to
// non-production so a bundler that defines NODE_ENV dead-code-eliminates it; runs at most once
// (module state), never in the hot path.
{
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  if (env?.NODE_ENV !== 'production') {
    console.warn(
      "[Fundamental:DEPRECATED_ALIAS] the '@fundamental-engine/platform' package is a migration alias " +
        "for '@fundamental-engine/dom' and is removed at 1.0 — switch your imports to '@fundamental-engine/dom'.",
    );
  }
}
