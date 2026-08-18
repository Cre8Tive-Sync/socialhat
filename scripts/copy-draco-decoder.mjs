/**
 * Copies three's bundled Draco decoder into public/draco/.
 *
 * DRACOLoader fetches its decoder at runtime rather than bundling it, so the
 * files have to exist as static assets. drei's default is Google's gstatic CDN,
 * which means a third-party request on first paint and a decoder version that
 * drifts from whatever three we actually build against. Copying from
 * node_modules keeps the two in lockstep and keeps the site self-contained.
 *
 * The gltf/ variant is the one to use: it drops Draco's point-cloud and mesh
 * -editing paths, so the wasm is 192KB instead of 286KB.
 *
 *   node scripts/copy-draco-decoder.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const OUT = path.join(root, 'public', 'draco')

// three exports ./examples/jsm/*, so each file resolves by subpath. That works
// under pnpm and yarn layouts too, where node_modules/three is not a real path.
// draco_decoder.js is the asm.js fallback for browsers without WebAssembly —
// never fetched by a modern one, so it costs repo bytes and no request.
const FILES = ['draco_wasm_wrapper.js', 'draco_decoder.wasm', 'draco_decoder.js']
const subpath = (name) => `three/examples/jsm/libs/draco/gltf/${name}`

fs.mkdirSync(OUT, { recursive: true })

for (const name of FILES) {
  let from
  try {
    from = require.resolve(subpath(name))
  } catch {
    console.error(`[draco-decoder] three does not ship ${subpath(name)}`)
    process.exit(1)
  }
  fs.copyFileSync(from, path.join(OUT, name))
}

console.log(`[draco-decoder] copied ${FILES.length} files to public/draco/`)
