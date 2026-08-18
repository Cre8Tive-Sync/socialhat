import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  plugins: [react()],
  // Relative so the build works both at a domain root and under a GitHub Pages
  // project path (/socialhat/). Absolute '/assets/...' would resolve against the
  // origin root and 404 there. Safe here because the site is a single page with
  // no client-side routing, so every document sits at the same depth.
  base: './',
  define: { __MODEL_MB__: JSON.stringify(modelMB) },
  // scene.glb lives in public/, so it is served and copied verbatim rather than
  // being pulled through the asset pipeline and hashed. Nothing to configure.
  server: { open: true },
})
