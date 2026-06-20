import { defineConfig } from 'vite';

export default defineConfig({
  // Honor the PORT the preview/host assigns (falls back to 5173 locally)
  server: { port: Number(process.env.PORT) || 5173, strictPort: false },
  // rapier3d-compat inlines its WASM (base64) — no special plugin needed, but
  // keep it out of the dep pre-bundler which can choke on the inlined binary.
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
});
