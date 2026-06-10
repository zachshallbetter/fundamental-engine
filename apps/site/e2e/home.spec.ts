import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

// The live manual, on BOTH of its homepages: / (the grown-up version) and /eli5 (the plain-language
// one). The two pages share the manual shell — the same <field-root>, HomeRuntime,
// StageFieldOverlay, and NaturalFieldsSection — so the same invariants are pinned over both routes.
// Pins the behaviors the home QA audit verified (and the two bugs it fixed): the engine boots and
// seeds, every chip-bearing stage gets its traced field-line canvas (preset compositions included),
// the install chip copies, body chips drag with a real pointer, agitate fires a shock ring, the
// natural-field picker drives the overlay surface while in view and releases it on leave, the
// accretion vessel genuinely fills (--load is engine-written — the data-feedback regression), and
// the atom inspector opens on dwell+click. Sections one page lacks skip by *checking the DOM*, not
// by hardcoding a route list — if /eli5 grows an install chip tomorrow, it gets covered for free.

/** Skip the current test when the page doesn't render the section under test. */
async function skipUnless(page: Page, selector: string, what: string) {
  test.skip((await page.locator(selector).count()) === 0, `${what} — not on this page`);
}

for (const route of ["/", "/eli5"] as const) {
  test.describe(`${route} (the live manual)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(route);
    });

    test("boots clean: engine runs, every chip-bearing stage is traced, no errors", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      // the persisted engine simulates with a real particle pool
      await expect
        .poll(async () => page.evaluate(() => (document.querySelector("field-root") as any)?.particleCount?.() ?? 0))
        .toBeGreaterThan(50);
      // Every demo stage with a live chip gets a traced field-line canvas — the preset
      // compositions (blackhole, galaxy, …) included; every engine token has a probe config,
      // no exceptions. Deriving the expected set from the DOM (instead of a >=N threshold)
      // is the point: one silently missing canvas fails the count, which is how eight broken
      // stages once hid for months.
      // runs IN the page (Playwright serializes it): the chip stages that are missing
      // their canvas (or holding more than one), named by their stage label
      const untracedStages = () =>
        [...document.querySelectorAll(".stage")]
          .filter((s) => s.querySelector("[data-body], [data-preset]"))
          .filter((s) => s.querySelectorAll("canvas.stage-field").length !== 1)
          .map((s) => s.querySelector(".stage-label")?.textContent?.trim() ?? "unlabeled stage");
      expect(await page.locator(".stage:has([data-body]), .stage:has([data-preset])").count()).toBeGreaterThan(0);
      // painting is time-sliced (it yields between stages), so the canvases land progressively
      await expect
        .poll(async () => page.evaluate(untracedStages), { timeout: 20000 })
        .toEqual([]);
      expect(errors).toEqual([]);
    });

    test("the install chip copies the command", async ({ page }) => {
      await skipUnless(page, "[data-copy]", "install chip");
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
      await skipUnless(page, "[data-drag][data-body]", "draggable body chip");
      const chip = page.locator("[data-drag][data-body]").first();
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
      await skipUnless(page, "[data-agitate]", "agitate button");
      const btn = page.locator("[data-agitate]").first();
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await expect(page.locator(".shock")).toHaveCount(1);
    });

    test("the natural-field picker drives the overlay while in view and releases on leave", async ({
      page,
    }) => {
      await skipUnless(page, "[data-forcepick]", "natural-field picker");
      const picker = page.locator("[data-forcepick]");
      await picker.scrollIntoViewIfNeeded();
      // in view → the source body arms
      await expect
        .poll(async () =>
          page.evaluate(() => document.querySelector("[data-forcesource]")?.getAttribute("data-body")),
        )
        .not.toBeNull();
      // pick gravity → the overlay surface (streamlines) genuinely paints. The overlay canvas
      // is created by <field-root>'s deferred boot (Base.astro idle boot — a plain setTimeout
      // under WebKit), so it may not exist on the first poll iterations: report -1 until it
      // does rather than crashing the poll (a thrown evaluate aborts expect.poll for good).
      // The assertion still demands genuinely painted pixels within the window.
      await page.locator('.force-card[data-token="gravity"]').click();
      await expect
        .poll(
          async () =>
            page.evaluate(() => {
              const cvs = [...document.querySelectorAll<HTMLCanvasElement>("body > canvas")].pop();
              if (!cvs || cvs.width === 0 || cvs.height === 0) return -1; // not booted yet
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
      // accretion is simulation-time-bound: under full-suite CPU contention the engine's rAF
      // slows and capture takes longer in WALL time. Pacing, not weakening — the assertion is
      // unchanged; the poll just gets the time the physics actually needs on a loaded machine.
      test.slow();
      await skipUnless(page, "#bim-core", "accretion vessel");
      const core = page.locator("#bim-core");
      await expect(core).toHaveAttribute("data-feedback", "");
      await core.scrollIntoViewIfNeeded();
      await expect
        .poll(async () => core.evaluate((el) => parseFloat((el as HTMLElement).style.getPropertyValue("--load")) || 0), {
          timeout: 30000,
        })
        .toBeGreaterThan(0);
      // and the vessel's own meter mirrors it
      await expect
        .poll(async () =>
          page.evaluate(() =>
            parseFloat(document.querySelector<HTMLElement>(".stage:has(#bim-core) .meter i")?.style.width ?? "0"),
          ),
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
      await skipUnless(page, '.form-pill[data-form="wells"]', "formation pills");
      const pill = page.locator('.form-pill[data-form="wells"]');
      await pill.scrollIntoViewIfNeeded();
      await pill.click();
      await expect(page.locator("#form-name")).toHaveText("wells");
    });
  });
}
