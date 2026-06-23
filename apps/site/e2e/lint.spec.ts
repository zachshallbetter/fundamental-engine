import { test, expect } from "./fixtures";

// RC-8 automatable gate: lintPlatform() warnings are capped on every shipped
// page. DataConsole.astro runs a background lint poll (2 s cadence) that
// writes the warning count to `data-lint-count` on `#dc-panel` — readable
// without opening the console UI.
//
// Strategy per page:
//   1. Navigate and wait for field-root to boot (particleCount > 0).
//   2. Wait up to 10 s for `data-lint-count` to be a numeric string (first
//      poll fires ≤ 2 s after the platform becomes available).
//   3. Assert the count is at or below the known-good cap.
//
// The caps below are the measured baselines at the time this gate was added.
// The real RC-8 goal is zero warnings — these caps hold the line while the
// remaining warnings are worked down to zero in follow-up issues. Any increase
// above the cap is a lint regression and fails CI. Any decrease can be locked
// in by tightening the cap.
//
// WARNING CAPS (measured 2026-06-23):
//   /          → 11 (mix of feedback-writes-unread / feedback-reads-unwritten
//                    heuristic warnings on homepage body elements; tracked)
//   /docs      →  0 (clean ✓)
//   /evidence  →  2 (two feedback-lane warnings on evidence field elements; tracked)

const PANEL = "#dc-panel";

/** Wait for `data-lint-count` to be a non-empty numeric string and return it. */
async function awaitLintCount(page: Parameters<typeof test>[1]["page"]): Promise<number> {
  const panel = page.locator(PANEL);
  // wait up to 10 s; the first poll fires at most 2 s after the platform boots
  await expect.poll(
    async () => {
      const raw = await panel.getAttribute("data-lint-count");
      return raw !== null && raw !== "" && /^\d+$/.test(raw) ? raw : null;
    },
    { timeout: 10_000 },
  ).not.toBeNull();
  const raw = await panel.getAttribute("data-lint-count");
  return parseInt(raw ?? "0", 10);
}

// ── / (homepage) ──────────────────────────────────────────────────────
test.describe("/ (homepage)", () => {
  test("lintPlatform warning count does not exceed the known-good cap", async ({ page }) => {
    await page.goto("/");
    // wait for the engine to seed — the platform only becomes available after boot
    await expect
      .poll(
        async () =>
          page.evaluate(() => (document.querySelector("field-root") as any)?.particleCount?.() ?? 0),
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0);

    const count = await awaitLintCount(page);
    // Cap: 11 (baseline 2026-06-23). Reduce this as warnings are fixed.
    // Full zero is the RC-8 goal; the cap is a regression guard in the meantime.
    expect(
      count,
      `/ lint warnings (${count}) exceed the known cap of 11 — a regression was introduced`,
    ).toBeLessThanOrEqual(11);
  });
});

// ── /docs ──────────────────────────────────────────────────────────────
test.describe("/docs", () => {
  test("lintPlatform returns 0 warnings", async ({ page }) => {
    await page.goto("/docs");
    // /docs renders field-root; wait for engine boot
    await expect
      .poll(
        async () =>
          page.evaluate(() => (document.querySelector("field-root") as any)?.particleCount?.() ?? 0),
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0);

    const count = await awaitLintCount(page);
    expect(count, `/docs produced ${count} lint warning(s) — fix or raise the cap`).toBe(0);
  });
});

// ── /evidence ─────────────────────────────────────────────────────────
test.describe("/evidence", () => {
  test("lintPlatform warning count does not exceed the known-good cap", async ({ page }) => {
    await page.goto("/evidence");
    // /evidence uses a standalone field setup; wait for field-root if present
    const hasFieldRoot = await page.locator("field-root").count();
    if (hasFieldRoot > 0) {
      await expect
        .poll(
          async () =>
            page.evaluate(() => (document.querySelector("field-root") as any)?.particleCount?.() ?? 0),
          { timeout: 30_000 },
        )
        .toBeGreaterThan(0);
    }

    const count = await awaitLintCount(page);
    // Cap: 2 (baseline 2026-06-23). Reduce this as warnings are fixed.
    expect(
      count,
      `/evidence lint warnings (${count}) exceed the known cap of 2 — a regression was introduced`,
    ).toBeLessThanOrEqual(2);
  });
});
