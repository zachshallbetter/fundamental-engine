import { test, expect } from "@playwright/test";

// /recipes is the solution-finder catalog (formerly /explore): a problem-domain filter bar, a static
// card grid that filters client-side, and an expand-in-place detail overlay deep-linked via ?r=.
// These pin the browse/expand invariants at the DOM level (independent of whether the field draws).

test.describe("/recipes · solution-finder catalog", () => {
  test("renders the full canonical catalog under the nine-domain filter", async ({ page }) => {
    await page.goto("/recipes");
    await expect(page.locator(".ex-card")).toHaveCount(64);
    // All + nine problem domains + Platform & Teaching
    await expect(page.locator(".ex-pill")).toHaveCount(11);
    // experimental recipes are preserved as a linked section
    await expect(page.locator(".ex-exp-list li")).toHaveCount(4);
  });

  test("a domain filter narrows the result count and marks itself active", async ({ page }) => {
    await page.goto("/recipes");
    const conflict = page.locator('.ex-pill[data-domain="conflict"]');
    await conflict.click();
    await expect(conflict).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-result-count]")).toContainText("12");
  });

  test("clicking a card expands the detail overlay and deep-links via ?r=", async ({ page }) => {
    await page.goto("/recipes");
    await page.locator('.ex-card[data-recipe-id="priority-well"] .ex-card-link').click();
    await expect(page.locator(".ex-detail")).toBeVisible();
    await expect(page.locator(".exd-name")).toHaveText("Priority Well");
    await expect(page).toHaveURL(/\/recipes\?r=priority-well$/);
    // the overlay carries the unified workbench, not a navigation away
    await expect(page.locator(".exd-workbench")).toBeVisible();
  });

  test("a ?r= deep-link opens the recipe on load; Escape closes it", async ({ page }) => {
    await page.goto("/recipes?r=evidence-field");
    await expect(page.locator(".exd-name")).toHaveText("Evidence Field");
    await page.keyboard.press("Escape");
    await expect(page.locator(".ex-detail")).toBeHidden();
    await expect(page).not.toHaveURL(/r=/);
  });

  // ── perf: the catalog is calm at rest (no per-card fields) and at most one preview field runs ────
  test("no per-card fields at rest; the expanded preview owns at most two canvases", async ({ page }) => {
    await page.goto("/recipes");
    // the old hub ran a field per visible card; the solution-finder runs none until you expand
    await expect(page.locator(".ex-card canvas")).toHaveCount(0);
    await page.locator('.ex-card[data-recipe-id="signal-path"] .ex-card-link').click();
    await expect(page.locator(".exd-workbench")).toBeVisible();
    // the one live preview: substrate canvas + overlay canvas — the engine's two-surface budget
    await expect(page.locator(".ex-detail-preview canvas")).toHaveCount(2);
  });

  // ── a11y: reduced motion draws nothing — the static meaning stands in for the field ─────────────
  test("reduced motion: the expanded preview shows the static fallback, no field canvas", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/recipes?r=priority-well");
    await expect(page.locator(".exd-name")).toHaveText("Priority Well");
    await expect(page.locator(".ex-detail-preview .exd-static")).toBeVisible();
    await expect(page.locator(".ex-detail-preview canvas")).toHaveCount(0);
  });

  // ── a11y: keyboard — Enter opens the overlay, Escape closes it and restores focus to the card ───
  test("keyboard: Enter opens the overlay, Escape restores focus to the originating card", async ({ page }) => {
    await page.goto("/recipes");
    const link = page.locator('.ex-card[data-recipe-id="conflict-field"] .ex-card-link');
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".ex-detail")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".ex-detail")).toBeHidden();
    await expect(link).toBeFocused();
  });
});
