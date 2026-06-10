// The page-runtime lifecycle — extracted from seventeen identical copies (every example
// runtime, EvidenceRuntime, DocsRuntime, the home runtimes): boot on first load AND on every
// ClientRouter navigation, tear down before each swap, never stack. This is the site's
// Astro-lifecycle adapter; if it ever generalizes beyond this app it becomes the seed of an
// @field-ui/astro integration.

/**
 * Wire a page runtime: `init` runs when (and only when) `selector` matches — on initial
 * load and after every `astro:page-load` — and must return its teardown. The previous
 * teardown always runs first (re-navigation can't stack runtimes), and `astro:before-swap`
 * tears down unconditionally.
 */
export function pageRuntime(selector: string, init: (root: HTMLElement) => () => void): void {
  let teardown: (() => void) | undefined;
  const boot = (): void => {
    teardown?.();
    const root = document.querySelector<HTMLElement>(selector);
    teardown = root ? init(root) : undefined;
  };
  if (document.readyState !== "loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
  document.addEventListener("astro:page-load", boot);
  document.addEventListener("astro:before-swap", () => {
    teardown?.();
    teardown = undefined;
  });
}
