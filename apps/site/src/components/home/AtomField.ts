// "The field is the project." Seed the persisted <field-root> with the 132 project atoms (so every
// base particle carries a real piece of Fundamental), then a two-stage inspect that stays out of the
// way: hover and *settle* near a dot → the engine holds it still and lights it up (field.focusAt) →
// *click* opens a pinned card with its record. No cursor-following tooltip.
//
// The atoms file is imported as a fingerprinted URL (it stays out of the JS bundle) and resolved
// cache-first via atomCache — IndexedDB, then localStorage, then network — so repeat visits skip
// both the download and the parse. The field renders immediately; the seed lands once atoms resolve.
import atomsUrl from "../../data/atoms.json?url";
import { getAtoms, type Atom } from "./atomCache.ts";

type FieldEl = HTMLElement & {
  seed?: (atoms: readonly Atom[]) => void;
  focusAt?: (x: number, y: number) => Atom | null;
  clearFocus?: () => void;
};

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function renderAtom(a: Atom): string {
  const rows = Object.entries(a.data ?? {})
    .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && !v.length))
    .slice(0, 4)
    .map(([k, v]) => `<span class="at-row"><b>${esc(k)}</b> ${esc(String(v)).slice(0, 90)}</span>`)
    .join("");
  return (
    `<span class="at-head"><span class="at-kind" style="--ac:${a.color ?? "#4da3ff"}">${esc(a.kind)}</span>` +
    `<span class="at-label">${esc(a.label)}</span>` +
    `<button class="at-close" aria-label="Close" type="button">×</button></span>${rows}`
  );
}

export function initAtomField(): () => void {
  const field = document.querySelector<FieldEl>("field-root");
  if (!field) return () => {};
  let disposed = false;
  // The engine boots idle-until-urgent (Base.astro defers the module import), so the
  // element may not be upgraded yet when the page wires up. Wait for the definition,
  // resolve the atoms cache-first (IndexedDB → localStorage → network), then seed.
  void Promise.all([customElements.whenDefined("field-root"), getAtoms(atomsUrl)]).then(
    ([, atoms]) => {
      if (!disposed && atoms.length) field.seed?.(atoms);
    },
  );

  // a pinned inspector card — opens on click (after a dwell focuses a dot), never on plain hover.
  const card = document.createElement("div");
  card.className = "atom-card";
  card.hidden = true;
  document.body.appendChild(card);

  const ac = new AbortController();
  const root = document.documentElement;
  let focused: Atom | null = null;
  let dwell = 0;
  let open = false;

  const release = (): void => {
    if (!focused) return;
    field.clearFocus?.();
    focused = null;
    root.classList.remove("atom-armed");
  };
  const close = (): void => {
    open = false;
    card.hidden = true;
    release();
  };

  // hover + settle: only when the pointer pauses near a dot does the engine hold + light it (the
  // affordance). Plain movement does nothing — no tooltip in the way.
  const onMove = (e: PointerEvent): void => {
    if (open) return; // a card is up — don't re-engage underneath it
    clearTimeout(dwell);
    release();
    const x = e.clientX;
    const y = e.clientY;
    dwell = window.setTimeout(() => {
      const a = field.focusAt?.(x, y) ?? null;
      if (a) {
        focused = a;
        root.classList.add("atom-armed"); // cursor → pointer: the dot is now clickable
      }
    }, 150);
  };

  // click: open the focused dot's card (pinned). A click elsewhere or the × button closes it.
  const onClick = (e: PointerEvent): void => {
    if (open) {
      const t = e.target as Element;
      if (t.closest(".at-close") || !card.contains(t)) close();
      return;
    }
    if (!focused) return;
    card.innerHTML =
      renderAtom(focused) +
      (focused.href ? `<a class="at-go" href="${esc(focused.href)}">open →</a>` : "");
    const nearRight = e.clientX > window.innerWidth - 300;
    const nearBottom = e.clientY > window.innerHeight - 220;
    card.style.left = `${e.clientX + (nearRight ? -18 : 18)}px`;
    card.style.top = `${e.clientY + (nearBottom ? -18 : 18)}px`;
    card.dataset.flipX = String(nearRight);
    card.dataset.flipY = String(nearBottom);
    card.hidden = false;
    open = true; // hold the dot frozen + lit while its card is up
  };

  window.addEventListener("pointermove", onMove, { signal: ac.signal, passive: true });
  window.addEventListener("click", onClick, { signal: ac.signal });
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") close();
    },
    { signal: ac.signal },
  );

  return () => {
    disposed = true;
    ac.abort();
    clearTimeout(dwell);
    field.clearFocus?.();
    root.classList.remove("atom-armed");
    card.remove();
  };
}
