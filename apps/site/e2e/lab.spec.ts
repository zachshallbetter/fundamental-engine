import { test, expect } from "./fixtures";

// /lab — the physics detector. Boots synchronously on `astro:page-load` (selectForce →
// evaluate paints the checklist), so readiness is "the checklist has rows"; every assertion
// below auto-retries and none reads canvas pixels, so the spec is engine-neutral.
//
// Scenario tags (#693): curated per-force setups from `src/lib/lab-scenarios.ts` rendered as
// a chip strip under the transport. One click applies the tag's patch to the catalog scenario
// and refires; the share hash carries `tag=<id>`; forces with no curated tags show no strip.
test.describe("/lab", () => {
  test("boots on the default force with a checklist and a scenario strip", async ({ page }) => {
    await page.goto("/lab", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#checklist .check")).not.toHaveCount(0);
    // attract has curated tags; its default chip is `on` with no tag active
    await expect(page.locator("#tags")).toBeVisible();
    await expect(page.locator('#tags button[data-tag="rest"]')).toHaveClass(/\bon\b/);
    await expect(page.locator("main.lab")).toHaveAttribute("data-tag", "");
  });

  test("a scenario tag sets up a known scenario in one click", async ({ page }) => {
    await page.goto("/lab#collide", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#checklist .check")).not.toHaveCount(0);
    await expect(page.locator('#tags button[data-tag="head-on"]')).toHaveClass(/\bon\b/);

    await page.locator('#tags button[data-tag="glancing"]').click();
    await expect(page.locator('#tags button[data-tag="glancing"]')).toHaveClass(/\bon\b/);
    await expect(page.locator('#tags button[data-tag="head-on"]')).not.toHaveClass(/\bon\b/);
    await expect(page.locator("main.lab")).toHaveAttribute("data-tag", "glancing");
    // the run is renamed to the tag's scenario (the Tune note reads the tagged scenario label)
    await expect(page.locator("#note")).toContainText(/glancing/i);
    // the catalog checks are still the run's checks (collide's tags carry no list of their own)
    await expect(page.locator("#checklist .check")).toHaveCount(3);

    // clicking the default chip returns to the catalog scenario
    await page.locator('#tags button[data-tag="head-on"]').click();
    await expect(page.locator("main.lab")).toHaveAttribute("data-tag", "");
    await expect(page.locator("#note")).toContainText(/head-on/i);
  });

  test("a tag-owned expectation list replaces the catalog checks", async ({ page }) => {
    await page.goto("/lab#jet", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#checklist .check")).toHaveCount(3);
    await page.locator('#tags button[data-tag="far-field"]').click();
    await expect(page.locator("main.lab")).toHaveAttribute("data-tag", "far-field");
    await expect(page.locator("#checklist .check")).toHaveCount(2);
    await expect(page.locator("#checklist")).toContainText(/relaunched within the run/i);
  });

  test("a tagged share link restores the tag", async ({ page }) => {
    await page.goto("/lab#collide;tag=glancing", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#checklist .check")).not.toHaveCount(0);
    await expect(page.locator('#tags button[data-tag="glancing"]')).toHaveClass(/\bon\b/);
    await expect(page.locator("main.lab")).toHaveAttribute("data-tag", "glancing");
    await expect(page.locator("#note")).toContainText(/glancing/i);
  });

  test("an unknown tag id in the hash falls back to the catalog scenario", async ({ page }) => {
    await page.goto("/lab#collide;tag=no-such-tag", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#checklist .check")).not.toHaveCount(0);
    await expect(page.locator("main.lab")).toHaveAttribute("data-tag", "");
    await expect(page.locator('#tags button[data-tag="head-on"]')).toHaveClass(/\bon\b/);
  });

  test("forces without curated tags show no strip", async ({ page }) => {
    await page.goto("/lab#memory", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#checklist .check")).not.toHaveCount(0);
    await expect(page.locator("#tags")).toBeHidden();
  });
});
