import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

// Cross-document continuity (#679): `<field-root continuity="session">` serializes the particle pool
// on a non-bfcache pagehide (the readParticles wire format, base64 LE Float32) into sessionStorage and
// the next document restores it ONCE onto its fresh pool. The site's <field-root> does NOT opt in
// (library-only ship; the default boot is unchanged), so each test arms the attribute itself on every
// document it loads. Two things are verified per surface, not asserted: (1) the round trip through a
// HARD navigation (page.reload) lands the captured positions on the next document's pool, and (2)
// without the attribute nothing is ever written — the default path leaves no trace.

const KEY = "fe:continuity"; // CONTINUITY_STORAGE_KEY in @fundamental-engine/elements
const STASH = "e2e:continuity-stash"; // what the element wrote at pagehide, kept for the NEXT document
const STRIDE = 5;

type FieldEl = { particleCount?: () => number; readParticles?: (out: Float32Array) => number } | null;

/** Opt the site's <field-root> into continuity on EVERY document this page loads (the attribute is
 *  observed, and attributeChangedCallback is a no-op until the field exists, so before-or-after boot
 *  both work). */
const optIn = (page: Page): Promise<void> =>
  page.addInitScript(() => {
    const apply = () => document.querySelector("field-root")?.setAttribute("continuity", "session");
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
    else apply();
  });

/** The same readiness gate home/perf use: the persisted engine simulates with a real particle pool. */
const waitForBoot = (page: Page): Promise<void> =>
  expect
    .poll(async () => page.evaluate(() => (document.querySelector("field-root") as FieldEl)?.particleCount?.() ?? 0), {
      timeout: 20_000,
    })
    .toBeGreaterThan(50) as unknown as Promise<void>;

/** Register a pagehide listener AFTER the element's (so it fires after the capture) that stashes
 *  whatever sits under the continuity key — "" when nothing was written — for the next document. */
const stashOnPageHide = (page: Page): Promise<void> =>
  page.evaluate(
    ({ key, stash }) => {
      window.addEventListener("pagehide", () => {
        try {
          sessionStorage.setItem(stash, sessionStorage.getItem(key) ?? "");
        } catch {
          /* storage unavailable: the assertion below reads the absence */
        }
      });
    },
    { key: KEY, stash: STASH },
  );

const readStorage = (page: Page): Promise<{ key: string | null; stash: string | null }> =>
  page.evaluate(
    ({ key, stash }) => ({ key: sessionStorage.getItem(key), stash: sessionStorage.getItem(stash) }),
    { key: KEY, stash: STASH },
  );

/** The live pool in readParticles order (stride 5: x, y, z, heat, size). */
const readPool = (page: Page): Promise<number[]> =>
  page.evaluate(() => {
    const el = document.querySelector("field-root") as FieldEl;
    const n = el?.particleCount?.() ?? 0;
    const buf = new Float32Array(n * 5);
    const w = el?.readParticles?.(buf) ?? 0;
    return Array.from(buf.subarray(0, w * 5));
  });

/** Decode a stored blob's payload (base64 little-endian Float32) in Node. */
function decodeBlob(raw: string): { n: number; W: number; H: number; floats: number[] } {
  const blob = JSON.parse(raw) as { v: number; stride: number; n: number; W: number; H: number; data: string };
  expect(blob.v, "wire version").toBe(0);
  expect(blob.stride, "stride").toBe(STRIDE);
  const bytes = Buffer.from(blob.data, "base64");
  expect(bytes.length, "byte length = n × stride × 4").toBe(blob.n * STRIDE * 4);
  const floats: number[] = [];
  for (let i = 0; i < bytes.length; i += 4) floats.push(bytes.readFloatLE(i));
  return { n: blob.n, W: blob.W, H: blob.H, floats };
}

/** Per-row planar displacement between a stored pool and the live one, over the overlapping rows. */
function displacements(stored: number[], live: number[]): number[] {
  const rows = Math.min(stored.length, live.length) / STRIDE;
  const out: number[] = [];
  for (let i = 0; i < rows; i++) {
    const o = i * STRIDE;
    out.push(Math.hypot(live[o]! - stored[o]!, live[o + 1]! - stored[o + 1]!));
  }
  return out;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? Number.NaN;
};

test.describe("cross-document continuity (#679) — opt-in via continuity=\"session\"", () => {
  test("a hard navigation (reload) hands the pool to the next document: the key is consumed and the fresh pool carries the captured positions", async ({
    page,
  }) => {
    await optIn(page);
    await page.goto("/");
    await waitForBoot(page);
    await stashOnPageHide(page);

    await page.reload();
    await waitForBoot(page);

    const { key, stash } = await readStorage(page);
    expect(key, "one-shot: the next document consumed the continuity key at boot").toBeNull();
    expect(stash, "the element wrote a blob at pagehide").toBeTruthy();
    const blob = decodeBlob(stash!);
    expect(blob.n).toBeGreaterThan(50);
    // captured in this viewport, so the restore rescales by exactly 1
    const vp = page.viewportSize()!;
    expect(blob.W).toBe(vp.width);
    expect(blob.H).toBe(vp.height);

    // the live pool is the captured pool, plus at most the few frames simulated since boot. A fresh
    // random pool would sit ~hundreds of px away per row; the restored one drifts by a few px at most.
    const live = await readPool(page);
    expect(live.length / STRIDE, "the restored rows are present").toBeGreaterThanOrEqual(blob.n);
    const d = displacements(blob.floats, live);
    expect(d.length).toBe(blob.n);
    expect(median(d), "median displacement from the captured positions").toBeLessThan(25);
  });

  test("under prefers-reduced-motion the restore adds no motion: the next document's pool is the captured pool, bit for bit", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await optIn(page);
    await page.goto("/");
    await waitForBoot(page);
    await stashOnPageHide(page);

    await page.reload();
    await waitForBoot(page);

    const { key, stash } = await readStorage(page);
    expect(key).toBeNull();
    const blob = decodeBlob(stash!);
    const live = await readPool(page);
    expect(live.length / STRIDE).toBeGreaterThanOrEqual(blob.n);
    // the engine is frozen (dt = 0), so x, y and size are exactly the captured lanes (the capture
    // space equals this one → scale 1; in-field positions clamp to themselves).
    for (let i = 0; i < blob.n; i++) {
      const o = i * STRIDE;
      expect(live[o], `x of row ${i}`).toBe(blob.floats[o]);
      expect(live[o + 1], `y of row ${i}`).toBe(blob.floats[o + 1]);
      expect(live[o + 4], `size of row ${i}`).toBe(blob.floats[o + 4]);
    }
  });

  test("without the attribute (the site's default) nothing is ever written — the default boot leaves no trace", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForBoot(page);
    await expect(page.locator("field-root")).not.toHaveAttribute("continuity", /.*/);
    await stashOnPageHide(page);

    await page.reload();
    await waitForBoot(page);

    const { key, stash } = await readStorage(page);
    expect(stash, "the pagehide probe ran and found nothing under the continuity key").toBe("");
    expect(key).toBeNull();
  });
});
