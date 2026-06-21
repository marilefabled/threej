import { defineConfig } from 'vite';

export default defineConfig({
  // Honor the PORT the preview/host assigns (falls back to 5173 locally)
  server: { port: Number(process.env.PORT) || 5173, strictPort: false },
  // rapier3d-compat inlines its WASM (base64) — no special plugin needed, but
  // keep it out of the dep pre-bundler which can choke on the inlined binary.
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
  build: {
    // top-level await (Rapier WASM init) requires es2022+. All target browsers
    // have supported it since mid-2021 (Chrome 89, Firefox 89, Safari 15).
    target: 'es2022',
    rollupOptions: {
      output: {
        // Split heavy deps into their own cacheable chunks. Three.js alone is
        // ~700 kB; keeping it separate means rebuilds only re-download the
        // app chunk, not the whole bundle.
        manualChunks: {
          three:  ['three'],
          rapier: ['@dimforge/rapier3d-compat'],
          gsap:   ['gsap'],
          vendor: ['howler', 'lil-gui', 'miniplex', 'inkjs'],
        },
      },
    },
  },
});
