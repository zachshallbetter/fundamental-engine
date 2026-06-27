# Fundamental × Astro

Shows how to use `@fundamental-engine/vanilla` inside an Astro project.

## The pattern

Astro's `<script>` tags always run client-side — no special guards needed. Import the engine there and it works:

```astro
---
// Server-side frontmatter (no engine imports here)
---
<canvas id="field"></canvas>
<script>
  import { createField } from '@fundamental-engine/vanilla';
  const canvas = document.getElementById('field');
  createField(canvas, { render: 'dots' });
</script>
```

Astro bundles the `<script>` with Vite and ships it as a client module. The `.astro` component's frontmatter (`---`) runs on the server and never touches the engine.

## Run it

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # static output → dist/
npm run preview   # serve dist/ locally
```

## Dependencies

| Package | Version |
|---|---|
| `@fundamental-engine/vanilla` | `^0.9.0` |
| `astro` | `^5` |
