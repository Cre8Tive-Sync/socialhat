import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { apiRoutes } from './vite-api-plugin.js'

const root = path.dirname(fileURLToPath(import.meta.url))

// Stamped into the loading curtain so the figure shown to a waiting visitor is
// measured rather than remembered. A hand-written one silently became a lie the
// moment the model was Draco-compressed, and there is no reason for the number
// to be maintained by a human at all. prebuild/predev generate the .glb before
// this config is read, so the file is there; 0 means someone ran vite directly
// and the curtain just omits the size.
const modelPath = path.join(root, 'public', 'models', 'scene.glb')
const modelMB = fs.existsSync(modelPath)
  ? Math.round(fs.statSync(modelPath).size / 1024 / 1024)
  : 0

export default defineConfig({
  // apiRoutes serves api/chat.js from the dev server; it is `apply: 'serve'`, so
  // it does nothing at build time — the host runs that file in production.
  plugins: [react(), apiRoutes()],
  // Relative so the build works both at a domain root and under a GitHub Pages
  // project path (/socialhat/). Absolute '/assets/...' would resolve against the
  // origin root and 404 there. Safe here because the site is a single page with
  // no client-side routing, so every document sits at the same depth.
  base: './',
  define: { __MODEL_MB__: JSON.stringify(modelMB) },
  // scene.glb lives in public/, so it is served and copied verbatim rather than
  // being pulled through the asset pipeline and hashed. Nothing to configure.
  server: { open: true },

  build: {
    // three, fiber and drei are the great bulk of the bundle and they change
    // when their versions change — which is to say, rarely. The site's own code
    // changes every deploy. Held in one file together, every copy edit expires
    // a megabyte of library a returning visitor already had; split, they are
    // fetched once and then served from cache across every deploy after.
    //
    // This does not make the first visit smaller. It makes the second one, and
    // every one after it, almost free.
    // Vite 8 bundles with rolldown, which takes only the function form here —
    // the object form it inherited from rollup throws "manualChunks is not a
    // function" at build time.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('three') || id.includes('@react-three')) return 'three'
          return undefined
        },
      },
    },
  },
})
