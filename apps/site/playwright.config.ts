import { defineConfig, devices } from "@playwright/test";

// E2E suite for the invisible-fields example pages (/evidence and /evidence/<slug>).
// The webServer serves the BUILT site (astro preview) — run `pnpm --filter @field-ui/site build`
// before `pnpm test:e2e` locally; CI builds the workspace first. See e2e/README.md.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4399",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // NOTE: no `--` separator — pnpm forwards script args directly (a literal `--` would
    // reach astro and swallow the --port flag).
    command: "pnpm preview --port 4399",
    port: 4399,
    reuseExistingServer: !process.env.CI,
  },
});
