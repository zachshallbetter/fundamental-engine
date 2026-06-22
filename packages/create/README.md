# @fundamental-engine/create

Scaffold a [Fundamental](https://fundamental-engine.com) starter in one command:

```bash
npm create @fundamental-engine my-field-app
# or pick the variant up front:
npm create @fundamental-engine my-field-app -- --template react
```

Three variants, all **signals-first** (the field draws nothing by default — it writes `--field-*` CSS
variables your styles read; particles are one opt-in surface):

- **`vanilla`** (default) — a *contained, signals-only* field (`FieldField` + `bounds`, `render: 'none'`)
  over a real list. No canvas; the rows react through CSS. The "this is what it's for" starter.
- **`web-component`** — the `<field-root>` custom element; works in any framework or plain HTML.
- **`react`** — `<FieldField>` from `@fundamental-engine/react`.

Each scaffolds a minimal Vite app you run with `npm install && npm run dev`. Every template is explicit
about `render`, so it behaves the same whichever engine version it resolves to.

Run with no arguments for an interactive prompt (directory + template).
