import { defineConfig } from 'vite';

// The Fundamental packages ship plain ESM, so an outside project just installs and imports them.
// This config only pins a predictable port for dev + preview.
export default defineConfig({
  server: { port: 5190 },
  preview: { port: 5190 },
});
