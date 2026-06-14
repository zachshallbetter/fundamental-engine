// Custom Elements Manifest config for @fundamental-engine/elements.
//
// Generates `custom-elements.json` — the machine-readable description of the Fundamental custom
// elements (`<field-root>` / `<field-cell>` and their deprecated `forces-*` aliases): their
// attributes, properties, and methods. This is the standards-based counterpart to the shipped
// `.d.ts` types, consumed by editors (VS Code custom-data / web-types), Storybook, and other
// tooling. Regenerate with `pnpm gen:cem`; `pnpm check:cem` guards against drift.
export default {
  globs: ['src/**/*.ts'],
  exclude: ['src/**/*.test.ts'],
  outdir: '.',
  // Plain HTMLElement custom elements — no framework plugin needed.
};
