import { test, expect } from "./fixtures";

// /evidence/backlog — the two-lane board over the repo's own work stream, with the
// hand-rolled pointer drag as a LOCAL triage sandbox (localStorage only).
test.describe("/evidence/backlog", () => {
  test.beforeEach(async ({ page }) => {
    // a clean board every run — saved triage would change the lane counts
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/evidence/backlog");
  });

  test("the lanes count 3 in flight and 54 shipped", async ({ page }) => {
    await expect(page.locator('[data-wl-lane="open"] [data-wl-count]')).toHaveText("3");
    await expect(page.locator('[data-wl-lane="shipped"] [data-wl-count]')).toHaveText("54");
    await expect(page.locator('[data-wl-list="open"] .wl-item')).toHaveCount(3);
    await expect(page.locator('[data-wl-list="shipped"] .wl-item')).toHaveCount(54);
  });

  test("dragging an in-flight card into Shipped re-counts the lanes locally, and reset restores the snapshot", async ({
    page,
  }) => {
    // the board is far taller than the viewport — bring the source card itself into view
    // and aim at the part of the shipped lane that is actually on screen
    const card = page.locator('[data-wl-list="open"] .wl-item').first();
    await card.scrollIntoViewIfNeeded();
    const src = await card.boundingBox();
    const shipped = await page.locator('[data-wl-lane="shipped"]').boundingBox();
    expect(src && shipped).toBeTruthy();
    const viewport = page.viewportSize()!;

    // grab the card on its meta line (never the title link), travel in steps past the
    // 6px arm threshold, and drop inside the shipped lane — within the viewport and
    // clear of the ±60px edge-scroll band.
    const grabX = src!.x + 12;
    const grabY = src!.y + src!.height - 10;
    const dropX = shipped!.x + shipped!.width / 2;
    const dropY = Math.min(
      Math.max(shipped!.y + 80, 120),
      viewport.height - 120,
      shipped!.y + shipped!.height - 40,
    );
    await page.mouse.move(grabX, grabY);
    await page.mouse.down();
    await page.mouse.move(dropX, dropY, { steps: 15 });
    // let the per-frame slot indicator settle on the drop position
    await page.waitForTimeout(150);
    await page.mouse.up();

    await expect(page.locator('[data-wl-lane="open"] [data-wl-count]')).toHaveText("2");
    await expect(page.locator('[data-wl-lane="shipped"] [data-wl-count]')).toHaveText("55");
    // honesty: the divergence from the snapshot is marked "(local)"
    await expect(page.locator("[data-wl-local]").first()).toBeVisible();
    await expect(page.locator("[data-wl-cycle-note]")).toContainText("locally triaged");

    // reset board → the server arrangement returns
    const reset = page.locator("[data-wl-reset]");
    await expect(reset).toBeEnabled();
    await reset.click();
    await expect(page.locator('[data-wl-lane="open"] [data-wl-count]')).toHaveText("3");
    await expect(page.locator('[data-wl-lane="shipped"] [data-wl-count]')).toHaveText("54");
    await expect(page.locator("[data-wl-local]").first()).toBeHidden();
  });
});
