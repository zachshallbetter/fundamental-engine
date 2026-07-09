import { test, expect } from "./fixtures";

// "Reduced motion removes motion, not meaning" — the WCAG-2.2 SC 2.3.3 / technique-C39-aligned claim,
// verified PER SURFACE rather than asserted. Under prefers-reduced-motion the engine freezes (dt=0),
// so ambient / sim-driven motion stops (see nav.spec.ts: field-driven "wake" emphasis correctly goes
// away). The honest question this suite answers is different and stronger: for a surface whose MEANING
// (ranking / weight / relationship) is field-encoded, does that meaning still have a STATIC equivalent
// (type / ink / order) with the engine frozen — or is it lost with the motion? A surface whose meaning
// is motion-only would FAIL here. (This is the RC1 rigor-program item #5, closing the deep-research
// accessibility open question: SC 2.3.3 is AAA, and "meaning survives" must be checked, not claimed.)

const ITEMS = "[data-ix-split] .ix-item";
const BUDGET_PER_ITEM = 0.42; // the water-filling allocator pins Σ --w to N × 0.42 (see inbox.spec.ts)

const sumW = (page: import("@playwright/test").Page): Promise<number> =>
  page.$$eval(ITEMS, (els) =>
    els.reduce((s, el) => s + (parseFloat((el as HTMLElement).style.getPropertyValue("--w")) || 0), 0),
  );

test.describe("reduced motion removes motion, not meaning", () => {
  test("/evidence/inbox: the urgency ranking survives — Σ --w is conserved AND differentiated with the engine frozen", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/evidence/inbox");

    const n = await page.locator(ITEMS).count();
    expect(n).toBeGreaterThan(0);

    // (1) meaning present: the water-filling --w allocation is static (not sim-driven), so the
    // conserved attention budget still resolves with the integrator frozen.
    await expect
      .poll(async () => Math.abs((await sumW(page)) - n * BUDGET_PER_ITEM), { timeout: 10_000 })
      .toBeLessThan(0.05);

    // (2) meaning READABLE, not flattened: the asks must still be DIFFERENTIATED (a real ranking),
    // otherwise "budget conserved" could hide a uniform, meaning-less allocation.
    const spread = await page.$$eval(ITEMS, (els) => {
      const ws = els.map((el) => parseFloat((el as HTMLElement).style.getPropertyValue("--w")) || 0);
      return Math.max(...ws) - Math.min(...ws);
    });
    expect(spread, "asks must be differentiated (ranking present), not a flat allocation").toBeGreaterThan(0.05);
  });
});
