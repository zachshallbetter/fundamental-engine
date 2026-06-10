import { test, expect } from "./fixtures";

// /evidence/inbox — attention as a CONSERVED budget: Σ --w over every ask (stream and
// focus pane alike) is pinned to N × 0.42 by the water-filling allocator.
const BUDGET_PER_ITEM = 0.42;

// every ask, both panes — the same set the runtime's itemsOf() sums over
const ITEMS = "[data-ix-split] .ix-item";

const sumW = (page: import("@playwright/test").Page): Promise<number> =>
  page.$$eval(ITEMS, (els) =>
    els.reduce((s, el) => s + (parseFloat((el as HTMLElement).style.getPropertyValue("--w")) || 0), 0),
  );

test.describe("/evidence/inbox", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/evidence/inbox");
  });

  test("the attention budget is conserved: Σ --w = items × 0.42", async ({ page }) => {
    const items = page.locator(ITEMS);
    const n = await items.count();
    expect(n).toBeGreaterThan(0);
    await expect
      .poll(async () => Math.abs((await sumW(page)) - n * BUDGET_PER_ITEM))
      .toBeLessThan(0.05);
  });

  test("pinning moves the ask into the focus pane, holds the conserved sum, and unpinning returns it", async ({
    page,
  }) => {
    const n = await page.locator(ITEMS).count();
    const budget = n * BUDGET_PER_ITEM;
    // wait for the runtime's first allocation before interacting
    await expect.poll(async () => Math.abs((await sumW(page)) - budget)).toBeLessThan(0.05);

    const first = page.locator("[data-ix-list] .ix-item").first();
    const id = await first.getAttribute("id");
    await first.locator(".ix-pin").click();

    // the card traveled into the focus pane and holds a full unit
    const pinned = page.locator(`[data-ix-focus-list] #${id}`);
    await expect(pinned).toHaveCount(1);
    await expect(page.locator("[data-ix-meter]")).toContainText("pinned 1");
    // conservation: the sum over BOTH panes is still the budget
    await expect.poll(async () => Math.abs((await sumW(page)) - budget)).toBeLessThan(0.05);

    // unpin: the card returns to the stream and the meter reads pinned 0
    await pinned.locator(".ix-pin").click();
    await expect(page.locator(`[data-ix-list] #${id}`)).toHaveCount(1);
    await expect(page.locator("[data-ix-meter]")).toContainText("pinned 0");
    await expect.poll(async () => Math.abs((await sumW(page)) - budget)).toBeLessThan(0.05);
  });
});
