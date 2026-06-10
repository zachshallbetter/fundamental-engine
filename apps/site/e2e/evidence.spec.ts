import { test, expect } from "./fixtures";

// /evidence — the Evidence Field. Two topics of 14 findings each; the active topic shows
// the first 8 and defers the rest behind the scroll-gated accretion reveal.
test.describe("/evidence", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/evidence");
  });

  test("the active topic shows exactly 8 findings; the rest are deferred and hidden", async ({
    page,
  }) => {
    const activeTopic = page.locator("section[data-ev-topic]:not([hidden])");
    await expect(activeTopic).toHaveCount(1);
    await expect(activeTopic.locator(".ev-finding:not([hidden])")).toHaveCount(8);
    // the remaining findings of the topic are deferred — present but hidden
    await expect(activeTopic.locator(".ev-finding[data-ev-deferred][hidden]")).toHaveCount(6);
  });

  test("the sidebar lists all 12 invisible-field examples with Evidence as the current page", async ({
    page,
  }) => {
    const links = page.locator(".ev-side-list a");
    await expect(links).toHaveCount(12);
    const current = page.locator('.ev-side-list a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current.locator("b")).toHaveText("Evidence");
  });

  test("toggling the Field switch collapses the page to a plain list (data-field='off')", async ({
    page,
  }) => {
    const main = page.locator("main.ev-page");
    await expect(main).toHaveAttribute("data-field", "on");
    await page.locator("[data-ev-field]").click();
    await expect(main).toHaveAttribute("data-field", "off");
    await expect(page.locator("[data-ev-field]")).toHaveAttribute("aria-pressed", "false");
  });

  test("findings with citation-edge relationships read --field-coherence 1.000; one without reads 0.000", async ({
    page,
  }) => {
    const visible = "section[data-ev-topic]:not([hidden]) .ev-finding:not([hidden])";
    const related = page.locator(`${visible}:has(span[data-field-relation])`).first();
    const unrelated = page.locator(`${visible}:not(:has(span[data-field-relation]))`).first();
    await expect(related).toBeVisible();
    await expect(unrelated).toBeVisible();
    // the platform's metric pipeline writes the coherence metric back as an inline style
    // custom property each frame — resolved supports-edges drive it to exactly 1.000.
    await expect
      .poll(() => related.evaluate((el) => el.style.getPropertyValue("--field-coherence")), {
        timeout: 15_000,
      })
      .toBe("1.000");
    await expect
      .poll(() => unrelated.evaluate((el) => el.style.getPropertyValue("--field-coherence")), {
        timeout: 15_000,
      })
      .toBe("0.000");
  });
});
