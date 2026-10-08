/**
 * Builds public/models/socialhat.glb from the Blender export at the repo root.
 *
 * The export is 762k triangles and 61MB, and almost none of that is the set:
 * the eight sculpted figures carry 90–110k triangles each, against a few
 * hundred for every platform and prop. Read on screen they are clay mannequins
 * a few hundred pixels tall, so they are simplified hard; everything else is
 * left exactly as authored. Then the whole file is Draco-encoded.
 *
 * Textures (~3MB, all on the two laptops) pass through untouched.
 *
 *   node scripts/optimize-model.mjs [--if-missing]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, draco, normals, prune, simplifyPrimitive, weld } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import draco3d from 'draco3dgltf'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(root, 'socialhat.glb')
const OUT = path.join(root, 'public', 'models', 'socialhat.glb')

/** Any primitive heavier than this is a figure, and gets simplified. */
const HEAVY_TRIANGLES = 20000
/** Fraction of triangles a figure keeps. 0.1 of ~100k is still a smooth body. */
const RATIO = 0.1
/** Ceiling on the deviation the simplifier may introduce, relative to mesh size. */
const ERROR = 0.002

const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB'

const triangles = (document) => {
  let count = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices()
      count += (indices ? indices.getCount() : prim.getAttribute('POSITION').getCount()) / 3
    }
  }
  return Math.round(count)
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`[model] missing source: ${path.relative(root, SRC)}`)
    process.exit(1)
  }
  if (process.argv.includes('--if-missing') && fs.existsSync(OUT)) {
    if (fs.statSync(OUT).mtimeMs >= fs.statSync(SRC).mtimeMs) {
      console.log('[model] socialhat.glb is up to date, skipping.')
      return
    }
  }

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    })

  console.log(`[model] reading ${path.relative(root, SRC)} (${mb(fs.statSync(SRC).size)})…`)
  const document = await io.read(SRC)
  const before = triangles(document)

  // The figures are exported flat-shaded: every triangle owns three vertices
  // with its own face normal, so no two triangles share an edge and the
  // simplifier has nothing it is allowed to collapse. Dropping the normals lets
  // weld() stitch them back into one surface; smooth normals are regenerated
  // afterwards, which is also the soft clay look the scene wants.
  const heavy = []
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices()
      if (indices && indices.getCount() / 3 >= HEAVY_TRIANGLES) heavy.push(prim)
    }
  }
  for (const prim of heavy) prim.setAttribute('NORMAL', null)

  await document.transform(dedup(), weld())

  await MeshoptSimplifier.ready
  for (const prim of heavy) {
    simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: RATIO, error: ERROR })
  }

  await document.transform(
    normals({ overwrite: false }),
    prune(),
    draco({
      method: 'edgebreaker',
      quantizePosition: 14,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
      quantizeColor: 8,
      quantizeGeneric: 12,
    }),
  )

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  await io.write(OUT, document)

  console.log(`[model] ${before.toLocaleString()} → ${triangles(document).toLocaleString()} triangles`)
  console.log(`[model] wrote ${path.relative(root, OUT)} (${mb(fs.statSync(OUT).size)})`)
}

main().catch((err) => {
  console.error('[model]', err)
  process.exit(1)
})
