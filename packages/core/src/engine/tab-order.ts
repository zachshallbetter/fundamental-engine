/**
 * Tab order as a field current (#943, deferred from #665).
 *
 * #942 gave keyboard users field ENGAGEMENT at mouse parity: focus lights a body exactly as hover
 * does. This is the other half — the path *between* bodies. A keyboard user travels a sequence the
 * page never shows them; a mouse user can see where they are going before they go. The current makes
 * the next stop legible: focusing body _n_ leans the field toward body _n+1_.
 *
 * The sequencing is pure here — the real tab-order rule is fiddly and worth testing away from the
 * DOM — while the field loop supplies the elements and applies the cue.
 *
 * **Why a channel and not only a drawn current.** This engine is signals-first: `render: 'none'` is
 * the default (#538), so a purely visual current would be invisible on most fields. The primary
 * output is therefore `--field-next` on the successor, which an author's CSS turns into whatever
 * cue suits the page — and which is *already* the static equivalent that governance requires for
 * reduced motion, because it is a value and not a movement.
 */

/** The minimum a candidate must tell us to be sequenced. Structural, so this stays DOM-free. */
export interface TabCandidate {
  /** the element's `tabIndex`. Negative = not in the sequence at all. */
  tabIndex: number;
  /** does this body contain (or is it) something focusable? A `[data-hot]` card is usually a
   *  container whose `<a>` takes the focus — the card still belongs in the sequence. */
  focusable: boolean;
}

/**
 * Order candidates the way a browser does, given them already in DOCUMENT order.
 *
 * The rule, which is easy to get subtly wrong and invisible when you do:
 * 1. every element with a **positive** `tabindex` comes first, ascending by value;
 * 2. ties within the same positive value keep document order;
 * 3. then everything with `tabindex="0"` (or naturally focusable), in document order;
 * 4. anything negative is not in the sequence at all — `tabindex="-1"` is programmatic focus only.
 *
 * Returns indices into the input, so the caller keeps its own element identity.
 */
export function tabSequence(items: readonly TabCandidate[]): number[] {
  const positive: number[] = [];
  const natural: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    if (!it.focusable) continue;
    if (it.tabIndex < 0) continue; // programmatic focus only — never reached by Tab
    if (it.tabIndex > 0) positive.push(i);
    else natural.push(i);
  }
  // stable ascending sort on the positive group; `natural` is already in document order
  positive.sort((a, b) => items[a]!.tabIndex - items[b]!.tabIndex || a - b);
  return [...positive, ...natural];
}

/**
 * The index of what Tab reaches after `from`, or `-1` when `from` is the last stop (or not in the
 * sequence). Deliberately does NOT wrap: the last body's successor is the browser chrome, and
 * pretending the sequence loops would point the current at somewhere Tab will not go.
 */
export function tabSuccessor(sequence: readonly number[], from: number): number {
  const at = sequence.indexOf(from);
  if (at < 0 || at === sequence.length - 1) return -1;
  return sequence[at + 1]!;
}

/** The mirror of {@link tabSuccessor} for Shift+Tab. `-1` when `from` is the first stop. */
export function tabPredecessor(sequence: readonly number[], from: number): number {
  const at = sequence.indexOf(from);
  if (at <= 0) return -1;
  return sequence[at - 1]!;
}

/** How far the current reaches from the line between the two bodies, in px. */
export const TAB_CURRENT_WIDTH = 90;

/** Strength of the per-particle lean along the focused → next direction. */
export const TAB_CURRENT_GAIN = 0.045;

/**
 * The current's contribution at `(px, py)`, written into a caller-owned `out`.
 *
 * Matter near the segment from `(ax, ay)` to `(bx, by)` is leaned ALONG it — toward the next stop,
 * never back — falling off with perpendicular distance and vanishing past {@link TAB_CURRENT_WIDTH}.
 * Beyond the segment's ends it falls off too, so the current reads as a channel between two places
 * rather than an infinite line through them.
 *
 * Returns `out` unchanged (zeroed) when the two bodies coincide: a zero-length segment has no
 * direction, and normalizing it would put NaN into every particle's velocity.
 */
export function tabCurrentInto(
  out: { x: number; y: number },
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  gain = TAB_CURRENT_GAIN,
): { x: number; y: number } {
  out.x = 0;
  out.y = 0;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (!(len > 1e-9)) return out;
  const ux = dx / len;
  const uy = dy / len;
  // project the point onto the segment
  const t = ((px - ax) * ux + (py - ay) * uy) / len; // 0 at a, 1 at b
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + ux * len * clamped;
  const cy = ay + uy * len * clamped;
  const d = Math.hypot(px - cx, py - cy);
  if (d >= TAB_CURRENT_WIDTH) return out;
  const across = 1 - d / TAB_CURRENT_WIDTH;
  // taper at the ends so the channel opens and closes rather than starting mid-air
  const along = t < 0 || t > 1 ? 0 : Math.sin(Math.PI * clamped) * 0.5 + 0.5;
  const k = across * along * gain;
  out.x = ux * k;
  out.y = uy * k;
  return out;
}
