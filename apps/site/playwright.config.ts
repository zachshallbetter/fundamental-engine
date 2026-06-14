import { defineConfig, devices } from "@playwright/test";

// E2E suite for the invisible-fields example pages (/evidence and /evidence/<slug>).
// The webServer serves the BUILT site (astro preview) — run `pnpm --filter @fundamental-engine/site build`
// before `pnpm test:e2e` locally; CI builds the workspace first. See e2e/README.md.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // The field pages are heavy (canvas + particle runtime + self-hosted fonts). Under parallel
  // worker contention the FIRST hit to a route on each worker — a cold browser launching onto a
  // cold page — can take 30–45s on the chromium runner, while warm runs finish in ~2s. The
  // default 30s test timeout sat right in that cold-start band, so chromium flaked (and "passed
  // on rerun" when the retry hit a warm page). 60s clears the cold-start band without weakening
  // any assertion. webkit/mobile are unaffected (they were already under budget).
  timeout: 60_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4399",
    trace: "retain-on-failure",
  },
  projects: [
    // the full suite on both desktop engines — the sparkline regression this suite exists
    // to prevent was WebKit-specific; chromium-only coverage would never catch its class.
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: "mobile.spec.ts" },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, testIgnore: "mobile.spec.ts" },
    // the emulated-touch QA pass over the twelve example pages (issue #299's
    // emulation-coverable portion) — a Pixel-class viewport with touch enabled.
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: "mobile.spec.ts" },
  ],
  webServer: {
    // NOTE: no `--` separator — pnpm forwards script args directly (a literal `--` would
    // reach astro and swallow the --port flag).
    command: "pnpm preview --port 4399",
    port: 4399,
    reuseExistingServer: !process.env.CI,
  },
});
