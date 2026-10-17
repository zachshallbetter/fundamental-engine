# Verification — proving a change, not asserting it

"Tests pass" proves the tests pass. For behaviour a user sees, prove it where the user is: a browser, a
bundler, the real registry, real hardware. Report what you verified and, separately, what you could not.

## 1. Repro scripts and regression tests (no DOM needed)

The engine runs headless through a host object, so most behaviour is testable in `node --test` with a
stub host — no jsdom. The minimal host (see `packages/core/src/engine/soft-resize.test.ts`,
`overlay-skip.test.ts`, `destroy-and-detach.test.ts` for complete examples):

```ts
const pending = new Map<number, (t: number) => void>(); let id = 0;
const host: FieldHost = {
  root: { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode,
  viewport: () => ({ width: 800, height: 600, dpr: 1 }),
  scrollY: () => 0, scrollHeight: () => 800, reducedMotion: () => false, hidden: () => false,
  raf: (cb) => (pending.set(++id, cb), id), cancelRaf: (i) => void pending.delete(i),
  createCanvas: () => ({}) as HTMLCanvasElement,
  onResize: () => () => {}, onScroll: () => () => {}, onVisibility: () => () => {},
  onInput: () => () => {}, onBodyEvent: () => () => {},
};
// pump frames: for each tick, run and clear the pending callbacks with an increasing timestamp
```

- `render: 'none'` runs the full simulation with no canvas; pass a stub canvas whose `getContext`
  returns a counting `Proxy` to observe draw calls (`clearRect`, `stroke`).
- `field.readParticleIds(out)` gives stable particle identity — the way to prove a swarm was or wasn't
  rebuilt. `field.query()` / `snapshot()` give bodies and metrics.
- Node ≥ 22 runs `.ts` directly (type stripping) — but not TS parameter properties
  (`constructor(readonly x)`); write those out.
- **Always prove the test fails without the fix.** Simplest and safe with parallel worktrees: run the
  test against the old file without stashing — `git show origin/main:<fixed-file> > /tmp/old && cp
  <fixed-file> /tmp/new && cp /tmp/old <fixed-file>`, run, then `cp /tmp/new <fixed-file>`. If you do
  stash, pop **by identity**, never bare: the stash stack is shared by every worktree, so a bare
  `git stash pop` can apply another task's entry.
  ```sh
  git stash push -m verify-old-<branch> -- <fixed-file>
  ref=$(git stash list --format='%gd %gs' | awk '/verify-old-<branch>/{print $1; exit}')
  # run the test, then:
  git stash pop "$ref"
  ```
  If the test file itself imports new symbols, copy just the relevant test against the old source.

## 2. A bundler (tree-shaking, packaging)

`sideEffects`, `exports` and entry-point bugs only show up when a bundler consumes the package:

```sh
echo "import '@fundamental-engine/elements';" > entry.js
node_modules/.pnpm/node_modules/esbuild/bin/esbuild entry.js --bundle --format=esm --outfile=out.js \
  --alias:@fundamental-engine/elements=$PWD/packages/elements
grep -c '"field-cell"' out.js     # 0 means the registration was tree-shaken away
```

`pnpm check:consumer` does the full user path (scaffold → install the packed tarballs → `tsc` →
`vite build` → assert registrations).

## 3. A real browser

**Static pages / built site.** Serve the directory (`python3 -m http.server <port> --bind 127.0.0.1
--directory <dir>`) and open it in a browser or the Claude in-app browser pane. `file://` URLs won't
load ES modules — use the IIFE build (`packages/vanilla/dist/standalone.global.js`, exposes
`window.Fundamental`) or serve over HTTP.

**Counting real work in the page**: wrap `CanvasRenderingContext2D.prototype.clearRect` / `stroke` with
a per-canvas counter before the field boots, then read the counts after N seconds of idle. This proved
overlay frame-skipping in Chrome (#1243): 1 clear + 256 strokes at boot, then zero for 2 s at ~120 fps;
moving a body caused exactly one redraw.

**The Claude in-app browser pane** is real Chromium with a real GPU, with traps:
- it is often `document.hidden` — `requestAnimationFrame` may not fire, so rAF-driven code stalls; check
  with a quick rAF counter, and for WebGL work drive the field with a timer host
  (`raf: cb => setTimeout(() => cb(performance.now()), 16)`);
- a hidden pane reports a 0×0 window — set an explicit viewport size before measuring layout, and
  reset it afterwards;
- screenshots of a hidden pane can come back black even when the DOM is fine — read text/DOM state
  instead, or render the canvas to a data URL in an `<img>`;
- a dev server with HMR may reload mid-script; prefer synchronous probes, and confirm the page is the
  one you think (`location.pathname`, `performance.getEntriesByType('navigation')[0].type`).
- For SPA behaviour (Astro view transitions), navigate by clicking a real link, then confirm the
  document load type did not change — that's how you know it was a client-side swap.

**Responsive**: at 375 px, assert `document.documentElement.scrollWidth === innerWidth` and that no
section's `getBoundingClientRect().right` exceeds the viewport.

## 4. Real hardware (GPU perf)

The titan runner (see [gates-and-ci.md](gates-and-ci.md#perf-hardware-on-the-titan-gpu-runner)) is the
only hardware-WebGL measurement in CI. Before trusting any manual GPU run, read the WebGL renderer
string back — `scripts/perf/sweep-gpu.mjs` refuses SwiftShader/llvmpipe unless `ALLOW_SOFTWARE=1`.

## 5. The real registry

After a release, scaffold and build from npm itself (see [release.md](release.md#after-publishing--verify-like-a-user)).
A local `pnpm pack` is close, but only the registry proves propagation, provenance and the `bin` wiring
npm actually performs.
