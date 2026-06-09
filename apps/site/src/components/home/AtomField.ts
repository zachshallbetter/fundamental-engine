// "The field is the project." Seed the persisted <field-root> with the 132 project atoms (so every
// base particle carries a real piece of field-ui, and its weight scales the dot's mass + size), then
// wire hover-to-inspect: the nearest particle's atom shows in a tooltip that follows the cursor.
// Uses the new FieldHandle seam — field.seed(atoms) + field.atomAt(x, y).
import atomsData from "../../data/atoms.json";

interface Atom {
  kind: string;
  id: string;
  label: string;
  color?: string;
  href?: string;
  weight?: number;
  data?: Record<string, unknown>;
}
type FieldEl = HTMLElement & {
  seed?: (atoms: readonly Atom[]) => void;
  atomAt?: (x: number, y: number) => Atom | null;
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
    `<span class="at-label">${esc(a.label)}</span></span>${rows}`
  );
}

export function initAtomField(): () => void {
  const field = document.querySelector<FieldEl>("field-root");
  if (typeof field?.seed !== "function") return () => {};
  field.seed(atomsData.atoms as Atom[]);

  const tip = document.createElement("div");
  tip.className = "atom-tip";
  tip.hidden = true;
  document.body.appendChild(tip);

  const ac = new AbortController();
  let raf = 0;
  const onMove = (e: PointerEvent): void => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const a = field.atomAt?.(e.clientX, e.clientY) ?? null;
      if (!a) {
        tip.hidden = true;
        return;
      }
      tip.innerHTML = renderAtom(a);
      // keep the tip on-screen (flip near the right/bottom edges)
      const nearRight = e.clientX > window.innerWidth - 280;
      const nearBottom = e.clientY > window.innerHeight - 160;
      tip.style.left = `${e.clientX + (nearRight ? -16 : 16)}px`;
      tip.style.top = `${e.clientY + (nearBottom ? -16 : 18)}px`;
      tip.dataset.flipX = String(nearRight);
      tip.dataset.flipY = String(nearBottom);
      tip.hidden = false;
    });
  };
  window.addEventListener("pointermove", onMove, { signal: ac.signal, passive: true });
  window.addEventListener("pointerleave", () => (tip.hidden = true), { signal: ac.signal });

  return () => {
    ac.abort();
    cancelAnimationFrame(raf);
    tip.remove();
  };
}
