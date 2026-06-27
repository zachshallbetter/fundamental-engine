import { test, expect } from "./fixtures";

// The Wayfinding Field family (experimental recipes `wayfinding-field` / `wayfinding-current`) —
// the invisible-fields family applied to the site's own navigation chrome. Both run SIGNALS-ONLY
// (render: []): the engine measures + accretes, draws no canvas, and the only output is a CSS custom
// property written back onto each link. These tests pin (a) that the binding actually runs — the
// current route's --field-attention drives to its pinned 1, the rail accretes --field-memory — and
// (b) that it is pure progressive enhancement: reduced motion skips the engine and the links stay
// plain + reachable.

const attn = (el: HTMLElement) =>
  parseFloat(el.style.getPropertyValue("--field-attention")) || 0;

test.describe("site nav · Wayfinding Field (signals-only)", () => {
  test("the current destination is pinned as the well — --field-attention drives to 1", async ({
    page,
  }) => {
    await page.goto("/writings"); // SiteNav current="writings" → the Writings link is aria-current
    const current = page.locator('.sn-dest a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    // the signals-only binding writes --field-attention back onto each link each frame; the current
    // route is pinned via data-field-attention="1" in the markup, so it resolves to 1.
    await expect
      .poll(() => current.evaluate(attn), { timeout: 10_000 })
      .toBeGreaterThan(0.9);
  });

  test("at rest, the other destinations stay low (no engagement, no false glow)", async ({
    page,
  }) => {
    await page.goto("/writings");
    const current = page.locator('.sn-dest a[aria-current="page"]');
    await expect.poll(() => current.evaluate(attn), { timeout: 10_000 }).toBeGreaterThan(0.9);
    const others = page.locator('.sn-dest a:not([aria-current="page"])');
    const n = await others.count();
    expect(n).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < n; i++) expect(await others.nth(i).evaluate(attn)).toBeLessThan(0.5);
  });

  test("every destination stays inside the viewport — the field never moves layout", async ({
    page,
  }) => {
    await page.goto("/writings");
    const links = page.locator(".sn-dest a");
    const n = await links.count();
    expect(n).toBeGreaterThanOrEqual(5);
    const vp = page.viewportSize()!;
    for (let i = 0; i < n; i++) {
      const b = await links.nth(i).boundingBox();
      expect(b).not.toBeNull();
      expect(b!.x).toBeGreaterThanOrEqual(-1);
      expect(b!.x + b!.width).toBeLessThanOrEqual(vp.width + 1);
    }
  });

  test("reduced motion: the engine is skipped — links stay plain (no --field-attention)", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/writings");
    const current = page.locator('.sn-dest a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    // the markup still carries data-field-attention="1", but with the engine skipped nothing writes
    // the CSS var back — so the inline custom property is never set and the link renders plainly.
    await page.waitForTimeout(1500);
    expect(await current.evaluate((el) => el.style.getPropertyValue("--field-attention"))).toBe("");
  });
});

test.describe("home rail · Wayfinding Current (signals-only)", () => {
  test("the in-view chapter accretes --field-memory — the 'where have I been' wake", async ({
    page,
  }) => {
    await page.goto("/"); // the chapter rail is desktop-only; Desktop Chrome/Safari show it
    const active = page.locator(".chapter-rail a.active");
    await expect(active).toHaveCount(1);
    // the active rail link is marked engaged (data-field-attention="1"), so the recipe's metric
    // pipeline accretes its memory frame over frame — the engine computing the trail, not CSS.
    await expect(active).toHaveAttribute("data-field-attention", "1");
    await expect
      .poll(
        () =>
          active.evaluate((el) => parseFloat((el as HTMLElement).style.getPropertyValue("--field-memory")) || 0),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);
  });
});
