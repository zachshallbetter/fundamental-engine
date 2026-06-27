# Fundamental × Nuxt 3

Shows how to use `@fundamental-engine/vanilla` inside a Nuxt 3 project without SSR errors.

## The pattern

Import the engine dynamically inside `onMounted()` — Vue lifecycle hooks never run during SSR:

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';

const canvas = ref(null);

onMounted(async () => {
  const { createField } = await import('@fundamental-engine/vanilla');
  createField(canvas.value, { render: 'dots' });
});
</script>

<template>
  <canvas ref="canvas" />
</template>
```

This example uses `ssr: false` in `nuxt.config.ts` (SPA mode) for simplicity. For a real SSR deployment, set `ssr: true` — the `onMounted` guard still applies, and you can additionally wrap the canvas in `<ClientOnly>` for belt-and-suspenders safety.

## Run it

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # static output (nuxt generate) → .output/public/
npm run preview   # serve .output/public/ locally
```

## Dependencies

| Package | Version |
|---|---|
| `@fundamental-engine/vanilla` | `^0.9.0` |
| `nuxt` | `^3` |
| `vue` | `^3` |
