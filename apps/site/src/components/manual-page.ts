// Shared page orchestrator for the Field Manual pages (/ and /eli5). Wires the interaction runtime,
// the field-line overlay, and the natural-field picker — and, crucially, tears them down on
// navigation. Each module returns a teardown; we run init on astro:page-load (re-init when
// navigating back) and teardown on astro:before-swap (so listeners, observers, and overlay canvases
// never survive a client-side navigation away). init() tears the previous run down first, so it
// can't double-bind. The `.manual-shell` guard keeps the persisted listeners from firing elsewhere.
//
// Pages opt in with a single side-effect import:  import "../components/manual-page.ts";
import { initHomeRuntime } from "./home/HomeRuntime.ts";
import { initStageFieldOverlay } from "./home/StageFieldOverlay.ts";
import { initForcePicker } from "./home/ForcePicker.ts";
import { initGallery } from "./home/GalleryRuntime.ts";

let teardownRuntime: (() => void) | undefined;
let teardownOverlay: (() => void) | undefined;
let teardownForces: (() => void) | undefined;
let teardownGallery: (() => void) | undefined;

function teardown() {
  teardownRuntime?.();
  teardownOverlay?.();
  teardownForces?.();
  teardownGallery?.();
  teardownRuntime = undefined;
  teardownOverlay = undefined;
  teardownForces = undefined;
  teardownGallery = undefined;
}

function init() {
  teardown(); // idempotent: drop any prior run before re-wiring
  if (!document.querySelector(".manual-shell")) return;
  teardownRuntime = initHomeRuntime();
  teardownOverlay = initStageFieldOverlay();
  teardownForces = initForcePicker(); // NaturalFieldsSection — pick a field, play it on <field-root>
  teardownGallery = initGallery(); // "What it can do" gallery (home only; no-ops elsewhere)
}

if (document.readyState !== "loading") init();
else document.addEventListener("DOMContentLoaded", init);
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", teardown);
