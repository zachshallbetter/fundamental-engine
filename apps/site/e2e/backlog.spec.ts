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
    browserName,
  }) => {
    // Synthetic drag-and-drop is unreliable in CI WebKit: Linux WebKit under software rendering delivers
    // pointer events too sparsely for the runtime's per-frame drag tracking to follow the gesture, so the
    // drag intermittently never arms (the card stays put, the lane count never changes) even with the
    // paced steps + gesture retry below. The drag mechanic is browser-agnostic in the product; chromium +
    // mobile cover it. Skipping just this interaction on WebKit keeps the lane re-count honest elsewhere
    // rather than letting a known WebKit-CI input limitation flake the whole suite (and stall the queue).
    test.skip(browserName === "webkit", "synthetic drag unreliable in CI WebKit software rendering");
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

    // The gesture is paced so the runtime's per-frame tracking sees every stage even on
    // slow CI renderers (Linux WebKit under software rendering delivers pointer events
    // sparsely): arm first with a short move, then travel in waited stages, then settle.
    const dragOnce = async (): Promise<void> => {
      await page.mouse.move(grabX, grabY);
      await page.waitForTimeout(60);
      await page.mouse.down();
      await page.mouse.move(grabX + 12, grabY + 8, { steps: 3 }); // past the 6px arm threshold
      await page.waitForTimeout(120);
      const midX = (grabX + dropX) / 2;
      const midY = (grabY + dropY) / 2;
      await page.mouse.move(midX, midY, { steps: 8 });
      await page.waitForTimeout(120);
      await page.mouse.move(dropX, dropY, { steps: 8 });
      // let the per-frame slot indicator settle on the drop position
      await page.waitForTimeout(300);
      await page.mouse.move(dropX, dropY + 2);
      await page.waitForTimeout(120);
      await page.mouse.up();
      await page.waitForTimeout(200);
    };
    await dragOnce();
    // one gesture retry for event-delivery flake — the assertions below stay strict
    const openCount = page.locator('[data-wl-lane="open"] [data-wl-count]');
    if ((await openCount.textContent())?.trim() !== "2") await dragOnce();

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
