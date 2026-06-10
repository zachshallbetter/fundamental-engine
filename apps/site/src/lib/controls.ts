// The example family's control wiring — the segment group (eleven aria-pressed sync copies)
// and the field on/off switch (eleven copies). Pure wiring; the page owns the semantics.

/**
 * Wire an ev-seg segment group: clicking a button syncs aria-pressed across the group and
 * calls `onPick` with the button's dataset value for `key` (e.g. key "evWeight" reads
 * data-ev-weight). Returns the currently-pressed value reader. Listeners bind under
 * `signal` (the page runtime's AbortController).
 */
export function wireSegments(
  buttons: readonly HTMLButtonElement[],
  key: string,
  onPick: (value: string, button: HTMLButtonElement) => void,
  signal: AbortSignal,
): () => string | undefined {
  for (const b of buttons) {
    b.addEventListener(
      "click",
      () => {
        for (const x of buttons) x.setAttribute("aria-pressed", String(x === b));
        onPick(b.dataset[key] ?? "", b);
      },
      { signal },
    );
  }
  return () => buttons.find((b) => b.getAttribute("aria-pressed") === "true")?.dataset[key];
}

/**
 * Wire the family's field on/off switch: toggles `data-field` on `main`, flips
 * aria-pressed and the dot label, and calls `onChange(on)` — the page rebuilds or
 * destroys its scoped field there.
 */
export function wireFieldToggle(
  btn: HTMLButtonElement | null,
  main: HTMLElement,
  onChange: (on: boolean) => void,
  signal: AbortSignal,
): void {
  if (!btn) return;
  btn.addEventListener(
    "click",
    () => {
      const on = main.dataset.field !== "on" ? true : false;
      main.dataset.field = on ? "on" : "off";
      btn.setAttribute("aria-pressed", String(on));
      const txt = btn.querySelector(".ev-switch-txt");
      if (txt) txt.textContent = on ? "on" : "off";
      onChange(on);
    },
    { signal },
  );
}
