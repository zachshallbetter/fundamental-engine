import { defineConfig } from 'vite';

// Nothing field-ui-specific is needed: the packages ship plain ESM, so an outside project just
// installs them and imports. This config only pins a predictable dev port.
export default defineConfig({
  server: { port: 5180 },
  preview: { port: 5180 },
});
