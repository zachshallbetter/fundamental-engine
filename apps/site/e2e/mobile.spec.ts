import type { CDPSession, Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { INVISIBLE_FIELDS } from "../src/lib/invisible-fields";

// The emulated-touch QA pass over the twelve invisible-fields pages (issue #299's
// emulation-coverable portion). Runs ONLY in the `mobile` project — a Pixel-class
// viewport (~412px, isMobile, hasTouch) — via the project's testMatch.
//
// Touch gestures use CDP Input.dispatchTouchEvent (chromium): unlike JS-dispatched
// synthetic events, CDP touches go through the browser's real gesture arbitration —
// touch-action latching, scroll claiming, pointercancel — which is exactly the class
// of behavior these tests pin.

// ── helpers ───────────────────────────────────────────────────────────────────

const noHorizontalOverflow = async (page: Page): Promise<void> => {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const d = document.documentElement;
          return d.scrollWidth - d.clientWidth;
        }),
      { timeout: 10_000 },
    )
    .toBeLessThanOrEqual(1);
};

interface TouchPoint {
  x: number;
  y: number;
}

const touch = (
  cdp: CDPSession,
  type: "touchStart" | "touchMove" | "touchEnd",
  points: TouchPoint[],
): Promise<unknown> => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });

/** a quick upward flick — the plain scroll gesture */
const flickUp = async (cdp: CDPSession, x: number, fromY: number, toY: number): Promise<void> => {
  await touch(cdp, "touchStart", [{ x, y: fromY }]);
  for (let y = fromY; y >= toY; y -= 40) await touch(cdp, "touchMove", [{ x, y }]);
  await touch(cdp, "touchEnd", []);
};

// ── (a) no horizontal overflow on ALL twelve pages ────────────────────────────

test.describe("mobile · no horizontal overflow", () => {
  for (const field of INVISIBLE_FIELDS) {
    test(`${field.href} fits the mobile viewport`, async ({ page }) => {
      await page.goto(field.href);
      await page.waitForLoadState("load");
      await noHorizontalOverflow(page);
    });
  }
});

// ── (b) the sidebar renders as the horizontal chip strip ──────────────────────

test.describe("mobile · sidebar", () => {
  test("the roster renders as the horizontal chip strip with 12 items", async ({ page }) => {
    await page.goto("/evidence");
    const list = page.locator(".ev-side-list");
    // 12 roster examples + the Overview door (not a roster entry) — match the desktop sidebar spec
    await expect(list.locator("a.ev-side-item:not(.ev-side-overview)")).toHaveCount(12);
    // the ≤1080px layout: a row that scrolls horizontally inside itself
    await expect(list).toHaveCSS("flex-direction", "row");
    await expect(list).toHaveCSS("overflow-x", "auto");
    // the strip carries the chips' width; the PAGE does not grow with it
    const scrolls = await list.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(scrolls).toBe(true);
    await noHorizontalOverflow(page);
  });
});

// ── (c) backlog: touch drag arms, drops, recounts — and rest-state scroll works ─

test.describe("mobile · backlog touch triage", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/evidence/backlog");
  });

  test("the page scrolls normally at rest — touch-action is only restricted mid-drag", async ({
    page,
  }) => {
    const card = page.locator('[data-wl-list="open"] .wl-item').first();
    await expect(card).toBeVisible();
    // at rest the cards keep the default touch-action (the page must pan)
    await expect(card).toHaveCSS("touch-action", "auto");

    // a flick that STARTS ON A CARD still scrolls the page
    await card.scrollIntoViewIfNeeded();
    const box = (await card.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const before = await page.evaluate(() => window.scrollY);
    await flickUp(cdp, box.x + box.width / 2, box.y + box.height / 2, box.y - 240);
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 5_000 })
      .toBeGreaterThan(before);
    // and the flick never armed a drag
    await expect(page.locator(".wl-item.wl-drag")).toHaveCount(0);
  });

  test("long-press lifts an in-flight card and a touch drag drops it in Shipped; reset restores", async ({
    page,
  }) => {
    await expect(page.locator('[data-wl-lane="open"] [data-wl-count]')).toHaveText("3");
    await expect(page.locator('[data-wl-lane="shipped"] [data-wl-count]')).toHaveText("54");

    // the lanes stack on mobile — scroll the seam into view: the source card near the
    // top, the shipped lane's head in the lower half (clear of the ±60px edge band)
    await page.evaluate(() => {
      const shipped = document.querySelector<HTMLElement>('[data-wl-lane="shipped"]')!;
      window.scrollTo(0, Math.max(0, shipped.getBoundingClientRect().top + window.scrollY - 660));
    });
    const card = page.locator('[data-wl-list="open"] .wl-item').first();
    const src = (await card.boundingBox())!;
    const shipped = (await page.locator('[data-wl-lane="shipped"]').boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(src.y).toBeGreaterThan(0); // both ends of the gesture are on screen
    const grabX = src.x + 16;
    const grabY = src.y + src.height - 10; // the meta line, never the title link
    const dropX = shipped.x + shipped.width / 2;
    const dropY = Math.min(shipped.y + 70, viewport.height - 120);
    expect(dropY).toBeGreaterThan(shipped.y); // the drop point is inside the lane

    const cdp = await page.context().newCDPSession(page);
    await touch(cdp, "touchStart", [{ x: grabX, y: grabY }]);
    // the long-press arms the drag (a moved touch would have been a scroll instead)
    await expect(card).toHaveClass(/wl-drag/, { timeout: 3_000 });
    // mid-drag the lifted card refuses the pan — touch-action: none, drag only
    await expect(card).toHaveCSS("touch-action", "none");
    const steps = 14;
    for (let i = 1; i <= steps; i++) {
      await touch(cdp, "touchMove", [
        { x: grabX + ((dropX - grabX) * i) / steps, y: grabY + ((dropY - grabY) * i) / steps },
      ]);
    }
    // let the per-frame slot indicator settle on the drop position
    await page.waitForTimeout(200);
    await touch(cdp, "touchEnd", []);

    await expect(page.locator('[data-wl-lane="open"] [data-wl-count]')).toHaveText("2");
    await expect(page.locator('[data-wl-lane="shipped"] [data-wl-count]')).toHaveText("55");
    await expect(page.locator("[data-wl-local]").first()).toBeVisible();

    // reset board (a tap — the click path) → the server arrangement returns
    const reset = page.locator("[data-wl-reset]");
    await reset.scrollIntoViewIfNeeded();
    await expect(reset).toBeEnabled();
    await reset.tap();
    await expect(page.locator('[data-wl-lane="open"] [data-wl-count]')).toHaveText("3");
    await expect(page.locator('[data-wl-lane="shipped"] [data-wl-count]')).toHaveText("54");
  });
});

// ── (d) calendar: the week view is the scroll-snap strip ──────────────────────

test.describe("mobile · calendar week strip", () => {
  test("week view renders the scroll-snap strip without overflow", async ({ page }) => {
    await page.goto("/evidence/calendar");
    // week is the default view; make the choice explicit anyway (a tap — the click path)
    const weekBtn = page.locator('[data-cal-view="week"]');
    await weekBtn.tap();
    await expect(weekBtn).toHaveAttribute("aria-pressed", "true");

    const week = page.locator(".cal-week");
    await expect(week).toBeVisible();
    // 7 day columns + the "later +" summary column
    await expect(week.locator(".cal-wcol")).toHaveCount(8);
    // the ≤840px strip: snap on the columns container, snap-align on the columns
    await expect(week).toHaveCSS("scroll-snap-type", /x\s+mandatory/);
    await expect(week.locator(".cal-wcol").first()).toHaveCSS("scroll-snap-align", "start");
    // the strip scrolls inside itself; the page never grows sideways
    const scrolls = await week.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(scrolls).toBe(true);
    await noHorizontalOverflow(page);
  });
});

// ── (e) market: mobile tiers, no overflow, the controls row wraps ─────────────

test.describe("mobile · market mosaic", () => {
  test("tiles cap at the mobile tier widths and the mosaic never overflows", async ({ page }) => {
    await page.goto("/evidence/market");
    await expect(page.locator(".mk-tile")).toHaveCount(24);

    // ≤840px: a 3-column grid where the widest tier spans 2 — no tile exceeds ~2/3
    // of the mosaic, and none escapes it
    const mosaic = (await page.locator(".mk-mosaic").boundingBox())!;
    const boxes = await page
      .locator(".mk-tile")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
    expect(boxes).toHaveLength(24);
    for (const w of boxes) expect(w).toBeLessThanOrEqual((mosaic.width * 2) / 3 + 2);
    await noHorizontalOverflow(page);
  });

  test("the controls row wraps without clipping — the live data chip included", async ({
    page,
  }) => {
    await page.goto("/evidence/market");
    const controls = page.locator(".ex-market .ev-controls");
    await expect(controls).toBeVisible();
    // nothing inside the controls box overflows it horizontally
    const clipped = await controls.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(clipped).toBeLessThanOrEqual(1);
    // every control — Field, Weight by, Move window, and the Data status chip — is
    // visible and inside the viewport
    const viewport = page.viewportSize()!;
    for (const ctl of await controls.locator(".ev-ctl").all()) {
      await expect(ctl).toBeVisible();
      const box = (await ctl.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    }
    await expect(controls.locator("[data-mk-status]")).toBeVisible();
    // wrapping happened: the controls stack into more than one row at 412px
    const wrapped = await controls.evaluate((el) => {
      const rows = new Set(
        [...el.querySelectorAll(".ev-ctl")].map((c) => Math.round(c.getBoundingClientRect().top)),
      );
      return rows.size > 1;
    });
    expect(wrapped).toBe(true);
  });
});

// ── (f) memory: the grid and a card review under touch ────────────────────────

test.describe("mobile · memory under touch", () => {
  test("the grid renders and a tap reviews a card (tap = click path)", async ({ page }) => {
    await page.goto("/evidence/memory");
    await page.evaluate(() => {
      localStorage.removeItem("fui:memory-reviews");
      localStorage.removeItem("fui:memory-day");
    });
    await page.reload();

    const cards = page.locator(".mx-card");
    expect(await cards.count()).toBeGreaterThan(0);
    await noHorizontalOverflow(page);

    const card = cards.first();
    await card.scrollIntoViewIfNeeded();
    await expect(card).not.toHaveAttribute("data-reviewed", "");
    await card.tap();
    await expect(card).toHaveAttribute("data-reviewed", "");
    // the review springs the card back to its anchor strength
    const { w, anchor } = await card.evaluate((el) => ({
      w: parseFloat((el as HTMLElement).style.getPropertyValue("--w")),
      anchor: parseFloat((el as HTMLElement).dataset.anchor ?? ""),
    }));
    expect(Math.abs(w - anchor)).toBeLessThan(0.002);
  });
});

test.describe("site navigation", () => {
  test("the nav is reachable on a phone — destinations scroll, none clipped", async ({ page }) => {
    await page.goto("/evidence/");
    const dest = page.locator(".sn-dest");
    await expect(dest).toBeVisible();
    // the strip itself stays inside the viewport; its content may scroll
    const box = await dest.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    // every destination link is reachable by scrolling the strip
    const links = dest.locator("a");
    const n = await links.count();
    expect(n).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < n; i++) {
      const link = links.nth(i);
      await link.scrollIntoViewIfNeeded();
      const b = await link.boundingBox();
      expect(b).not.toBeNull();
      expect(b!.x).toBeGreaterThanOrEqual(-1);
      expect(b!.x + b!.width).toBeLessThanOrEqual(viewport.width + 1);
    }
    // the field toggles are desktop affordances — hidden on phones
    await expect(page.locator(".sn-toggles")).toBeHidden();
  });
});
