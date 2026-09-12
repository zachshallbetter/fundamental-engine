import { test, expect } from "./fixtures";

// The Lab (/lab) — the conformance detector. Engine-neutral checks (no canvas pixels): the
// page boots and paints its checklist, and the per-force scenario tags (#693) set up a known
// scenario in one click, survive a share link, and stay hidden for forces without a strip.
// Readiness: domcontentloaded + auto-retrying assertions only — the Lab boots synchronously on
// astro:page-load, and the suite's 60s timeout covers a cold chromium worker.

const gotoLab = async (page: import("@playwright/test").Page, hash = "") => {
  await page.goto(`/lab${hash}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#checklist .check").first()).toBeVisible();
};

test("boots on the default force and paints the checklist", async ({ page }) => {
  await gotoLab(page);
  await expect(page.locator("main.lab .force-tile.on")).toHaveAttribute("data-force", "attract");
  // attract has a scenario strip; its default chip is on until a tag is picked
  await expect(page.locator("#tags")).toBeVisible();
  await expect(page.locator('#tags button[data-tag="at-rest"]')).toHaveClass(/\bon\b/);
  await expect(page.locator("main.lab")).toHaveAttribute("data-tag", "");
});

test("a scenario tag sets up a known scenario in one click", async ({ page }) => {
  await gotoLab(page, "#collide");
  const glancing = page.locator('#tags button[data-tag="glancing"]');
  const headOn = page.locator('#tags button[data-tag="head-on"]');
  await expect(headOn).toHaveClass(/\bon\b/);
  await glancing.click();
  await expect(glancing).toHaveClass(/\bon\b/);
  await expect(glancing).toHaveAttribute("aria-pressed", "true");
  await expect(headOn).not.toHaveClass(/\bon\b/);
  await expect(page.locator("main.lab")).toHaveAttribute("data-tag", "glancing");
  await expect(page.locator("#note")).toContainText(/glancing/i);
  // the catalog's invariants still run (3 checks for collide); a tag re-evaluates the run
  await expect(page.locator("#checklist .check")).toHaveCount(3);
  // back to the default chip → the catalog scenario
  await headOn.click();
  await expect(headOn).toHaveClass(/\bon\b/);
  await expect(page.locator("main.lab")).toHaveAttribute("data-tag", "");
  await expect(page.locator("#note")).toContainText(/head-on/i);
});

test("a tagged share link restores the tag", async ({ page }) => {
  await gotoLab(page, "#collide;tag=glancing");
  await expect(page.locator('#tags button[data-tag="glancing"]')).toHaveClass(/\bon\b/);
  await expect(page.locator('#tags button[data-tag="head-on"]')).not.toHaveClass(/\bon\b/);
  await expect(page.locator("main.lab")).toHaveAttribute("data-tag", "glancing");
  await expect(page.locator("#note")).toContainText(/glancing/i);
});

test("an unknown tag id in a share link falls back to the catalog scenario", async ({ page }) => {
  await gotoLab(page, "#collide;tag=nope");
  await expect(page.locator('#tags button[data-tag="head-on"]')).toHaveClass(/\bon\b/);
  await expect(page.locator("main.lab")).toHaveAttribute("data-tag", "");
});

test("forces without curated scenarios show no strip", async ({ page }) => {
  await gotoLab(page, "#memory");
  await expect(page.locator("main.lab .force-tile.on")).toHaveAttribute("data-force", "memory");
  await expect(page.locator("#tags")).toBeHidden();
});
