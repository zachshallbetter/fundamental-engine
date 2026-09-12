import { test, expect } from "./fixtures";
import { DOCS_NAV } from "../src/lib/docs-nav";

// The cookbook (docs-refactor Phase 5, #1000) exists to be RUNNABLE, so the gate on it is that its
// examples actually ran — not that its pages render.
//
// Two kinds of proof, matching the two kinds of example:
//   · BUILD-TIME examples (src/lib/cookbook/*.ts) execute during `astro build` and print what they
//     returned. Asserting on the printed values proves the module ran in the build that produced
//     this page — a snippet that was never executed cannot pass.
//   · LIVE demos (src/lib/cookbook/demos.ts) need a browser, so they run on their page and write a
//     status line into [data-cb-status]. Asserting that status proves the field, binding or nav
//     really booted, rather than that a <figure> is on the page.

const COOKBOOK = DOCS_NAV.find((g) => g.title === "Cookbook")!;

test.describe("cookbook · the section", () => {
  test("every cookbook route in the nav resolves", async ({ page }) => {
    await page.goto("/docs/cookbook");
    const hrefs = COOKBOOK.items.map((i) => i.href);
    expect(hrefs.length).toBeGreaterThan(5);
    const statuses = await page.evaluate(
      async (urls) => Promise.all(urls.map(async (u) => ({ u, s: (await fetch(u)).status }))),
      hrefs,
    );
    expect(statuses.filter((r) => r.s !== 200)).toEqual([]);
  });

  test("the index lists every pattern and folds the six field studies in", async ({ page }) => {
    await page.goto("/docs/cookbook");
    // one card per pattern page (the index's own roster, minus the index itself)
    await expect(page.locator(".next-grid .next-card")).toHaveCount(COOKBOOK.items.length - 1);
    // the studies are worked patterns here, each resolved against the Pattern catalog
    const studies = page.locator(".api-table .api-row");
    await expect(studies).toHaveCount(6);
    await expect(studies.first()).toContainText("Patterns:");
  });
});

test.describe("cookbook · the section", () => {
  // The docs shell measures each page's own internal references and reports honestly. A cookbook
  // that cross-links heavily (its whole job is sending readers to the reference) is exactly where a
  // rotted anchor hides, so every page in the section is held to N/N.
  for (const item of COOKBOOK.items) {
    test(`${item.label}: every internal reference resolves`, async ({ page }) => {
      await page.goto(item.href);
      const chip = page.locator("[data-docs-integrity]");
      await expect(chip).toHaveText(/references · \d+\/\d+ resolve/);
      const [, resolved, total] = (await chip.textContent())!.match(/(\d+)\/(\d+)/)!;
      expect(Number(resolved)).toBe(Number(total));
      await expect(chip).toHaveAttribute("data-state", "ok");
    });
  }
});

test.describe("cookbook · build-time examples really ran", () => {
  test("signals-first printed a live density from a field with no canvas", async ({ page }) => {
    await page.goto("/docs/cookbook/signals-first");
    const out = page.locator(".cb-out").first();
    await expect(out).toContainText("What it returned when this page was built");
    // the density row is a real measurement: non-zero, and not the literal 0
    const density = await out
      .locator(".cb-out-row", { has: page.locator("dt", { hasText: /^density$/ }) })
      .locator("dd")
      .textContent();
    expect(Number(density)).toBeGreaterThan(0);
  });

  test("performance tuning measured the 130 x density rule on a live pool", async ({ page }) => {
    await page.goto("/docs/cookbook/performance-tuning");
    const rows = page.locator(".cb-out-row");
    await expect(
      rows.filter({ has: page.locator("dt", { hasText: "particlesAtDensity1" }) }).locator("dd"),
    ).toHaveText("130");
    await expect(
      rows.filter({ has: page.locator("dt", { hasText: "particlesAtQuarter" }) }).locator("dd"),
    ).toHaveText("33");
  });

  test("reading the field printed three probes that tell the where-you-sample story", async ({
    page,
  }) => {
    await page.goto("/docs/cookbook/reading-the-field");
    const rows = page.locator(".cb-out-row");
    // beside the well: a real vector. at the centre and past range: zero.
    await expect(
      rows.filter({ has: page.locator("dt", { hasText: "forceAtCentre" }) }).locator("dd"),
    ).toHaveText('{"x":0,"y":0}');
    await expect(
      rows.filter({ has: page.locator("dt", { hasText: "forceBeyondRange" }) }).locator("dd"),
    ).toHaveText('{"x":0,"y":0}');
    const beside = await rows
      .filter({ has: page.locator("dt", { hasText: "forceBesideWell" }) })
      .locator("dd")
      .textContent();
    expect(JSON.parse(beside!).x).toBeLessThan(0);
  });
});

test.describe("cookbook · live demos really boot", () => {
  test("contained field: a scoped field draws into its own canvas and writes --d", async ({
    page,
  }) => {
    await page.goto("/docs/cookbook/contained-fields");
    const demo = page.locator('[data-cb-demo="contained"]');
    // the field creates its canvas inside the stage — scoped, not full-viewport
    await expect(demo.locator("[data-cb-stage] canvas")).toHaveCount(1);
    // and it reports a live density it measured itself
    await expect(demo.locator("[data-cb-status]")).toContainText(/contained field running · --d/, {
      timeout: 15_000,
    });
    // the bounds element is marked as a field boundary, so the PAGE field skips these bodies
    await expect(demo.locator("[data-cb-stage]")).toHaveAttribute("data-field-boundary", "");
  });

  test("data binding: records became bodies, and an update diffs by id", async ({ page }) => {
    await page.goto("/docs/cookbook/data-driven");
    const demo = page.locator('[data-cb-demo="binding"]');
    await expect(demo.locator("[data-cb-status]")).toContainText(/bound 4 records · 4 bodies/, {
      timeout: 15_000,
    });
    await expect(demo.locator(".cb-record")).toHaveCount(4);
    await demo.locator("[data-cb-update]").click();
    await expect(demo.locator("[data-cb-status]")).toContainText(/bound 3 records/);
  });

  test("workbench: the substrate is pick-one and the overlay stack is additive", async ({
    page,
  }) => {
    await page.goto("/docs/cookbook/workbench");
    const demo = page.locator('[data-cb-demo="workbench"]');
    await expect(demo.locator("[data-cb-status]")).toContainText("workbench ready", {
      timeout: 15_000,
    });

    // substrate: picking one deselects the other
    await demo.locator('[data-cb-render="trails"]').click();
    await expect(demo.locator('[data-cb-render="trails"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(demo.locator('[data-cb-render="dots"]')).toHaveAttribute("aria-pressed", "false");

    // overlays: they stack rather than replace
    await demo.locator('[data-cb-overlay="grid"]').click();
    await demo.locator('[data-cb-overlay="force-vectors"]').click();
    await expect(demo.locator("[data-cb-status]")).toContainText("grid");
    await expect(demo.locator("[data-cb-status]")).toContainText("force-vectors");
  });

  test("nav chrome: links are bound as bodies and stay ordinary links", async ({ page }) => {
    await page.goto("/docs/cookbook/interface-chrome");
    const demo = page.locator('[data-cb-demo="nav"]');
    await expect(demo.locator("[data-cb-status]")).toContainText(/nav (bound|not bound)/, {
      timeout: 15_000,
    });
    // progressive enhancement: whatever the field did, the links still navigate
    const first = demo.locator("nav a").first();
    await expect(first).toHaveAttribute("href", "/docs/cookbook");
  });
});
