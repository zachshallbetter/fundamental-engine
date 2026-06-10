import { test, expect } from "./fixtures";

// / — the live manual. Pins the behaviors the home QA audit verified (and the two bugs it
// fixed): the engine boots and seeds, every stage gets its traced field-line canvas
// (including the preset compositions), the install chip copies, body chips drag with a real
// pointer, agitate fires a shock ring, the natural-field picker drives the overlay surface
// while in view and releases it on leave, the accretion vessel genuinely fills (--load is
// engine-written — the data-feedback regression), and the atom inspector opens on dwell+click.
test.describe("/ (home)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("boots clean: engine runs, stages are traced (presets included), no errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    // the persisted engine simulates with a real particle pool
    await expect
      .poll(async () => page.evaluate(() => (document.querySelector("field-root") as any)?.particleCount?.() ?? 0))
      .toBeGreaterThan(50);
    // every demo stage gets a traced field-line canvas — the 8 preset compositions too
    expect(await page.locator("canvas.stage-field").count()).toBeGreaterThanOrEqual(50);
    for (const preset of ["blackhole", "whitehole", "star", "quasar", "galaxy", "nebula", "tornado", "fountain"]) {
      const stage = page.locator(`.stage:has([data-preset="${preset}"])`);
      await expect(stage.locator("canvas.stage-field"), `${preset} stage is traced`).toHaveCount(1);
    }
    expect(errors).toEqual([]);
  });

  test("the install chip copies the command", async ({ page }) => {
    // stub the clipboard (WebKit has no grantable clipboard permission) — the page's
    // .copied feedback only fires after writeText resolves, which is what we pin
    await page.evaluate(() => {
      Object.defineProperty(navigator.clipboard, "writeText", {
        value: () => Promise.resolve(),
        configurable: true,
      });
    });
    const chip = page.locator("[data-copy]").first();
    await chip.click();
    await expect(chip).toHaveClass(/copied/);
  });

  test("a body chip drags with a real pointer and moves with arrow keys", async ({ page }) => {
    const chip = page.locator("#c-attract");
    await chip.scrollIntoViewIfNeeded();
    const before = await chip.evaluate((el) => (el as HTMLElement).style.left);
    const box = (await chip.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 40, { steps: 6 });
    await page.mouse.up();
    const after = await chip.evaluate((el) => (el as HTMLElement).style.left);
    expect(after).not.toBe(before);
    // keyboard path
    await chip.focus();
    await page.keyboard.press("ArrowRight");
    const afterKey = await chip.evaluate((el) => (el as HTMLElement).style.left);
    expect(parseFloat(afterKey)).toBeGreaterThan(parseFloat(after));
  });

  test("agitate kicks the target and fires a shock ring", async ({ page }) => {
    const btn = page.locator("[data-agitate]").first();
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    await expect(page.locator(".shock")).toHaveCount(1);
  });

  test("the natural-field picker drives the overlay while in view and releases on leave", async ({
    page,
  }) => {
    const picker = page.locator("[data-forcepick]");
    await picker.scrollIntoViewIfNeeded();
    // in view → the source body arms
    await expect
      .poll(async () =>
        page.evaluate(() => document.querySelector("[data-forcesource]")?.getAttribute("data-body")),
      )
      .not.toBeNull();
    // pick gravity → the overlay surface (streamlines) genuinely paints
    await page.locator('.force-card[data-token="gravity"]').click();
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const cvs = [...document.querySelectorAll<HTMLCanvasElement>("body > canvas")].pop()!;
            const d = cvs.getContext("2d")!.getImageData(0, 0, cvs.width, cvs.height).data;
            let n = 0;
            for (let i = 3; i < d.length; i += 400) if (d[i]! > 0) n++;
            return n;
          }),
        { timeout: 8000 },
      )
      .toBeGreaterThan(5);
    // leave → the source disarms (the picker releases the page)
    await page.evaluate(() => scrollTo(0, 0));
    await expect
      .poll(async () =>
        page.evaluate(() => document.querySelector("[data-forcesource]")?.getAttribute("data-body")),
      )
      .toBeNull();
  });

  test("the accretion vessel fills — the engine writes --load back (data-feedback)", async ({
    page,
  }) => {
    const core = page.locator("#bim-core");
    await expect(core).toHaveAttribute("data-feedback", "");
    await core.scrollIntoViewIfNeeded();
    await expect
      .poll(async () => core.evaluate((el) => parseFloat((el as HTMLElement).style.getPropertyValue("--load")) || 0), {
        timeout: 10000,
      })
      .toBeGreaterThan(0);
    // and the meter mirrors it
    await expect
      .poll(async () =>
        page.evaluate(() => parseFloat(document.querySelector<HTMLElement>(".meter i")?.style.width ?? "0")),
      )
      .toBeGreaterThan(0);
  });

  test("the atom inspector: dwell focuses a seeded particle, click opens the card, × closes", async ({
    page,
  }) => {
    // find a seeded particle with the engine's own picker, then drive a real pointer to it
    const hit = await page.evaluate(async () => {
      const fr = document.querySelector("field-root") as any;
      for (let tries = 0; tries < 40; tries++) {
        for (let y = 140; y < 700; y += 60) {
          for (let x = 80; x < 900; x += 60) {
            const a = fr.atomAt?.(x, y);
            if (a) return { x, y };
          }
        }
        await new Promise((r) => setTimeout(r, 250)); // atoms seed async (cache-first)
      }
      return null;
    });
    expect(hit).not.toBeNull();
    // settle the pointer and wait for the dwell to arm (the html gets .atom-armed);
    // then click with down/up ONLY — mouse.click() emits a move first, and any move
    // releases the focus (that's the inspector's design: no tooltip chasing the cursor)
    await page.mouse.move(hit!.x, hit!.y, { steps: 2 });
    const armed = expect.poll(
      async () => page.evaluate(() => document.documentElement.classList.contains("atom-armed")),
      { timeout: 6000 },
    );
    try {
      await armed.toBe(true);
    } catch {
      await page.mouse.move(hit!.x + 1, hit!.y); // one wiggle, then the dwell re-arms
      await armed.toBe(true);
    }
    await page.mouse.down();
    await page.mouse.up();
    const card = page.locator(".atom-card");
    await expect(card).toBeVisible();
    await card.locator(".at-close").click();
    await expect(card).toBeHidden();
  });

  test("formation pills retune the whole field and the readout follows", async ({ page }) => {
    const pill = page.locator('.form-pill[data-form="wells"]');
    await pill.scrollIntoViewIfNeeded();
    await pill.click();
    await expect(page.locator("#form-name")).toHaveText("wells");
  });
});
