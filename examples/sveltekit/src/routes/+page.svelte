<script lang="ts">
  import { onMount } from 'svelte';
  import type { FieldHandle } from '@fundamental-engine/vanilla';

  let canvas: HTMLCanvasElement;
  let readout = '';

  onMount(async () => {
    // Dynamic import inside onMount() ensures the engine module is never
    // evaluated server-side — SvelteKit SSR never reaches here.
    const { createField } = await import('@fundamental-engine/vanilla');
    const field: FieldHandle = createField(canvas, { render: 'dots', density: 2 });

    // Expose for smoke tests / DevTools.
    (globalThis as unknown as { field: FieldHandle }).field = field;

    const loop = () => {
      readout = `v${field.version} · ${field.particleCount()} particles`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
</script>

<svelte:head>
  <title>Fundamental × SvelteKit</title>
</svelte:head>

<canvas bind:this={canvas} class="field-canvas"></canvas>

<main>
  <h1 data-body="gravity" data-strength="1" data-range="360" data-feedback>
    Fundamental
  </h1>
  <p>
    A reciprocal DOM-physics field inside a SvelteKit project. The engine is
    loaded with a dynamic import inside <code>onMount()</code> — never runs
    during SSR.
  </p>
  <nav>
    <a href="/" data-body="attract" data-strength="0.9" data-range="300" data-feedback>
      pull me
    </a>
    <a href="/" data-body="charge" data-strength="0.8" data-range="260" data-feedback>
      charge me
    </a>
  </nav>
  <span class="readout">{readout}</span>
</main>

<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :global(body) { font-family: system-ui, sans-serif; background: #0a0a0f; color: #e8e8f0; }
  .field-canvas { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  main { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 1rem; padding: 2rem; }
  h1 { font-size: clamp(2rem, 6vw, 4rem); font-weight: 700; letter-spacing: -0.02em; }
  p { max-width: 38ch; text-align: center; color: #8888aa; line-height: 1.6; }
  nav { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; }
  a { padding: 0.5rem 1.25rem; border-radius: 0.5rem; border: 1px solid #333360; color: inherit; text-decoration: none; }
  .readout { font-size: 0.75rem; color: #55557a; font-variant-numeric: tabular-nums; }
</style>
