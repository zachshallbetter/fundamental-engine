/**
 * Overlay frame recording — lets the engine skip re-rastering an overlay frame that is identical to
 * the one already on the surface.
 *
 * The overlay readings are pure functions of field state: a static scene (a page at rest, the grid
 * reading over unmoving bodies) issues the exact same RenderBackend calls every frame, yet each frame
 * cleared and re-stroked the whole full-viewport surface. On a dpr-2 viewport that is a ~3200×1600
 * raster pass per frame for no visible change — enough to tip a GPU at the edge of its frame budget
 * from 60 to 30 fps. The engine now draws each overlay frame into a recording first; when the
 * recording equals the previous frame's, the surface already shows it and nothing is drawn.
 *
 * A recording is a RenderBackend that stores calls as flat data (op kinds, numbers, strings) and can
 * replay them into a real backend. `measureText` delegates to the real backend, so layout that depends
 * on it records the same numbers a direct draw would. Internal — not exported from the package.
 */
import type { RenderBackend, Stroke } from './render-backend.ts';

const SEGMENTS = 0;
const POLYLINE = 1;
const RECT = 2;
const TEXT = 3;

export interface OverlayRecording extends RenderBackend {
  /** forget every recorded call; `measureText` will delegate to `target`. */
  reset(target: RenderBackend): void;
  /** true when `other` recorded exactly the same calls with exactly the same arguments. */
  equals(other: OverlayRecording): boolean;
  /** issue every recorded call, in order, on `out`. */
  replay(out: RenderBackend): void;
  /** @internal the recorded data, for `equals`. */
  readonly data: { kinds: number[]; nums: number[]; strs: string[] };
}

export function createOverlayRecording(): OverlayRecording {
  const kinds: number[] = [];
  const nums: number[] = [];
  const strs: string[] = [];
  let target: RenderBackend | null = null;

  const pushStroke = (s: Stroke): void => {
    nums.push(s.r, s.g, s.b, s.alpha, s.width);
  };
  const pushPoints = (kind: number, pts: ArrayLike<number>, s: Stroke): void => {
    kinds.push(kind);
    nums.push(pts.length);
    for (let i = 0; i < pts.length; i++) nums.push(pts[i]!);
    pushStroke(s);
  };

  return {
    data: { kinds, nums, strs },
    reset(t) {
      target = t;
      kinds.length = 0;
      nums.length = 0;
      strs.length = 0;
    },
    size() {
      // never called on a recording — sizing goes to the real surface.
    },
    clear() {
      // the engine clears the real surface itself, only when a frame actually changed.
    },
    segments(packed, stroke) {
      pushPoints(SEGMENTS, packed, stroke);
    },
    polyline(points, stroke) {
      pushPoints(POLYLINE, points, stroke);
    },
    rect(x, y, w, h, r, g, b, alpha) {
      kinds.push(RECT);
      nums.push(x, y, w, h, r, g, b, alpha);
    },
    text(value, x, y, r, g, b, alpha) {
      kinds.push(TEXT);
      strs.push(value);
      nums.push(x, y, r, g, b, alpha);
    },
    measureText(value) {
      return target ? target.measureText(value) : 0;
    },
    equals(other) {
      const o = other.data;
      if (o.kinds.length !== kinds.length || o.nums.length !== nums.length || o.strs.length !== strs.length) return false;
      for (let i = 0; i < kinds.length; i++) if (o.kinds[i] !== kinds[i]) return false;
      for (let i = 0; i < strs.length; i++) if (o.strs[i] !== strs[i]) return false;
      // Object.is, not ===: NaN must equal NaN (a deterministic NaN redraws identically), and the
      // comparison must stay exact — a recording replays its own numbers, so "close" is a change.
      for (let i = 0; i < nums.length; i++) if (!Object.is(o.nums[i], nums[i])) return false;
      return true;
    },
    replay(out) {
      let n = 0;
      let s = 0;
      const stroke: Stroke = { r: 0, g: 0, b: 0, alpha: 0, width: 0 };
      const readStroke = (): Stroke => {
        stroke.r = nums[n++]!;
        stroke.g = nums[n++]!;
        stroke.b = nums[n++]!;
        stroke.alpha = nums[n++]!;
        stroke.width = nums[n++]!;
        return stroke;
      };
      for (const kind of kinds) {
        if (kind === SEGMENTS || kind === POLYLINE) {
          const len = nums[n++]!;
          const pts = nums.slice(n, n + len);
          n += len;
          const st = readStroke();
          if (kind === SEGMENTS) out.segments(pts, st);
          else out.polyline(pts, st);
        } else if (kind === RECT) {
          out.rect(nums[n]!, nums[n + 1]!, nums[n + 2]!, nums[n + 3]!, nums[n + 4]!, nums[n + 5]!, nums[n + 6]!, nums[n + 7]!);
          n += 8;
        } else {
          out.text(strs[s++]!, nums[n]!, nums[n + 1]!, nums[n + 2]!, nums[n + 3]!, nums[n + 4]!, nums[n + 5]!);
          n += 6;
        }
      }
    },
  };
}
