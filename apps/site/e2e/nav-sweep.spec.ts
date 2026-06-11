import { test, expect } from "./fixtures";

// Phases 2–4 of the navigation sweep: breadcrumbs + pagers, writings shell, footer, filter chips,
// and the examples scroll-spy as a reading-field. Signals-only + progressive enhancement throughout.

const readVar = (loc: import("@playwright/test").Locator, name: string) =>
  loc.evaluate((el, n) => parseFloat((el as HTMLElement).style.getPropertyValue(n)) || 0, name);

test.describe("breadcrumbs + pager", () => {
  test("docs page shows the Home › Docs › Group › Page trail and an N-of-M pager", async ({
    page,
  }) => {
    await page.goto("/docs/api/handle");
    const bc = page.locator(".breadcrumbs");
    await expect(bc).toBeVisible();
    await expect(bc.locator('a[href="/"]')).toHaveText("Home");
    await expect(bc.locator('a[href="/docs"]')).toHaveText("Docs");
    // last crumb is the current page, not a link
    await expect(bc.locator('[aria-current="page"]')).toHaveText("FieldHandle");
    // pager progress reads "N / M"
    await expect(page.locator(".docs-prevnext .pn-progress")).toHaveText(/\d+\s*\/\s*\d+/);
  });

  test("a writing page carries the writings breadcrumb", async ({ page }) => {
    await page.goto("/writings");
    const href = await page.locator(".wi-card-link").first().getAttribute("href");
    expect(href).toBeTruthy();
    // the breadcrumb is server-rendered — don't wait on the article's heavy subresources
    await page.goto(href!, { waitUntil: "domcontentloaded" });
    const bc = page.locator(".breadcrumbs");
    await expect(bc).toBeVisible();
    await expect(bc.locator('a[href="/writings"]')).toHaveText("Writings");
    await expect(bc.locator('[aria-current="page"]')).toHaveCount(1);
  });
});

test.describe("writings index · per-category color", () => {
  test("each category section carries its color + glyph", async ({ page }) => {
    await page.goto("/writings");
    const sections = page.locator(".wi-section");
    expect(await sections.count()).toBeGreaterThanOrEqual(1);
    const first = sections.first();
    expect((await first.evaluate((el) => el.style.getPropertyValue("--cat-color"))).trim().length).toBeGreaterThan(0);
    await expect(first.locator(".wi-glyph")).toBeVisible();
  });
});

test.describe("footer · Wayfinding Field", () => {
  test("the current section's footer link is pinned — --field-attention drives to 1", async ({
    page,
  }) => {
    await page.goto("/docs"); // the footer carries a Docs link → current section
    const link = page.locator('.sf-links a[href="/docs"]');
    await expect(link).toHaveCount(1);
    await expect.poll(() => readVar(link, "--field-attention"), { timeout: 10_000 }).toBeGreaterThan(0.9);
  });
});

test.describe("recipes filter chips · per-field color", () => {
  test("the natural-field chips carry their field color", async ({ page }) => {
    await page.goto("/recipes");
    const gravity = page.locator('.chip[data-filter="gravity"]');
    await expect(gravity).toHaveClass(/chip-field/);
    expect((await gravity.evaluate((el) => el.style.getPropertyValue("--chip-color"))).trim().length).toBeGreaterThan(0);
  });
});

test.describe("examples spy · Reading Field", () => {
  test("a demo section in view accretes --field-memory (mirrored onto the side nav)", async ({
    page,
  }) => {
    await page.goto("/examples");
    const section = page.locator("#card-grid");
    await section.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await expect.poll(() => readVar(section, "--field-memory"), { timeout: 12_000 }).toBeGreaterThan(0);
  });
});
