import { test, expect } from "./fixtures";

// /evidence/library — the ranked bar ladder + the queue as a genuine sink that releases
// at capacity (8/8), mirroring the engine's capture→release cycle.
test.describe("/evidence/library", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/evidence/library");
  });

  test("the ladder descends: --bar of row 1 ≥ row 2 ≥ row 3", async ({ page }) => {
    const bars = await page
      .locator(".lb-row")
      .evaluateAll((rows) =>
        rows
          .slice(0, 3)
          .map((r) => parseFloat((r as HTMLElement).style.getPropertyValue("--bar")) || 0),
      );
    expect(bars).toHaveLength(3);
    expect(bars[0]).toBeGreaterThanOrEqual(bars[1]);
    expect(bars[1]).toBeGreaterThanOrEqual(bars[2]);
  });

  test("queueing 8 tracks fills the sink to 8/8 and it releases", async ({ page }) => {
    const count = page.locator("[data-lb-count]");
    await expect(count).toHaveText("0 / 8");

    const buttons = page.locator(".lb-row [data-lb-add]");
    for (let i = 0; i < 7; i++) await buttons.nth(i).click();
    await expect(count).toHaveText("7 / 8");

    // the eighth track tips the sink to capacity…
    await buttons.nth(7).click();
    // …and it RELEASES: the count returns to 0 / 8 and the released note appears
    await expect(count).toHaveText("0 / 8", { timeout: 3000 });
    const release = page.locator("[data-lb-release]");
    await expect(release).toBeVisible();
    await expect(release).toHaveText("released 8 tracks");
    // the chips are gone and the add buttons are usable again
    await expect(page.locator("[data-lb-chips] .lb-chip")).toHaveCount(0);
    await expect(buttons.first()).toBeEnabled();
  });
});
