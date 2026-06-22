# field-app — web-component starter

A [Fundamental](https://fundamental-engine.com) starter using the `<field-root>` custom element — works
in any framework or plain HTML. Signals-first: the field draws nothing by default and writes `--field-*`
variables your CSS reads.

```bash
npm install
npm run dev
```

- `index.html` — drop in `<field-root>`, mark elements `[data-body] [data-feedback]`.
- `src/main.ts` — importing `@fundamental-engine/elements` is the whole wiring; it registers the element.
- `src/styles.css` — reads `--field-density` (`--d`) for weight + glow.

Want particles? Add `render="dots"` to `<field-root>`.
