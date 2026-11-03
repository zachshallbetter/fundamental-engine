import { test, expect } from "./fixtures";
import { DOCS_NAV, DOCS_FLAT } from "../src/lib/docs-nav";

// The docs SHELL as its own best demo (DocsLayout + DocsRuntime). Pins the invariants:
// docs pages run as invisible fields (headings become bodies at init, never in markup),
// the "On this page" TOC reads live attention, the page measures its own reference
// integrity and says so, Pagefind search works keyboard-first against the built index,
// the docs-field toggle is honest and persists, and the sidebar carries the regrouped IA.
test.describe("docs shell", () => {
  test("the page runs as an invisible field: headings gain bodies at init", async ({ page }) => {
    await page.goto("/docs/concepts");
    // runtime-applied, uniform contract — content pages ship no field markup
    const bodies = page.locator('.docs-content :is(h2, h3)[data-body="attract"]');
    await expect.poll(async () => bodies.count()).toBeGreaterThan(2);
    const first = bodies.first();
    await expect(first).toHaveAttribute("data-hot", "");
    await expect(first).toHaveAttribute("data-feedback", "");
    await expect(first).toHaveAttribute("data-strength", "0.8");
    await expect(first).toHaveAttribute("data-range", "220");
    await expect(page.locator("main.docs-content")).toHaveAttribute("data-field-docs", "on");
  });

  test("the TOC reads live attention: links carry --att after scroll", async ({ page }) => {
    await page.goto("/docs/concepts");
    await expect.poll(async () => page.locator("#docsToc a").count()).toBeGreaterThan(3);
    // bring a deep section toward the viewport center — its attention must rise
    await page.locator(".docs-content h2").nth(3).scrollIntoViewIfNeeded();
    await expect
      .poll(
        async () =>
          page.$$eval("#docsToc a", (as) =>
            as.some(
              (a) => parseFloat((a as HTMLElement).style.getPropertyValue("--att")) > 0.05,
            ),
          ),
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  test("the integrity chip measures the page's own references — and they resolve", async ({
    page,
  }) => {
    await page.goto("/docs/concepts");
    const chip = page.locator("[data-docs-integrity]");
    await expect(chip).toHaveText(/references · \d+\/\d+ resolve/);
    const [, resolved, total] = (await chip.textContent())!.match(/(\d+)\/(\d+)/)!;
    // the claimed denominator is the page's real internal-reference count (routes +
    // fragments; file assets are outside the route manifest's scope — same rule as
    // the runtime)
    const counted = await page.$$eval(".docs-content a", (as) =>
      as.filter((a) => {
        const h = a.getAttribute("href") || "";
        if (!(h.startsWith("/") || h.startsWith("#"))) return false;
        return !/\.[a-z0-9]+$/i.test(h.split(/[#?]/)[0]!);
      }).length,
    );
    expect(Number(total)).toBe(counted);
    expect(Number(resolved)).toBe(Number(total)); // all resolve → teal, no title
    await expect(chip).toHaveAttribute("data-state", "ok");
  });

  test("search: opens from the keyboard, finds, and enter navigates", async ({ page }) => {
    await page.goto("/docs");
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.locator("dialog.docs-search");
    await expect(dialog).toHaveAttribute("open", "");
    await page.locator("[data-docs-search-input]").fill("attention");
    const hits = page.locator(".ds-hit");
    await expect(hits.first()).toBeVisible({ timeout: 10_000 });
    // the first hit is pre-selected; Enter goes there
    await expect(hits.first()).toHaveAttribute("aria-selected", "true");
    const target = await hits.first().getAttribute("href");
    await page.keyboard.press("Enter");
    await page.waitForURL(
      (u) => u.pathname.replace(/\/$/, "") === new URL(target!, u).pathname.replace(/\/$/, ""),
    );
  });

  test("the docs-field toggle gates the field honestly and persists", async ({ page }) => {
    await page.goto("/docs/concepts");
    const main = page.locator("main.docs-content");
    await expect(main).toHaveAttribute("data-field-docs", "on");
    await page.locator("[data-docs-field-toggle]").click();
    await expect(main).toHaveAttribute("data-field-docs", "off");
    // off is honest: the heading bodies are gone and the engine has rescanned
    await expect(page.locator(".docs-content :is(h2, h3)[data-body]")).toHaveCount(0);
    await page.reload();
    await expect(page.locator("main.docs-content")).toHaveAttribute("data-field-docs", "off");
    await expect(page.locator("[data-docs-field-toggle]")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  test("the sidebar carries the regrouped IA, Examples (external) last", async ({ page }) => {
    await page.goto("/docs");
    const titles = await page.$$eval(".docs-group-title", (els) =>
      els.map((e) => e.textContent?.trim()),
    );
    // Derived from the nav tree the sidebar renders, not hardcoded. A hardcoded list here broke
    // three separate PRs that legitimately changed the IA; what this test actually guards is that
    // the sidebar renders EVERY non-empty group, in tree order, with Examples (all-external) last —
    // and that survives a future regroup. The spine itself is asserted below.
    expect(titles).toEqual(
      DOCS_NAV.filter((g) => g.items.some((i) => i.ready)).map((g) => g.title),
    );
    // docs-refactor Phase 6 (#1001): the five-section spine leads the tree, in reading order.
    expect(titles.slice(0, 5)).toEqual([
      "Learn",
      "Understand",
      "Build",
      "Reference",
      "Platforms",
    ]);
    expect(titles[titles.length - 1]).toBe("Examples");
    // the Examples group deep-links OUT of the docs shell…
    const exampleHrefs = await page.$$eval(".docs-group:last-child a", (as) =>
      as.map((a) => a.getAttribute("href")!),
    );
    expect(exampleHrefs.length).toBeGreaterThanOrEqual(4);
    expect(exampleHrefs.every((h) => !h.startsWith("/docs"))).toBe(true);
    // …and is excluded from prev/next: the LAST IN-SHELL page has no "next" into it. Derived from
    // DOCS_FLAT — the prev/next order itself — rather than from a DOM group position. Phase 6
    // (#1001) put an all-external group (Research / Frontier) second-to-last, so "the second-to-last
    // group's last link" is now a GitHub URL rather than a docs page; DOCS_FLAT is what the pager
    // actually walks, so this asserts the real invariant and cannot rot on the next regroup.
    const lastDoc = DOCS_FLAT[DOCS_FLAT.length - 1]!.href;
    await page.goto(lastDoc);
    await expect(page.locator(".docs-prevnext .pn.next")).toHaveCount(0);
  });
});
