# Fundamental × SvelteKit

Shows how to use `@fundamental-engine/vanilla` inside a SvelteKit project without SSR errors.

## The pattern

Import the engine dynamically inside `onMount()` — SvelteKit never runs `onMount` during SSR:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  let canvas: HTMLCanvasElement;

  onMount(async () => {
    const { createField } = await import('@fundamental-engine/vanilla');
    createField(canvas, { render: 'dots' });
  });
</script>

<canvas bind:this={canvas}></canvas>
```

This project uses `@sveltejs/adapter-static` for the CI build; swap it for `adapter-node` or `adapter-auto` for a real SSR deployment.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static output → build/
npm run preview   # serve build/ locally
```

## Dependencies

| Package | Version |
|---|---|
| `@fundamental-engine/vanilla` | `^0.9.0` |
| `@sveltejs/kit` | `^2` |
| `svelte` | `^5` |
