import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative so the build works both at a domain root and under a GitHub Pages
  // project path (/socialhat/). Absolute '/assets/...' would resolve against the
  // origin root and 404 there. Safe here because the site is a single page with
  // no client-side routing, so every document sits at the same depth.
  base: './',
  // scene.glb lives in public/, so it is served and copied verbatim rather than
  // being pulled through the asset pipeline and hashed. Nothing to configure.
  server: { open: true },
})
