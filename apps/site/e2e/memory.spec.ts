import { test, expect } from "./fixtures";

// /evidence/memory — the forgetting curve over real word frequencies. The slider decays
// the grid; a review springs a card back to its anchor strength; both persist locally.
test.describe("/evidence/memory", () => {
  test("slider decay, review spring-back, and persistence across reload", async ({ page }) => {
    // clean storage FIRST (before the scenario, not between steps) — the run depends on
    // starting from the day-7 default, and the final reload must KEEP what the run stored
    await page.goto("/evidence/memory");
    await page.evaluate(() => {
      localStorage.removeItem("fui:memory-reviews");
      localStorage.removeItem("fui:memory-day");
    });
    await page.reload();

    const cards = page.locator(".mx-card");
    const avgW = (): Promise<number> =>
      cards.evaluateAll(
        (els) =>
          els.reduce(
            (s, el) => s + (parseFloat((el as HTMLElement).style.getPropertyValue("--w")) || 0),
            0,
          ) / els.length,
      );

    await expect(page.locator("[data-mx-days-input]")).toHaveValue("7");
    const avgAt7 = await avgW();
    expect(avgAt7).toBeGreaterThan(0);

    // push the slider to day 50 — the whole grid decays in real time
    await page.locator("[data-mx-days-input]").evaluate((el) => {
      const input = el as HTMLInputElement;
      input.value = "50";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect(page.locator("[data-mx-days-out]")).toHaveText("50d");
    const avgAt50 = await avgW();
    expect(avgAt50).toBeLessThan(avgAt7);

    // review two cards — each springs back to its full anchor strength at the current day
    const reviewed = [cards.nth(0), cards.nth(1)];
    for (const card of reviewed) {
      await card.click();
      await expect(card).toHaveAttribute("data-reviewed", "");
      const { w, anchor } = await card.evaluate((el) => ({
        w: parseFloat((el as HTMLElement).style.getPropertyValue("--w")),
        anchor: parseFloat((el as HTMLElement).dataset.anchor ?? ""),
      }));
      expect(Math.abs(w - anchor)).toBeLessThan(0.002);
    }

    // reload: the slider's day and the reviews persist on this device
    await page.reload();
    await expect(page.locator("[data-mx-days-input]")).toHaveValue("50");
    await expect(page.locator("[data-mx-days-out]")).toHaveText("50d");
    await expect(cards.nth(0)).toHaveAttribute("data-reviewed", "");
    await expect(cards.nth(1)).toHaveAttribute("data-reviewed", "");
    await expect(cards.nth(2)).not.toHaveAttribute("data-reviewed", "");
  });
});
