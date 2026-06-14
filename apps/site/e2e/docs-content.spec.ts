import { test, expect } from "./fixtures";
import { DOCS_NAV } from "../src/lib/docs-nav";
import { INVISIBLE_FIELDS } from "../src/lib/invisible-fields";

// The docs content systems: the index-as-map (rendered FROM the same nav tree as the
// sidebar, so this spec imports that tree rather than hardcoding it), the API provenance
// stamps (rendered from scripts/api-surface.data.mjs — the file `pnpm check:api` gates),
// and the agent-publishing endpoints (/llms.txt + /llms-full.txt from public/).
test.describe("docs content systems", () => {
  test("/docs renders the map with every sidebar group, in order", async ({ page }) => {
    await page.goto("/docs");
    const groups = DOCS_NAV.map((g) => ({
      ...g,
      items: g.items.filter((i) => i.ready),
    })).filter((g) => g.items.length > 0);

    // group cards mirror the nav tree exactly — titles, order, and item count
    await expect(page.locator("[data-map] .map-title")).toHaveText(groups.map((g) => g.title));
    const hrefs = await page.$$eval("[data-map] .map-list a", (as) =>
      as.map((a) => a.getAttribute("href")),
    );
    expect(hrefs).toEqual(groups.flatMap((g) => g.items.map((i) => i.href)));

    // the map cards are bodies — the index demonstrates the system it indexes
    expect(await page.locator('[data-map] .map-card[data-body][data-feedback][data-hot]').count()).toBe(
      groups.length,
    );
  });

  test("/docs renders the examples section — the full twelve-page roster", async ({ page }) => {
    await page.goto("/docs");
    await expect(page.locator("[data-examples] .ex-name")).toHaveText(
      INVISIBLE_FIELDS.map((f) => f.name),
    );
    const hrefs = await page.$$eval("[data-examples] a.ex-item", (as) =>
      as.map((a) => a.getAttribute("href")),
    );
    expect(hrefs).toEqual(INVISIBLE_FIELDS.map((f) => f.href));
  });

  test("/docs carries the for-agents row with both endpoints", async ({ page }) => {
    await page.goto("/docs");
    const row = page.locator("[data-for-agents]");
    await expect(row.locator('a[href="/llms.txt"]')).toBeVisible();
    await expect(row.locator('a[href="/llms-full.txt"]')).toBeVisible();
  });

  test("API provenance stamps on /docs/api/handle match the freeze data", async ({ page }) => {
    await page.goto("/docs/api/handle");
    // createField (the entry point in the lede) is frozen in @fundamental-engine/core
    const frozen = page.locator('.docs-hero .api-stamp[data-status="frozen"]');
    await expect(frozen).toHaveText("frozen · @fundamental-engine/core");
    // scrollV() is explicitly experimental in scripts/api-surface.data.mjs
    const scrollRow = page
      .locator(".api-row", { has: page.locator("code", { hasText: "scrollV()" }) })
      .first();
    await expect(scrollRow.locator('.api-stamp[data-status="experimental"]')).toHaveText(
      "experimental",
    );
    // and a frozen method like scan() carries NO per-method chip (the handle shape is unfrozen,
    // but scan is not an EXPERIMENTAL item — the stamp must not invent a status)
    const scanRow = page
      .locator(".api-row", { has: page.locator("code", { hasText: "scan()" }) })
      .first();
    expect(await scanRow.locator(".api-stamp").count()).toBe(0);
  });

  test("/llms.txt and /llms-full.txt serve from the preview server", async ({ page }) => {
    const llms = await page.request.get("/llms.txt");
    expect(llms.status()).toBe(200);
    const text = await llms.text();
    expect(text.startsWith("# Fundamental")).toBe(true);
    expect(text).toContain("## Docs");
    expect(text).toContain("## Examples");

    const full = await page.request.get("/llms-full.txt");
    expect(full.status()).toBe(200);
    const fullText = await full.text();
    // a canon heading survives the concatenation
    expect(fullText).toContain("# Fundamental Invisible Fields");
  });

  test("/docs/concepts carries a SeeItLive box into the example family", async ({ page }) => {
    await page.goto("/docs/concepts");
    const box = page.locator(".see-it-live a");
    await expect(box).toHaveAttribute("href", "/evidence");
    await expect(box).toContainText("Evidence");
  });
});
