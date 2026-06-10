import { test, expect } from "./fixtures";

// /docs — the documentation surface. Pins what the docs QA audit verified: the TOC builds
// and its scroll-spy tracks, the sidebar's destinations all resolve, CodeTabs switch every
// instance together (with the shareable ?code= state) and copy exactly once, the install
// chips copy, and the showcase burst stage genuinely reaches the engine.
test.describe("/docs", () => {
  test("tutorial: the TOC builds from the content and the scroll-spy tracks", async ({ page }) => {
    await page.goto("/docs/tutorial");
    const links = page.locator("#docsToc a");
    expect(await links.count()).toBeGreaterThan(3);
    const first = (await links.first().textContent())!;
    // jump deep into the article — the active link must move off the first heading
    await page.locator(".docs-content h2").nth(3).scrollIntoViewIfNeeded();
    await expect
      .poll(async () => page.locator("#docsToc a.active").textContent())
      .not.toBe(first);
  });

  test("every sidebar destination resolves", async ({ page }) => {
    await page.goto("/docs/tutorial");
    const hrefs: string[] = await page.$$eval("#docsSide a", (as) =>
      [...new Set(as.map((a) => a.getAttribute("href")!))],
    );
    expect(hrefs.length).toBeGreaterThan(10);
    const statuses = await page.evaluate(
      async (urls) =>
        Promise.all(urls.map(async (u) => ({ u, s: (await fetch(u)).status }))),
      hrefs,
    );
    expect(statuses.filter((r) => r.s !== 200)).toEqual([]);
  });

  test("CodeTabs: picking a framework switches every instance and copies once", async ({
    page,
  }) => {
    await page.goto("/docs/tutorial");
    await page.evaluate(() => localStorage.removeItem("fieldui-code-tab"));
    const reactTab = page.locator(".ct-tab", { hasText: "React" }).first();
    await reactTab.scrollIntoViewIfNeeded();
    await reactTab.click();
    // every multi-variant group on the page follows
    const groups = page.locator(".code-tabs:has(.ct-tab)");
    const n = await groups.count();
    for (let i = 0; i < n; i++) {
      await expect(groups.nth(i).locator('.ct-tab[aria-selected="true"]')).toHaveText(/React/i);
    }
    // and the choice is shareable
    await expect(page).toHaveURL(/code=react/);
    // copy fires exactly once (the consolidated component handler — no double layout handler)
    const writes = await page.evaluate(async () => {
      let count = 0;
      Object.defineProperty(navigator.clipboard, "writeText", {
        value: () => {
          count++;
          return Promise.resolve(); // stub: WebKit has no grantable clipboard permission
        },
        configurable: true,
      });
      document.querySelector<HTMLElement>(".ct-copy")?.click();
      await new Promise((r) => setTimeout(r, 200));
      return count;
    });
    expect(writes).toBe(1);
  });

  test("the install chip on /docs copies with feedback", async ({ page }) => {
    await page.goto("/docs");
    await page.evaluate(() => {
      Object.defineProperty(navigator.clipboard, "writeText", {
        value: () => Promise.resolve(),
        configurable: true,
      });
    });
    const chip = page.locator("[data-copy]").first();
    await chip.scrollIntoViewIfNeeded();
    await chip.click();
    await expect(chip).toHaveClass(/copied/);
  });

  test("the showcase burst stage reaches the engine", async ({ page }) => {
    await page.goto("/docs/showcase");
    // instrument the persisted field's burst before clicking
    await page.evaluate(() => {
      const fr = document.querySelector("field-root") as any;
      (window as any).__bursts = 0;
      const orig = fr.burst?.bind(fr);
      fr.burst = (...a: unknown[]) => {
        (window as any).__bursts++;
        return orig?.(...a);
      };
    });
    const stage = page.locator("[data-field-burst]").first();
    await stage.scrollIntoViewIfNeeded();
    await stage.click();
    await expect.poll(async () => page.evaluate(() => (window as any).__bursts)).toBeGreaterThan(0);
  });
});
