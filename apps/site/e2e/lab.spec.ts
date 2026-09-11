import { test, expect } from "./fixtures";

// /lab — direct manipulation (#696): the particle start point, its initial-velocity arrow and
// the body are draggable on the chamber (pointer capture), and the Tune panel's x/y/vx/vy and
// body x/y number inputs are bound both ways to those handles. The page publishes the handles'
// canvas-local screen positions on `window.__labHandles` (refreshed by every draw) — the same
// window-global style as `__labAbort` / `__labTimer` — which is the readiness + targeting hook.

type Handle = { kind: "start" | "velocity" | "body"; sx: number; sy: number; r: number };

const handles = (page: import("@playwright/test").Page) =>
  page.evaluate(() => ((window as any).__labHandles ?? []) as Handle[]);

const handleOf = async (page: import("@playwright/test").Page, kind: Handle["kind"]) => {
  const hs = await handles(page);
  const h = hs.find((x) => x.kind === kind);
  expect(h, `no ${kind} handle`).toBeTruthy();
  const box = await page.locator("#chamber").boundingBox();
  expect(box).toBeTruthy();
  return { local: h!, abs: { x: box!.x + h!.sx, y: box!.y + h!.sy } };
};

// a paced drag: arm, travel in steps, settle, release — so the rAF-coalesced live re-runs
// see the motion even on a slow CI renderer
const dragBy = async (page: import("@playwright/test").Page, from: { x: number; y: number }, dx: number, dy: number) => {
  await page.mouse.move(from.x, from.y);
  await page.waitForTimeout(60);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 4 });
  await page.waitForTimeout(80);
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 });
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(120);
};

test.describe("/lab — direct manipulation", () => {
  const errors: string[] = [];
  test.beforeEach(async ({ page }) => {
    errors.length = 0;
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("/lab");
    // attract is the default force: a 60-frame run with start, velocity and body handles
    await expect(page.locator("#frameReadout")).toHaveText(/frame 0 \/ 60/);
    await expect.poll(() => handles(page).then((h) => h.length)).toBe(3);
    await page.locator('#tabs [data-tab="tune"]').click();
    await expect(page.locator('#params input.num[data-param="x"]')).toBeVisible();
  });
  test.afterEach(() => {
    expect(errors, "page errors").toEqual([]);
  });

  test("the Tune panel carries the start x/y and body x/y rows at the scenario defaults", async ({ page }) => {
    // attract: body {cx:150}, particles [{x:0,y:0}] — the input frame, not the runner's centred one
    await expect(page.locator('#params input.num[data-param="x"]')).toHaveValue("0");
    await expect(page.locator('#params input.num[data-param="y"]')).toHaveValue("0");
    await expect(page.locator('#params input.num[data-param="bx"]')).toHaveValue("150");
    await expect(page.locator('#params input.num[data-param="by"]')).toHaveValue("0");
    await expect(page.locator("#preset")).toHaveValue("default");
  });

  test("dragging the start point moves the start and updates the x/y inputs", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "synthetic drag unreliable in CI WebKit software rendering");
    const before = await handles(page);
    const s0 = before.find((h) => h.kind === "start")!, b0 = before.find((h) => h.kind === "body")!;
    const scale = (b0.sx - s0.sx) / 150; // attract: body at x=150, start at x=0 → screen px per world px
    expect(scale).toBeGreaterThan(0);
    await dragBy(page, await handleOf(page, "start").then((h) => h.abs), 40, 25);

    // the drag released cleanly, and a drag is a tune
    await expect(page.locator("#chamber")).not.toHaveClass(/dragging/);
    await expect(page.locator("#preset")).toHaveValue("custom");
    // canvas → inputs: the start moved by the pointer delta / view scale (attract's default is 0,0)
    const xNum = page.locator('#params input.num[data-param="x"]');
    const yNum = page.locator('#params input.num[data-param="y"]');
    await expect.poll(() => xNum.inputValue().then(Number)).toBeGreaterThan(0);
    const x = Number(await xNum.inputValue()), y = Number(await yNum.inputValue());
    expect(Math.abs(x * scale - 40)).toBeLessThan(3);
    expect(Math.abs(y * scale - 25)).toBeLessThan(3);
    // the number and range inputs agree (the panel re-rendered from the same override)
    await expect(page.locator('#params input[type="range"][data-param="x"]')).toHaveValue(String(x));
    await expect(page.locator('#params input[type="range"][data-param="y"]')).toHaveValue(String(y));
    // the body did not move
    await expect(page.locator('#params input.num[data-param="bx"]')).toHaveValue("150");
    // the exact-kind expectation deactivates on a moved start, like any other tuned attribute
    await page.locator('#tabs [data-tab="expect"]').click();
    await expect(page.locator("#checklist .check.pending .kind", { hasText: "exact" })).toHaveCount(1);
  });

  test("dragging the velocity tip sets vx (Δscreen / 6 px per px/f) and the input follows", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "synthetic drag unreliable in CI WebKit software rendering");
    const tip = await handleOf(page, "velocity");
    const start = await handleOf(page, "start");
    // at rest the tip handle stands 16 px right of the start (the launch stub)
    expect(tip.local.sx - start.local.sx).toBeCloseTo(16, 0);
    await dragBy(page, tip.abs, 30, 0);
    await expect(page.locator("#chamber")).not.toHaveClass(/dragging/);
    const vx = page.locator('#params input.num[data-param="vx"]');
    await expect.poll(() => vx.inputValue().then(Number)).toBeCloseTo(5, 0);
    await expect(page.locator('#params input.num[data-param="vy"]')).toHaveValue("0");
    // the initial vector on the canvas now reaches 5 × 6 = 30 px from the start
    const tip2 = await handleOf(page, "velocity");
    const start2 = await handleOf(page, "start");
    expect(tip2.local.sx - start2.local.sx).toBeCloseTo(30, 0);
    expect(Math.abs(tip2.local.sy - start2.local.sy)).toBeLessThan(0.5);
    // the start itself did not move
    await expect(page.locator('#params input.num[data-param="x"]')).toHaveValue("0");
  });

  test("editing the start x input moves the start handle on the canvas (inputs → canvas)", async ({ page }) => {
    const before = await handles(page);
    const s0 = before.find((h) => h.kind === "start")!, b0 = before.find((h) => h.kind === "body")!;
    const scale = (b0.sx - s0.sx) / 150; // attract: body at x=150, start at x=0
    expect(scale).toBeGreaterThan(0);
    const xNum = page.locator('#params input.num[data-param="x"]');
    await xNum.fill("60");
    await xNum.dispatchEvent("input");
    await expect(page.locator("#preset")).toHaveValue("custom");
    // the release-time viewport refit can move both handles; the start→body gap is what the
    // input changed: 150 → 90 world px
    await expect
      .poll(async () => {
        const hs = await handles(page);
        const s = hs.find((h) => h.kind === "start")!, b = hs.find((h) => h.kind === "body")!;
        const sc = await page.evaluate(() => 1); // keep the poll async-shaped
        return sc && (b.sx - s.sx);
      })
      .toBeLessThan((b0.sx - s0.sx) - 5);
    const after = await handles(page);
    const s1 = after.find((h) => h.kind === "start")!, b1 = after.find((h) => h.kind === "body")!;
    // gap ratio 90/150 = 0.6 of the original, independent of the refit
    expect((b1.sx - s1.sx) / (b0.sx - s0.sx)).toBeCloseTo(0.6, 1);
    await expect(page.locator('#params input[type="range"][data-param="x"]')).toHaveValue("60");
  });

  test("dragging the body moves the body x/y inputs and the share link carries bx", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "synthetic drag unreliable in CI WebKit software rendering");
    const body = await handleOf(page, "body");
    await dragBy(page, body.abs, -30, 20);
    await expect(page.locator("#chamber")).not.toHaveClass(/dragging/);
    const bxNum = page.locator('#params input.num[data-param="bx"]');
    const byNum = page.locator('#params input.num[data-param="by"]');
    await expect.poll(() => bxNum.inputValue().then(Number)).toBeLessThan(150);
    await expect.poll(() => byNum.inputValue().then(Number)).toBeGreaterThan(0);
    // the start did not move
    await expect(page.locator('#params input.num[data-param="x"]')).toHaveValue("0");
    await page.locator("#share").click();
    await expect.poll(() => page.evaluate(() => decodeURIComponent(location.hash))).toMatch(/;bx=-?\d+/);
    await expect.poll(() => page.evaluate(() => decodeURIComponent(location.hash))).toMatch(/;by=-?\d+/);
  });

  test("a pointerdown away from every handle leaves the chamber inert", async ({ page }) => {
    const box = await page.locator("#chamber").boundingBox();
    expect(box).toBeTruthy();
    // the top-left corner of the chamber is empty space (the handles sit around the centre)
    await dragBy(page, { x: box!.x + 30, y: box!.y + 40 }, 40, 30);
    await expect(page.locator("#preset")).toHaveValue("default");
    await expect(page.locator('#params input.num[data-param="x"]')).toHaveValue("0");
    await expect(page.locator('#params input.num[data-param="bx"]')).toHaveValue("150");
  });
});
