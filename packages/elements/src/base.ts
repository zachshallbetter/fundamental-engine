/**
 * SSR-safe `HTMLElement` base. In the browser it is the real `HTMLElement`; under Node — an SSR
 * pass, a build step, or the dist smoke check — it is an inert stand-in, so merely *importing*
 * the package never throws `HTMLElement is not defined`. The elements only do anything once a
 * browser upgrades them (every `customElements.define` is guarded too), so the stand-in is never
 * constructed.
 */
export const HTMLElementBase: typeof HTMLElement =
  typeof HTMLElement !== 'undefined'
    ? HTMLElement
    : (class {} as unknown as typeof HTMLElement);
