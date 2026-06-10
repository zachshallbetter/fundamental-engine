import { test, expect } from "./fixtures";

// Phase 1 of the navigation sweep — the docs cluster as signals-only fields:
//   · sidebar HIERARCHY  → priority-well (current route pinned as the well)
//   · "on this page"     → reading-field (attention + a memory read-trail)
//   · SEARCH             → search-relevance-field (result-type icons, per-section color, "seen")
// All gated by the docs-field toggle / reduced motion; progressive enhancement keeps plain links.

// read a numeric CSS custom property off an element (the var name is passed INTO the browser —
// Playwright can't serialize a closure over it, hence the explicit arg).
const readVar = (loc: import("@playwright/test").Locator, name: string) =>
  loc.evaluate((el, n) => parseFloat((el as HTMLElement).style.getPropertyValue(n)) || 0, name);

test.describe("docs sidebar · Priority Well", () => {
  test("the current route is pinned as the well — --field-attention drives to 1", async ({
    page,
  }) => {
    await page.goto("/docs/api/handle");
    const current = page.locator('#docsSide a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect
      .poll(() => readVar(current, "--field-attention"), { timeout: 10_000 })
      .toBeGreaterThan(0.9);
  });

  test("each group carries its wayfinding glyph + color", async ({ page }) => {
    await page.goto("/docs/api/handle");
    const groups = page.locator(".docs-group");
    const count = await groups.count();
    expect(count).toBe(6);
    // every group declares a decorative glyph + a per-section color (CSS custom props)
    for (let i = 0; i < count; i++) {
      expect((await groups.nth(i).evaluate((el) => el.style.getPropertyValue("--group-glyph"))).trim().length).toBeGreaterThan(0);
      expect((await groups.nth(i).evaluate((el) => el.style.getPropertyValue("--group-color"))).trim().length).toBeGreaterThan(0);
    }
  });
});

test.describe("docs outline · Reading Field", () => {
  test("a dwelt-on heading accretes --field-memory (the read trail)", async ({ page }) => {
    await page.goto("/docs");
    const heading = page.locator(".docs-content h2").nth(1);
    await expect(heading).toBeVisible();
    await heading.evaluate((el) => el.scrollIntoView({ block: "center" }));
    // reading-field accretes memory while the heading sits in view (attention > 0.6)
    await expect
      .poll(() => readVar(heading, "--field-memory"), { timeout: 12_000 })
      .toBeGreaterThan(0);
  });
});

test.describe("docs search · Search Relevance Field", () => {
  test("results carry a result-type icon, a section color, and a 'seen' mark for visited routes", async ({
    page,
  }) => {
    await page.goto("/docs"); // records /docs in the visit log
    await page.locator(".docs-search-btn").click();
    const input = page.locator("[data-docs-search-input]");
    await expect(input).toBeFocused();
    await input.fill("overview");
    const hits = page.locator("[data-docs-search-results] a.ds-hit");
    await expect(hits.first()).toBeVisible({ timeout: 10_000 });

    // every hit is typed (page ¶ or section #) and colored by its section
    const n = await hits.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const cls = (await hits.nth(i).getAttribute("class")) || "";
      expect(cls.includes("ds-hit-page") || cls.includes("ds-hit-section")).toBe(true);
      expect((await hits.nth(i).evaluate((el) => el.style.getPropertyValue("--hit-color"))).trim().length).toBeGreaterThan(0);
    }
    // the /docs route we just visited comes back marked 'seen'
    const seen = page.locator('[data-docs-search-results] a.ds-hit.ds-seen[href*="/docs"]');
    await expect(seen.first()).toBeVisible();
  });
});
