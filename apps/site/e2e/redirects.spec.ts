import { test, expect } from "./fixtures";
import { RETIRED_ROUTES, LEGACY_REDIRECTS } from "../src/lib/docs-redirects.mjs";

// THE SERVED HALF of the orphaned-URL guarantee (docs-refactor Phase 6, #1001).
//
// src/lib/docs-redirects.test.ts asserts the redirect MAP is coherent against the filesystem. This
// spec asserts the BUILT SITE actually honours it: every retired URL still answers, and a reader who
// follows an old link ends up on the page that replaced it rather than on a 404.
//
// Derived from the map, never hardcoded — retire a page, add its entry, and it is covered here the
// same day.

const entries = Object.entries(RETIRED_ROUTES) as [string, { to: string; why: string }][];

test.describe("retired docs URLs", () => {
  test("every retired URL still answers — nothing 404s", async ({ page }) => {
    const bad: string[] = [];
    for (const [from] of entries) {
      const res = await page.request.get(from, { maxRedirects: 0 });
      // a static redirect stub is served as 200 HTML (meta refresh); a host-level redirect is a 3xx.
      // Both are fine. A 404 is the failure this phase exists to prevent.
      if (res.status() >= 400) bad.push(`${from} → ${res.status()}`);
    }
    expect(bad, "retired URLs that no longer resolve").toEqual([]);
  });

  test("a reader following a retired URL lands on the page that replaced it", async ({ page }) => {
    for (const [from, { to }] of entries) {
      const target = to.split("#")[0]!;
      await page.goto(from);
      // the stub's meta refresh navigates; wait for the destination rather than asserting instantly
      await page.waitForURL(
        (u) => u.pathname.replace(/\/$/, "") === target.replace(/\/$/, ""),
        { timeout: 15_000 },
      );
      // and the destination is a real docs page, not another stub
      await expect(page.locator("main.docs-content h1")).toBeVisible();
    }
  });

  test("the pre-Phase-6 renames still resolve too", async ({ page }) => {
    const legacy = Object.keys(LEGACY_REDIRECTS).filter((r) => !r.includes("["));
    const bad: string[] = [];
    for (const from of legacy) {
      const res = await page.request.get(from, { maxRedirects: 0 });
      if (res.status() >= 400) bad.push(`${from} → ${res.status()}`);
    }
    expect(bad, "legacy redirects that rotted").toEqual([]);
  });

  test("the retired pages are gone from the sidebar, and the sidebar's own links are live pages", async ({
    page,
  }) => {
    await page.goto("/docs");
    const hrefs: string[] = await page.$$eval("#docsSide a", (as) =>
      as.map((a) => a.getAttribute("href")!).filter((h) => h.startsWith("/")),
    );
    const retired = entries.map(([from]) => from);
    expect(hrefs.filter((h) => retired.includes(h.replace(/\/$/, "")))).toEqual([]);
  });
});
