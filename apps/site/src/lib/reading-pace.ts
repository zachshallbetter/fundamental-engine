// The reading-pace gate — four hand-rolls of the same condition: the engine's live scroll
// velocity (--field-scroll-v on :root, px/frame) below 2.0 means the reader is reading, not
// scanning. The evidence reveal, the market sparkline draw-in, the library bar sweep, and
// the memory stagger all gate on it; this module is the condition with a name.

/** The family's reading-pace threshold (px/frame; see time.md / scrollV's caveats). */
export const READING_PACE_MAX = 2.0;

/**
 * The engine's live scroll velocity — an inline style on <html> written by the platform
 * runtime, so reading el.style costs no style recalc. 0 before the engine boots (late
 * boots and no-JS read as "calm", which is the honest default).
 */
export function scrollV(): number {
  return parseFloat(document.documentElement.style.getPropertyValue("--field-scroll-v")) || 0;
}

/** Is the reader at reading pace right now? */
export function atReadingPace(): boolean {
  return scrollV() < READING_PACE_MAX;
}

/**
 * The entry-animation pattern (market/library/memory/fleet): as each element nears the
 * viewport, add `className`; when the reader is scanning fast — or prefers reduced motion —
 * add `instantClassName` too so the element is simply there instead of animating. Elements
 * are unobserved after firing. Disconnects on `signal` abort.
 */
export function armEntryAtPace(
  elements: readonly Element[],
  className: string,
  instantClassName: string,
  signal: AbortSignal,
  opts?: { threshold?: number; rootMargin?: string },
): void {
  if (elements.length === 0) return;
  const reduced =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        if (reduced || !atReadingPace()) e.target.classList.add(className, instantClassName);
        else e.target.classList.add(className);
        io.unobserve(e.target);
      }
    },
    { threshold: opts?.threshold ?? 0.15, rootMargin: opts?.rootMargin },
  );
  for (const el of elements) io.observe(el);
  signal.addEventListener("abort", () => io.disconnect());
}
