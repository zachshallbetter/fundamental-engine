/**
 * headlessHost — the reference {@link FieldHost} for non-DOM, non-visual consumers: an agent reading
 * the field as a salience substrate, a native sidecar, a Node service, or a deterministic test. Where
 * `browserHost()` binds the engine to `window`/`document`/rAF, `headlessHost()` binds it to nothing —
 * an abstract volume the caller sets, a no-op scan root (bodies come via `addBody`, not `[data-body]`),
 * and a **manual** loop the caller drives with `tick()` instead of requestAnimationFrame.
 *
 * Pair it with `render: 'none'` (signals-first): the field runs the full simulation + writes its
 * signals and draws nothing. Read them back per-body through `addBody`'s `onFeedback`, or globally via
 * `sampleScalar` / `readParticles`. No DOM is touched (`host-headless.ts` references only the DOM
 * *types* already in `host.ts`, no globals — `dom-boundary.test.ts` stays green).
 *
 * ```ts
 * const host = headlessHost({ width: 1920, height: 1080 });
 * const field = createField(undefined, { host, render: 'none' });
 * field.addBody({ tokens: ['attract'], rect: () => box, onFeedback: (ch) => read(ch.density) });
 * host.tick(); // advance one frame — call per agent turn or on a schedule
 * ```
 */
import type { FieldHost, HostViewport } from './host.ts';

export interface HeadlessHostOptions {
  /** the field's coordinate-space width (the abstract "volume"). */
  width: number;
  /** the field's coordinate-space height. */
  height: number;
}

/** A {@link FieldHost} the caller drives manually — see {@link headlessHost}. */
export interface HeadlessHost extends FieldHost {
  /** Advance the field one frame. Pass an explicit timestamp (ms), or omit to auto-step ~1/60 s. */
  tick(t?: number): void;
  /** Resize the abstract volume (the field's coordinate space). */
  resize(width: number, height: number): void;
}

export function headlessHost(opts: HeadlessHostOptions): HeadlessHost {
  let w = opts.width;
  let h = opts.height;
  let frame: ((t: number) => void) | null = null;
  let t = 0;
  // a no-op scan root — a headless field has no `[data-body]` DOM; bodies are registered via addBody.
  const root = {
    querySelectorAll: () => [] as unknown as NodeListOf<Element>,
    querySelector: () => null,
    contains: () => false,
  } as unknown as ParentNode;

  return {
    root,
    viewport: (): HostViewport => ({ width: w, height: h, dpr: 1 }),
    scrollY: () => 0,
    scrollHeight: () => h,
    reducedMotion: () => false,
    hidden: () => false,
    // the loop is manual: raf stashes the next frame, tick() fires it. The consumer owns the cadence.
    raf: (cb) => {
      frame = cb;
      return 1;
    },
    cancelRaf: () => {
      frame = null;
    },
    createCanvas: () => {
      throw new Error(
        "headlessHost does not render — use render:'none' and the signal read-outs (onFeedback / sampleScalar / readParticles).",
      );
    },
    onResize: () => () => {},
    onScroll: () => () => {},
    onVisibility: () => () => {},
    onInput: () => () => {},
    onBodyEvent: () => () => {},

    tick(at) {
      t = at ?? t + 1000 / 60;
      const cb = frame;
      frame = null;
      cb?.(t);
    },
    resize(width, height) {
      w = width;
      h = height;
    },
  };
}
