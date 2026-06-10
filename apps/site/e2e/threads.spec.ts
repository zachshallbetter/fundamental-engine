import { test, expect } from "./fixtures";

// /evidence/threads — one real HN discussion as a binding structure. Collapse hides a
// comment's whole subtree (a "+N … hidden" chip holds its place) and re-binds the field.
const TOTAL = 160;

test.describe("/evidence/threads", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/evidence/threads");
  });

  test("the thread holds all 160 comments, every one visible", async ({ page }) => {
    await expect(page.locator(".th-c")).toHaveCount(TOTAL);
    await expect(page.locator(".th-c:not([hidden])")).toHaveCount(TOTAL);
  });

  test("collapsing a subtree hides its descendants behind a hidden-count chip, and expanding restores them", async ({
    page,
  }) => {
    const row = page.locator(".th-c").filter({ has: page.locator(".th-caret") }).first();
    const caret = row.locator(".th-caret");
    const subtree = Number(await row.getAttribute("data-subtree"));
    expect(subtree).toBeGreaterThan(0);
    await expect(caret).toHaveAttribute("aria-expanded", "true");

    await caret.click();
    await expect(caret).toHaveAttribute("aria-expanded", "false");
    // the whole subtree left the page (and the field)
    await expect(page.locator(".th-c:not([hidden])")).toHaveCount(TOTAL - subtree);
    // a "+N replies hidden" chip holds its place
    const chip = row.locator(".th-hidden-n");
    await expect(chip).toBeVisible();
    await expect(chip).toHaveText(new RegExp(`\\+${subtree} (reply|replies) hidden`));

    await caret.click();
    await expect(caret).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".th-c:not([hidden])")).toHaveCount(TOTAL);
    await expect(chip).toBeHidden();
  });

  test("collapse all drops visibility to the top-level comments; expand all restores everything", async ({
    page,
  }) => {
    const topLevel = await page.locator(".th-c[data-top]").count();
    expect(topLevel).toBeGreaterThan(0);

    await page.locator('[data-th-all="collapse"]').click();
    await expect(page.locator(".th-c:not([hidden])")).toHaveCount(topLevel);

    await page.locator('[data-th-all="expand"]').click();
    await expect(page.locator(".th-c:not([hidden])")).toHaveCount(TOTAL);
  });
});
