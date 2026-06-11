// Writings shell runtime — the navigation sweep applied to the writings family, reusing the docs
// shell chrome (.docs-shell / .docs-sidebar / .docs-prevnext) and the shared nav-field helpers.
// All signals-only + reduced-motion-guarded; with the engine off the writings nav reads as plain
// links. (The writings sidebar reuses the docs sidebar's field CSS, gated by data-field-docs.)
import { pageRuntime } from "../lib/page-runtime.ts";
import { recordVisit, normRoute, applyNavField, reduceMotion } from "../lib/nav-field.ts";

function initWritingsShell(shell: HTMLElement): () => void {
  const side = shell.querySelector<HTMLElement>("#writingsSide");
  if (!side) return () => {}; // not a writings page (docs uses #docsSide + its own runtime)
  recordVisit(normRoute(location.pathname));

  const main = shell.querySelector<HTMLElement>("main.docs-content");
  // reuse the docs sidebar's field CSS gate; off under reduced motion → plain
  if (main) main.dataset.fieldDocs = reduceMotion() ? "off" : "on";

  const handles: Array<{ destroy(): void } | null> = [];
  // sidebar hierarchy → priority-well, the current article pinned as the well
  const current = side.querySelector<HTMLElement>('a[aria-current="page"]');
  handles.push(applyNavField(side, "priority-well", { pin: current }));
  // breadcrumbs + the prev/next series pager → navigation-current (visited ancestors tint)
  const bc = shell.querySelector<HTMLElement>("[data-breadcrumbs]");
  if (bc) handles.push(applyNavField(bc, "navigation-current", { markVisited: true }));
  const pager = shell.querySelector<HTMLElement>(".docs-prevnext");
  if (pager) handles.push(applyNavField(pager, "navigation-current", { markVisited: true }));

  return () => {
    for (const h of handles) h?.destroy();
    if (main) delete main.dataset.fieldDocs;
  };
}

pageRuntime(".docs-shell", initWritingsShell);
