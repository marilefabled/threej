import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Honor the PORT the preview/host assigns (falls back to 5173 locally)
  server: { port: Number(process.env.PORT) || 5173, strictPort: false },
  // rapier3d-compat inlines its WASM (base64) — no special plugin needed, but
  // keep it out of the dep pre-bundler which can choke on the inlined binary.
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },

  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // Don't inject the SW registration into index.html in Electron builds.
      // The service worker simply won't register on file:// (silent fail), so
      // it's safe to leave this in the single shared vite.config.ts.
      manifest: {
        name: 'ThreeJ Engine',
        short_name: 'ThreeJ',
        description: 'Reusable 3D game engine — robot demo',
        theme_color:      '#07070f',
        background_color: '#07070f',
        display: 'standalone',
        orientation: 'landscape',
        // Replace with real icons before shipping: 192×192 and 512×512 PNGs.
        // Drop them in public/ and update these paths.
        icons: [
          { src: 'pwa-192.png',  sizes: '192x192',  type: 'image/png' },
          { src: 'pwa-512.png',  sizes: '512x512',  type: 'image/png' },
          { src: 'pwa-512.png',  sizes: '512x512',  type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Cache all versioned assets (hashed filenames → safe CacheFirst).
        globPatterns: ['**/*.{js,css,html,wasm}'],
        // The Rapier WASM blob is large but has a hashed name — cache it
        // aggressively; it changes only when the physics version bumps.
        runtimeCaching: [{
          urlPattern: /\/assets\/rapier-.+\.js$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'rapier-cache',
            expiration: { maxAgeSeconds: 60 * 60 * 24 * 90 },
          },
        }],
      },
    }),
  ],

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
})
