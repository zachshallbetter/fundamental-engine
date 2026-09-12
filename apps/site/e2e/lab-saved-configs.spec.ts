import { test, expect } from "./fixtures";

// /lab — saved configs (#694): the Tune panel saves the current force + overrides with a
// good / bad / edge tag and a note, lists them, loads one back, deletes it, and keeps the
// list across a reload under `fui:lab-configs` (lib/persisted.ts). Storage is cleared FIRST,
// so the run starts from an empty list and the final reload keeps what the run stored.
test.describe("/lab — saved configs", () => {
  test("save with tag + note, load restores the overrides, persists across reload, delete", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto("/lab");
    await page.evaluate(() => localStorage.removeItem("fui:lab-configs"));
    await page.reload();

    // boot: the tabs are `hidden` until selectForce('attract') runs on astro:page-load
    const openTune = async () => {
      await expect(page.locator("#tabs")).toBeVisible();
      await page.locator('#tabs button[data-tab="tune"]').click();
      await expect(page.locator("#tunePanel")).toBeVisible();
    };
    await openTune();
    const rows = page.locator("#savedList li[data-cfg-id]");
    await expect(rows).toHaveCount(0);
    await expect(page.locator("#savedList .saved-empty")).toBeVisible();

    // tune: the "strong" quick-pick band on strength → the preset reads custom
    const strengthInput = page.locator('#params input.num[data-param="strength"]');
    const defaultStrength = await strengthInput.inputValue();
    await page.locator('#params .band[data-band-key="strength"]', { hasText: /^strong$/ }).click();
    await expect(page.locator("#preset")).toHaveValue("custom");
    const strong = await strengthInput.inputValue();
    expect(strong).not.toBe(defaultStrength);

    // save it tagged bad with a note
    await page.locator('#cfgTags [data-cfg-tag="bad"]').click();
    await expect(page.locator('#cfgTags [data-cfg-tag="bad"]')).toHaveAttribute("aria-checked", "true");
    await page.locator("#cfgNote").fill("overshoots at 2.2x");
    await page.locator("#cfgSave").click();

    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute("data-cfg-tag", "bad");
    await expect(rows.first()).toHaveAttribute("data-cfg-force", "attract");
    await expect(rows.first()).toContainText("overshoots at 2.2x");
    await expect(rows.first()).toContainText(`strength=${strong}`);
    await expect(page.locator("#cfgNote")).toHaveValue("");
    await expect(page.locator("#savedCount")).toHaveText("1");

    // back to defaults, then load: the saved override comes back and the preset reads custom
    await page.locator("#resetParams").click();
    await expect(page.locator("#preset")).toHaveValue("default");
    await expect(strengthInput).toHaveValue(defaultStrength);
    await rows.first().locator("[data-cfg-load]").click();
    await expect(page.locator("#preset")).toHaveValue("custom");
    await expect(strengthInput).toHaveValue(strong);

    // persistence: the row survives a reload, and the stored shape is the picked overrides only
    await page.reload();
    await openTune();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("overshoots at 2.2x");
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("fui:lab-configs") ?? "null"));
    expect(stored.v).toBe(1);
    expect(stored.items).toHaveLength(1);
    expect(stored.items[0]).toMatchObject({ tag: "bad", force: "attract", note: "overshoots at 2.2x" });
    expect(stored.items[0].overrides).toEqual({ strength: parseFloat(strong) });
    expect(stored.items[0].overrides).not.toHaveProperty("frames");

    // delete → empty state
    await rows.first().locator("[data-cfg-del]").click();
    await expect(rows).toHaveCount(0);
    await expect(page.locator("#savedList .saved-empty")).toBeVisible();
    await expect(page.locator("#savedCount")).toHaveText("");
    expect(errors).toEqual([]);
  });
});
