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

// ── per-surface coverage (board #24 "a11y/Testing: per-surface 'meaning survives motion removal'") ──
//
// Scope, stated honestly: WCAG 2.2 SC 2.3.3 (Animation from Interactions) is Level AAA and the
// prefers-reduced-motion technique (C39) is the good-practice tier above the AA baseline. Honouring it
// is cheap; the STRONGER claim — that meaning encoded in field state has a static equivalent on every
// surface — is only true surface by surface, so each surface below asserts its own static channel with
// the engine frozen. A surface whose ranking/weight/relationship only existed as motion would fail.

const weightOf = (page: import("@playwright/test").Page, selector: string): Promise<number[]> =>
  page.$$eval(selector, (els) => els.map((el) => parseFloat(getComputedStyle(el).fontWeight) || 0));

const opacityOf = (page: import("@playwright/test").Page, selector: string): Promise<number[]> =>
  page.$$eval(selector, (els) => els.map((el) => parseFloat(getComputedStyle(el).opacity) || 0));

const isStrictlyDescending = (xs: number[]): boolean => xs.every((x, i) => i === 0 || xs[i - 1]! > x);

test.describe("reduced motion removes motion, not meaning — per surface", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("home #proof (lp-apply): the urgency ranking survives as type weight and bar opacity from the authored --u0", async ({
    page,
  }) => {
    await page.goto("/");
    const asks = page.locator(".lp-ask");
    await expect(asks).toHaveCount(4);
    // the authored lane is inline: --u0 descends 1 → 0.72 → 0.46 → 0.24. Under reduced motion the
    // landing CSS pins the displayed weight --u to --u0 (the live --d never registers), so the
    // ranking must be readable from computed type weight + bar opacity alone — no motion involved.
    const u0 = await asks.evaluateAll((els) =>
      els.map((el) => parseFloat((el as HTMLElement).style.getPropertyValue("--u0")) || 0),
    );
    expect(isStrictlyDescending(u0), "the authored urgency lane is a ranking").toBe(true);
    const weights = await weightOf(page, ".lp-ask .lp-title");
    expect(weights).toHaveLength(4);
    expect(isStrictlyDescending(weights), `title weight follows urgency: ${weights.join(" > ")}`).toBe(true);
    const bars = await opacityOf(page, ".lp-ask .lp-bar");
    expect(isStrictlyDescending(bars), `bar opacity follows urgency: ${bars.join(" > ")}`).toBe(true);
    // (the engine keeps writing --d under reduced motion — feedback never stops, only the integrator
    // does (#1012) — which is why the CSS pins the DISPLAYED weight to --u0 rather than to --d.)
  });

  test("home lp-ai (the evidence wedge): claim confidence survives as opacity, weight, and the printed value", async ({
    page,
  }) => {
    await page.goto("/");
    const claims = page.locator(".lp-ai .claim");
    await expect(claims).toHaveCount(4);
    // authored confidence is inline (--conf); the tier class (claim-hi / -mid / -lo) and the printed
    // <i> value are static. Both the computed opacity and the type weight must track --conf.
    const conf = await claims.evaluateAll((els) =>
      els.map((el) => parseFloat((el as HTMLElement).style.getPropertyValue("--conf")) || 0),
    );
    expect(isStrictlyDescending(conf)).toBe(true);
    const opacity = await opacityOf(page, ".lp-ai .claim");
    expect(isStrictlyDescending(opacity), `claim opacity follows confidence: ${opacity.join(" > ")}`).toBe(true);
    const weights = await weightOf(page, ".lp-ai .claim b");
    expect(isStrictlyDescending(weights), `claim weight follows confidence: ${weights.join(" > ")}`).toBe(true);
    const printed = await claims.locator("i").allTextContents();
    expect(printed.map(Number)).toEqual(conf);
  });

  test("home lp-hosts: the field only tints — the host list is plain, complete text with the engine frozen", async ({
    page,
  }) => {
    await page.goto("/");
    const items = page.locator(".lp-hosts .model li");
    const n = await items.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      await expect(items.nth(i)).toBeVisible();
      expect((await items.nth(i).innerText()).trim().length).toBeGreaterThan(0);
    }
  });

  test("/evidence/library: the listen ladder (--bar) is authored inline and still descends", async ({ page }) => {
    await page.goto("/evidence/library");
    const bars = await page
      .locator(".lb-row")
      .evaluateAll((rows) => rows.map((r) => parseFloat((r as HTMLElement).style.getPropertyValue("--bar")) || 0));
    expect(bars.length).toBeGreaterThanOrEqual(3);
    expect(bars[0]).toBeGreaterThanOrEqual(bars[1]!);
    expect(bars[1]).toBeGreaterThanOrEqual(bars[2]!);
    expect(bars[0]! - bars[bars.length - 1]!, "the ladder is a ranking, not a flat bar").toBeGreaterThan(0.05);
  });

  test("/evidence/memory: retention (--w) is pure data math per card — present and differentiated with the engine frozen", async ({
    page,
  }) => {
    await page.goto("/evidence/memory");
    await page.evaluate(() => {
      localStorage.removeItem("fui:memory-reviews");
      localStorage.removeItem("fui:memory-day");
    });
    await page.reload();
    const cards = page.locator(".mx-card");
    expect(await cards.count()).toBeGreaterThan(0);
    await expect
      .poll(
        () =>
          cards.evaluateAll((els) =>
            els.filter((el) => parseFloat((el as HTMLElement).style.getPropertyValue("--w")) > 0).length,
          ),
        { timeout: 10_000 },
      )
      .toBe(await cards.count());
    const ws = await cards.evaluateAll((els) =>
      els.map((el) => parseFloat((el as HTMLElement).style.getPropertyValue("--w")) || 0),
    );
    expect(Math.max(...ws) - Math.min(...ws), "retention differs across anchors — a real curve, not a flat fill").toBeGreaterThan(0.05);
  });
});
