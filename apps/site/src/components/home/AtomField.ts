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
  particleCount?: () => number;
  readParticles?: (out: Float32Array) => number;
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
  const dataRegion = document.querySelector<HTMLElement>("#evidence .wf-plane");
  let dataVisible = !dataRegion;
  let dataUnlocked = !dataRegion;
  let atomsReady = false;
  // The engine boots idle-until-urgent (Base.astro defers the module import), so the
  // element may not be upgraded yet when the page wires up. Wait for the definition,
  // resolve the atoms cache-first (IndexedDB → localStorage → network), then seed.
  void Promise.all([customElements.whenDefined("field-root"), getAtoms(atomsUrl)]).then(
    ([, atoms]) => {
      if (!disposed && atoms.length) {
        field.seed?.(atoms);
        atomsReady = true;
        inviteOneParticle();
      }
    },
  );

  // a pinned inspector card — opens on click (after a dwell focuses a dot), never on plain hover.
  const card = document.createElement("div");
  card.className = "atom-card";
  card.hidden = true;
  document.body.appendChild(card);
  const invitation = document.createElement("button");
  invitation.className = "atom-ring";
  invitation.type = "button";
  invitation.hidden = true;
  invitation.setAttribute("aria-label", "Inspect a field particle");
  document.body.appendChild(invitation);
  const inviteCopy = document.querySelector<HTMLElement>("[data-atom-invite]");

  const ac = new AbortController();
  const root = document.documentElement;
  let focused: Atom | null = null;
  let dwell = 0;
  let open = false;
  let invitationActive = false;
  let inviteTimer = 0;

  const inviteOneParticle = (): void => {
    if (!dataRegion || !dataVisible || !atomsReady || dataUnlocked || !field.readParticles || !field.focusAt) return;
    const rect = dataRegion.getBoundingClientRect();
    const left = Math.max(0, rect.left);
    const right = Math.min(window.innerWidth, rect.right);
    const top = Math.max(0, rect.top);
    const bottom = Math.min(window.innerHeight, rect.bottom);
    if (right <= left || bottom <= top) return;
    const x0 = (left + right) / 2;
    const y0 = (top + bottom) / 2;
    const labels = [...dataRegion.querySelectorAll<HTMLElement>(".claim")].map((el) => el.getBoundingClientRect());
    const count = field.particleCount?.() ?? 0;
    if (!count) return;
    const points = new Float32Array(count * 5);
    const n = field.readParticles(points);
    let x = x0;
    let y = y0;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      const px = points[i * 5]!;
      const py = points[i * 5 + 1]!;
      if (px < left || px > right || py < top || py > bottom) continue;
      if (labels.some((r) => px >= r.left - 24 && px <= r.right + 24 && py >= r.top - 24 && py <= r.bottom + 24)) continue;
      const d = (px - x0) ** 2 + (py - y0) ** 2;
      if (d < best) { best = d; x = px; y = py; }
    }
    const atom = field.focusAt(x, y);
    if (!atom) return;
    const heldCount = field.readParticles(points);
    let heldX = x;
    let heldY = y;
    let heldDistance = Infinity;
    for (let i = 0; i < heldCount; i++) {
      const px = points[i * 5]!;
      const py = points[i * 5 + 1]!;
      const distance = (px - x) ** 2 + (py - y) ** 2;
      if (distance < heldDistance) {
        heldDistance = distance;
        heldX = px;
        heldY = py;
      }
    }
    x = heldX;
    y = heldY;
    focused = atom;
    dataUnlocked = true;
    invitationActive = true;
    invitation.setAttribute("aria-label", `Inspect ${atom.label}`);
    invitation.style.left = `${x}px`;
    invitation.style.top = `${y}px`;
    invitation.hidden = false;
    inviteCopy?.removeAttribute("hidden");
    root.classList.add("atom-armed");
  };

  const clearInvitation = (): void => {
    if (!invitationActive) return;
    invitationActive = false;
    invitation.hidden = true;
    inviteCopy?.setAttribute("hidden", "");
    release();
  };

  const scheduleInvitation = (): void => {
    if (!dataVisible || dataUnlocked) return;
    window.clearTimeout(inviteTimer);
    inviteTimer = window.setTimeout(inviteOneParticle, 180);
  };

  const release = (): void => {
    if (!focused) return;
    field.clearFocus?.();
    focused = null;
    root.classList.remove("atom-armed");
  };
  const close = (): void => {
    open = false;
    card.hidden = true;
    invitation.hidden = true;
    inviteCopy?.setAttribute("hidden", "");
    release();
  };

  // hover + settle: only when the pointer pauses near a dot does the engine hold + light it (the
  // affordance). Plain movement does nothing — no tooltip in the way.
  const onMove = (e: PointerEvent): void => {
    if (open || !dataUnlocked || invitationActive) return; // keep the first data particle held for its invitation
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
    if (!dataUnlocked || !focused || (invitationActive && e.target !== invitation)) return;
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
    invitationActive = false;
    invitation.hidden = true;
    inviteCopy?.setAttribute("hidden", "");
  };

  const dataObserver = dataRegion && new IntersectionObserver((entries) => {
    const entry = entries.find((item) => item.target === dataRegion);
    if (!entry) return;
    dataVisible = entry.isIntersecting;
    if (dataVisible) scheduleInvitation();
    else if (invitationActive) clearInvitation();
  }, { threshold: 0.12 });
  if (dataRegion && dataObserver) dataObserver.observe(dataRegion);

  // The evidence section often enters view while smooth anchor scrolling is still underway.
  // Wait for the viewport to settle before freezing a particle, so its ring lands in the plane.
  window.addEventListener("scroll", () => {
    if (!invitationActive && dataVisible && !dataUnlocked) scheduleInvitation();
  }, { signal: ac.signal, passive: true });

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
    dataObserver?.disconnect();
    window.clearTimeout(inviteTimer);
    clearTimeout(dwell);
    field.clearFocus?.();
    root.classList.remove("atom-armed");
    invitation.remove();
    card.remove();
  };
}
