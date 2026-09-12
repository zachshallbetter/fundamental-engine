import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

// Anchored UI (#680): a tooltip tethered to a MOVING body via CSS Anchor Positioning. The docs
// authoring page carries a live stage — four data-move="layout" chips stacked at one point that the
// page's persisted field spreads apart — and a tip whose `position-anchor` names the first chip
// (`--field-body-au-chip-design`, written by `anchorBodies()` from @fundamental-engine/dom).
//
// The claim under test is the one the ticket depends on and that step 0 verified empirically: the
// engine moves a mover by writing `transform: translate(…)` and `anchor()` resolves against the
// anchor's TRANSFORMED box, so the tip follows the chip with zero per-frame engine work. Where the
// browser lacks anchor positioning (`data-anchored="false"`) the helper writes nothing and the tip
// degrades to a static position beside the slot — asserted rather than assumed.

const STAGE = "[data-au-anchor]";
const CHIP = "#au-chip-design";
const TIP = "[data-au-tip]";

async function bootAuthoring(page: Page): Promise<void> {
  await page.goto("/docs/authoring");
  // the persisted engine must be up (same readiness gate lint.spec / perf.spec use) — it scans the
  // page's [data-move] chips and starts moving them.
  await expect
    .poll(
      async () =>
        page.evaluate(() => (document.querySelector("field-root") as { particleCount?: () => number } | null)?.particleCount?.() ?? 0),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
  // the demo script reports its feature detection once it has run
  await expect(page.locator(STAGE)).toHaveAttribute("data-anchored", /^(true|false)$/, { timeout: 10_000 });
}

/** viewport rects of the chip and the tip. */
async function rects(page: Page): Promise<{ chip: DOMRect; tip: DOMRect }> {
  return page.evaluate(
    ([c, t]) => ({
      chip: document.querySelector(c)!.getBoundingClientRect().toJSON() as DOMRect,
      tip: document.querySelector(t)!.getBoundingClientRect().toJSON() as DOMRect,
    }),
    [CHIP, TIP] as const,
  );
}

/** the chip's inline translate, as the engine wrote it (`translate(Xpx, Ypx)`), or null before the first write. */
async function chipTranslate(page: Page): Promise<{ x: number; y: number } | null> {
  return page.evaluate((c) => {
    const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec((document.querySelector(c) as HTMLElement).style.transform);
    return m ? { x: parseFloat(m[1]!), y: parseFloat(m[2]!) } : null;
  }, CHIP);
}

/** the tip hangs just below the chip's bottom-left corner (top: anchor(bottom) + 0.35rem; left: anchor(left)). */
function expectTethered(r: { chip: DOMRect; tip: DOMRect }, label: string): void {
  expect(Math.abs(r.tip.left - r.chip.left), `${label}: tip.left tracks chip.left`).toBeLessThan(1.5);
  const gap = r.tip.top - r.chip.bottom;
  expect(gap, `${label}: tip sits just below the chip (0.35rem gap)`).toBeGreaterThanOrEqual(0);
  expect(gap, `${label}: tip sits just below the chip (0.35rem gap)`).toBeLessThan(12);
}

test.describe("anchored UI — a tooltip tethered to a moving body (#680)", () => {
  test("the helper feature-detects, names the movers, and the tip follows the chip's transform", async ({ page }, testInfo) => {
    await bootAuthoring(page);
    const supported = (await page.locator(STAGE).getAttribute("data-anchored")) === "true";
    testInfo.annotations.push({ type: "anchor-positioning", description: supported ? "supported" : "unsupported (static fallback)" });

    if (!supported) {
      // no anchor positioning: the helper wrote NOTHING (no anchor-name) and the tip is the static
      // fallback — visible, inside the stage. Nothing to follow; the degradation is silent.
      const wrote = await page.$$eval(`${STAGE} [data-move]`, (els) => els.some((el) => (el as HTMLElement).style.getPropertyValue("anchor-name") !== ""));
      expect(wrote, "unsupported ⇒ no anchor-name written").toBe(false);
      await expect(page.locator(TIP)).toBeVisible();
      return;
    }

    // supported: every mover on the stage is named, the tip's anchor is the first chip
    const names = await page.$$eval(`${STAGE} [data-move]`, (els) => els.map((el) => (el as HTMLElement).style.getPropertyValue("anchor-name")));
    expect(names[0]).toBe("--field-body-au-chip-design");
    expect(names.every((n) => n.startsWith("--field-body-")), "every mover is named").toBe(true);
    expect(new Set(names).size, "names are unique").toBe(names.length);

    // the field moves the chip: the engine's inline translate becomes non-zero (four chips stacked at
    // one point repel each other under data-move="layout")
    await expect
      .poll(async () => {
        const t = await chipTranslate(page);
        return t ? Math.hypot(t.x, t.y) : 0;
      }, { timeout: 20_000, message: "the layout mover leaves its slot" })
      .toBeGreaterThan(2);

    // the tip tracks the chip's TRANSFORMED box — sampled twice, a beat apart, so a lucky first frame
    // can't pass alone; the second sample must also be tethered wherever the chip is by then.
    const first = await rects(page);
    expectTethered(first, "sample 1");
    await page.waitForTimeout(400);
    const second = await rects(page);
    expectTethered(second, "sample 2");

    // and the chip is genuinely away from its layout slot (the tip is following a transform, not a
    // static box): the stage centre is the chips' shared slot; the chip's centre is off it.
    const slot = await page.evaluate((s) => {
      const r = document.querySelector(s)!.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, STAGE);
    const chipCentre = { x: second.chip.left + second.chip.width / 2, y: second.chip.top + second.chip.height / 2 };
    expect(Math.hypot(chipCentre.x - slot.x, chipCentre.y - slot.y), "the chip has left the stacked slot").toBeGreaterThan(2);
  });

  test("reduced motion: the tether still resolves — the tip sits on the chip with the engine frozen (meaning survives)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await bootAuthoring(page);
    const supported = (await page.locator(STAGE).getAttribute("data-anchored")) === "true";
    await expect(page.locator(TIP)).toBeVisible();
    if (!supported) return;
    // whatever the engine did (it freezes the integrator under reduced motion), the tip is where the
    // chip is — the relationship "this tip belongs to this chip" is static, not motion-encoded.
    await page.waitForTimeout(300);
    expectTethered(await rects(page), "reduced motion");
  });
});
