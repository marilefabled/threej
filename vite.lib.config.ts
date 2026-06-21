// Engine-only library build: npm run build:lib
// Outputs dist/engine/ as tree-shakable ES modules, one file per source module.
// All heavy deps (three, howler, gsap, …) are kept external so consuming projects
// don't double-bundle them.
//
//   npm run build:lib
//   → dist/engine/pool.js, dist/engine/events.js, …
//
// Usage in a new project (after copying or npm-linking):
//   import { createPool } from './engine/pool.js'
//   import { createEvents } from './engine/events.js'

import { resolve } from 'path';
import { defineConfig } from 'vite';

const EXTERNAL = [
  'three',
  'three/addons',
  /^three\//,
  'gsap',
  /^gsap\//,
  'howler',
  'lil-gui',
  'miniplex',
  'inkjs',
  /^inkjs\//,
  '@dimforge/rapier3d-compat',
];

export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'dist/engine',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/engine/index.ts'),
      formats: ['es'],
    },
    rollupOptions: {
      external: EXTERNAL,
      output: {
        // One output file per input module — fully tree-shakable, no barrel bloat.
        preserveModules: true,
        preserveModulesRoot: 'src/engine',
        entryFileNames: '[name].js',
      },
    },
  },
});
