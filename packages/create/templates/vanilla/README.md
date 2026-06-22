# field-app — vanilla starter

A [Fundamental](https://fundamental-engine.com) starter: a **contained, signals-only** field over a real
list. No canvas, no particles — the field writes `--field-*` CSS variables and the list reacts.

```bash
npm install
npm run dev
```

- `src/main.ts` — `new FieldField({ bounds: list, render: 'none' })` scopes the field to the list and
  draws nothing; engagement (`data-active`) drives it live.
- `src/styles.css` — reads `--field-density` (`--d`) to turn density into weight, lift, and glow.

Want to see the particles? Change `render: 'none'` → `render: 'dots'` in `src/main.ts`.
