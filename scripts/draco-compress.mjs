/**
 * Draco-compresses the geometry inside public/models/scene.glb, in place.
 *
 * Run after gltf-to-glb.mjs. That script only changes the *container* — it
 * moves base64 data URIs into a binary chunk, which is why it stays dependency
 * free. This one changes the *encoding*: vertex positions, normals, UVs and
 * index lists are quantised and entropy-coded, which is where the real weight
 * is. In this scene geometry plus indices are ~88% of the file.
 *
 * Draco only touches mesh geometry. Textures (~7.6MB of PNG/JPEG here) pass
 * through untouched — shrinking those is a separate job, and would mean KTX2.
 *
 * The scene has no skins and no morph targets, so the usual Draco caveat —
 * quantisation pulling skinned vertices away from their bind pose — does not
 * apply. Animation is 3 camera channels and is not Draco's concern anyway.
 *
 *   node scripts/draco-compress.mjs [--if-missing]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions'
import { draco } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = path.join(root, 'public', 'models', 'scene.glb')

const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB'

async function main() {
  if (!fs.existsSync(FILE)) {
    console.error(`[draco] missing ${path.relative(root, FILE)} — run gltf-to-glb.mjs first`)
    process.exit(1)
  }

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    })

  const before = fs.statSync(FILE).size
  const document = await io.read(FILE)

  // Encoding an already-encoded file would decode and requantise it — lossy on
  // top of lossy. The extension list is the honest signal that we are done.
  const alreadyEncoded = document
    .getRoot()
    .listExtensionsUsed()
    .some((ext) => ext.extensionName === KHRDracoMeshCompression.EXTENSION_NAME)

  if (alreadyEncoded) {
    if (process.argv.includes('--if-missing')) {
      console.log(`[draco] scene.glb is already compressed (${mb(before)}), skipping.`)
      return
    }
    console.error('[draco] scene.glb is already compressed — re-run pack-model to rebuild it first')
    process.exit(1)
  }

  console.log(`[draco] compressing ${path.relative(root, FILE)} (${mb(before)})…`)

  await document.transform(
    draco({
      // Sequential preserves vertex order; edgebreaker reorders for a better
      // ratio. Nothing here indexes into the vertex arrays externally, so the
      // reordering is safe and worth the extra few MB.
      method: 'edgebreaker',
      // 14 bits of position precision over the model's bounding box. This is
      // three.js's own default and is visually lossless at any sane camera
      // distance; drop to 12 only if you measure and can live with the seams.
      quantizePosition: 14,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
      quantizeColor: 8,
      quantizeGeneric: 12,
    })
  )

  await io.write(FILE, document)

  const after = fs.statSync(FILE).size
  console.log(
    `[draco] wrote ${path.relative(root, FILE)} (${mb(after)}, ` +
      `${((1 - after / before) * 100).toFixed(0)}% smaller, ${(before / after).toFixed(1)}x)`
  )
}

main().catch((err) => {
  console.error('[draco]', err)
  process.exit(1)
})
