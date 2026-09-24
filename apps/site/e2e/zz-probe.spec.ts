import { test, expect } from "./fixtures";

/**
 * End-to-end proof of the gate in a real browser. The contained field's feedback sink writes `--d`
 * onto its bodies' style attribute every frame, so counting style mutations counts frames: in view
 * the field runs, scrolled away it must stop entirely, scrolled back it must resume.
 */
test("a contained field stops when scrolled away and resumes when it returns", async ({ page }) => {
  await page.goto("/ai-evidence");
  await page.waitForTimeout(4000);

  await page.evaluate(() => {
    const box = document.querySelector("[data-field-boundary]")!;
    (window as any).__n = 0;
    (window as any).__mo = new MutationObserver((ms) => { (window as any).__n += ms.length; });
    (window as any).__mo.observe(box, { attributes: true, attributeFilter: ["style"], subtree: true });
  });
  const sample = async (): Promise<number> => {
    await page.evaluate(() => ((window as any).__n = 0));
    await page.waitForTimeout(1200);
    return page.evaluate(() => (window as any).__n as number);
  };

  const inView = await sample();
  console.log(`[gate] in view          : ${inView} style writes / 1.2s`);

  await page.evaluate(() => {
    const box = document.querySelector("[data-field-boundary]")! as HTMLElement;
    box.scrollIntoView();
    window.scrollBy(0, -4000); // far above it — well outside the 20% margin
  });
  await page.waitForTimeout(1500); // let IO fire and the loop cancel
  const away = await sample();
  console.log(`[gate] scrolled away    : ${away} style writes / 1.2s`);

  await page.evaluate(() => (document.querySelector("[data-field-boundary]") as HTMLElement).scrollIntoView());
  await page.waitForTimeout(1500);
  const back = await sample();
  console.log(`[gate] scrolled back    : ${back} style writes / 1.2s`);

  expect(inView, "the field runs while its box is in view").toBeGreaterThan(0);
  expect(away, "and stops entirely once the box is off-screen").toBe(0);
  expect(back, "and comes back when the box returns").toBeGreaterThan(0);
});
