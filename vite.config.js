import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // scene.glb lives in public/, so it is served and copied verbatim rather than
  // being pulled through the asset pipeline and hashed. Nothing to configure.
  server: { open: true },
})
