import { test, expect } from "./fixtures";

// Contour typography (#257): the Contour Sink demo — a real text sink whose generated
// glyph-outline SVG is its bound visual representation. Pins the full chain: the engine
// writes the heading's feedback channels, the platform mirrors them onto the sibling SVG
// (#360), and the rings read them. Also pins the self-hosted font serving (#257's
// prerequisite — the outlines are generated from the same face the page renders).

test.describe("/docs/contour-typography", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/docs/contour-typography");
  });

  test("the generated outline renders: three rings of real glyph path data", async ({ page }) => {
    const svg = page.locator('svg[data-field-visual-for="contour-title"]');
    await expect(svg).toHaveAttribute("aria-hidden", "true");
    await expect(svg.locator("path.ring")).toHaveCount(3);
    // real outlines, not placeholders — the committed path data is thousands of chars
    const d = await svg.locator("path.ring").first().getAttribute("d");
    expect(d!.length).toBeGreaterThan(1000);
    // the semantic source stays real text
    await expect(page.locator("#contour-title .sr-only")).toHaveText("Contour");
  });

  test("the body's state crosses to the bound visual — the mirroring chain is live", async ({ page }) => {
    // the heading is a sink body on the page field; the engine writes --d/--load to it and
    // the platform mirrors onto the SVG. Ambient matter takes a moment to gather — poll the
    // SVG's own inline style (the mirrored copy, not inheritance: it's a sibling).
    await page.locator("[data-contour-demo]").scrollIntoViewIfNeeded();
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const svg = document.querySelector<SVGElement>('svg[data-field-visual-for="contour-title"]');
            return svg ? parseFloat(svg.style.getPropertyValue("--d") || "0") : -1;
          }),
        { timeout: 15000 },
      )
      .toBeGreaterThan(0);
  });

  test("the fonts are self-hosted — no third-party font requests", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (r) => {
      if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) external.push(r.url());
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
    expect(external).toEqual([]);
    // the local face actually serves
    const res = await page.request.get("/fonts/fonts.css");
    expect(res.status()).toBe(200);
  });
});
