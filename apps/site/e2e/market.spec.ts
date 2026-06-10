import { test, expect } from "./fixtures";

// /evidence/market — the cap-weighted mosaic. Mass is AREA (tier classes set the grid
// footprint); reweighting by volume re-tiers and re-sorts the tiles.
test.describe("/evidence/market", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/evidence/market");
  });

  test("the mosaic holds 24 tiles, tiered by cap with exactly one t1 anchor", async ({ page }) => {
    await expect(page.locator(".mk-tile")).toHaveCount(24);
    // log-normalized cap puts only the heaviest asset past the 0.8 tier-1 threshold
    await expect(page.locator(".mk-tile.mk-t1")).toHaveCount(1);
    // every tile carries some tier class
    await expect(page.locator(".mk-tile:not(.mk-t1):not(.mk-t2):not(.mk-t3):not(.mk-t4)")).toHaveCount(0);
  });

  test("reweighting by volume re-tiers the mosaic and a different asset leads", async ({
    page,
  }) => {
    const firstSym = page.locator(".mk-tile .mk-sym").first();
    const capLeader = (await firstSym.textContent())?.trim();
    const capT1 = await page.locator(".mk-tile.mk-t1").count();

    await page.locator('[data-mk-weight="volume"]').click();

    // tier distribution changes: volume's flatter log curve crowds tier 1
    await expect.poll(() => page.locator(".mk-tile.mk-t1").count()).not.toBe(capT1);
    // and the re-sort puts a different asset first (cap leader ≠ volume leader)
    await expect(firstSym).not.toHaveText(capLeader!);
  });

  test("a drawn sparkline path settles to stroke-dasharray: none", async ({ page }) => {
    const path = page.locator(".mk-tile .mk-spark path").first();
    // the entry draw-in is a keyframe; the dash exists only inside the animation, so a
    // fully drawn line computes stroke-dasharray: none.
    await expect
      .poll(() => path.evaluate((el) => getComputedStyle(el).strokeDasharray), {
        timeout: 10_000,
      })
      .toBe("none");
  });
});
