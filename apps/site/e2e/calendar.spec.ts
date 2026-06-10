import { test, expect } from "./fixtures";

// /evidence/calendar — three calendar geometries over the same launches, and the one page
// whose field input is time itself (a 1 Hz clock drives the countdowns and weights).
test.describe("/evidence/calendar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/evidence/calendar");
  });

  test("the layout segment offers day, week, and month", async ({ page }) => {
    for (const v of ["day", "week", "month"]) {
      await expect(page.locator(`[data-cal-view="${v}"]`)).toHaveCount(1);
    }
    // week is the default
    await expect(page.locator('[data-cal-view="week"]')).toHaveAttribute("aria-pressed", "true");
  });

  test("month view reflects in the URL and renders the Sun–Sat grid", async ({ page }) => {
    await page.locator('[data-cal-view="month"]').click();
    await expect(page).toHaveURL(/[?&]view=month/);
    await expect(page.locator(".cal-mgrid")).toHaveCount(1);
    // the 7-column weekday header
    await expect(page.locator(".cal-mgrid .cal-mwd")).toHaveCount(7);
    await expect(page.locator(".cal-mcell").first()).toBeAttached();
  });

  test("day view reflects in the URL and offers prev/next day navigation", async ({ page }) => {
    await page.locator('[data-cal-view="day"]').click();
    await expect(page).toHaveURL(/[?&]view=day/);
    await expect(page.locator("[data-cal-prev]")).toHaveCount(1);
    await expect(page.locator("[data-cal-next]")).toHaveCount(1);
  });

  test("the hero countdown reads T− and ticks with the 1 Hz clock", async ({ page }) => {
    const count = page.locator("[data-cal-hero] [data-cal-count]");
    await expect(count).toHaveText(/T−/);
    const before = await count.textContent();
    // the 1 Hz tick must move the countdown across a 2.5s window
    await page.waitForTimeout(2500);
    expect(await count.textContent()).not.toBe(before);
    await expect(count).toHaveText(/T−/);
  });
});
