import { test, expect } from "./fixtures";

/**
 * Viewport gating for CONTAINED fields (#672 lane S2, Field Surfaces program §6.1 C-4).
 *
 * The unit tests pin the host contract — `hidden()` and the `onVisibility` subscription. This one
 * pins the thing that contract exists for, in a real browser: a card-scoped field must actually stop
 * doing work when its box scrolls out of view, and start again when it comes back.
 *
 * Frames are counted through the feedback sink: it writes `--d` onto its bodies' `style` every frame,
 * so style mutations are frames. Measured on `main` before the gate: 13 writes per 1.2s while
 * off-screen. With it: 0.
 */
test("a contained field runs in view, stops when scrolled away, and resumes when it returns", async ({ page }) => {
  await page.goto("/ai-evidence");
  await page.waitForTimeout(4000); // the contained field boots and seeds

  const boundary = "[data-field-boundary]";
  expect(await page.locator(boundary).count(), "the page really does build a contained field").toBeGreaterThan(0);

  await page.evaluate((sel) => {
    const box = document.querySelector(sel)!;
    (window as any).__frames = 0;
    new MutationObserver((ms) => { (window as any).__frames += ms.length; })
      .observe(box, { attributes: true, attributeFilter: ["style"], subtree: true });
  }, boundary);

  const framesOver = async (ms: number): Promise<number> => {
    await page.evaluate(() => ((window as any).__frames = 0));
    await page.waitForTimeout(ms);
    return page.evaluate(() => (window as any).__frames as number);
  };
  const settle = 1500; // IO delivery + the engine cancelling / re-arming its rAF
  const scrollTo = async (where: "box" | "top") => {
    await page.evaluate(
      ([sel, w]) => (w === "box"
        ? (document.querySelector(sel as string) as HTMLElement).scrollIntoView()
        : window.scrollTo(0, 0)),
      [boundary, where] as const,
    );
    await page.waitForTimeout(settle);
  };

  await scrollTo("box");
  const inView = await framesOver(1200);
  await scrollTo("top");
  const away = await framesOver(1200);
  await scrollTo("box");
  const back = await framesOver(1200);

  expect(inView, `runs while its box is in view (${inView} frames/1.2s)`).toBeGreaterThan(0);
  expect(away, `stops ENTIRELY once the box is off-screen (got ${away} frames/1.2s)`).toBe(0);
  expect(back, `and comes back when the box returns (${back} frames/1.2s)`).toBeGreaterThan(0);
});
