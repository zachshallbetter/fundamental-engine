# field-app — React starter

A [Fundamental](https://fundamental-engine.com) starter using `<FieldField>` from
`@fundamental-engine/react`. Signals-first: the field draws nothing by default and writes `--field-*`
variables your CSS reads.

```bash
npm install
npm run dev
```

- `src/App.tsx` — drop in `<FieldField />`, mark elements `data-body data-feedback`; engagement is a
  `data-active` attribute set on hover/focus.
- `src/styles.css` — reads `--field-density` (`--d`) for weight, lift, glow.

Want particles? Pass `render="dots"` to `<FieldField />`. Prefer the handle? Use `useFieldField()`.
