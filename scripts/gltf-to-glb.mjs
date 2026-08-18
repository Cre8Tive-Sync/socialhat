/**
 * Packs a .gltf with embedded base64 data URIs into a binary .glb.
 *
 * The source scene.gltf stores its 56MB geometry buffer plus 13 textures as
 * base64 data URIs, which inflates them ~33% and forces the browser to parse
 * one enormous JSON string and atob() it before anything can render. A .glb
 * carries the same bytes raw, so it downloads smaller and decodes instantly.
 *
 * Zero dependencies — just the glTF 2.0 container spec.
 *
 *   node scripts/gltf-to-glb.mjs [--if-missing]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(root, 'scene.gltf')
const OUT = path.join(root, 'public', 'models', 'scene.glb')

const GLB_MAGIC = 0x46546c67 // 'glTF'
const CHUNK_JSON = 0x4e4f534a // 'JSON'
const CHUNK_BIN = 0x004e4942 // 'BIN\0'

const pad4 = (n) => (n + 3) & ~3
const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB'

function decodeDataURI(uri) {
  const comma = uri.indexOf(',')
  if (!uri.startsWith('data:') || comma === -1) return null
  const meta = uri.slice(5, comma)
  if (!meta.endsWith(';base64')) return null
  return {
    mimeType: meta.slice(0, -';base64'.length) || 'application/octet-stream',
    data: Buffer.from(uri.slice(comma + 1), 'base64'),
  }
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`[gltf-to-glb] missing source: ${path.relative(root, SRC)}`)
    process.exit(1)
  }
  if (process.argv.includes('--if-missing') && fs.existsSync(OUT)) {
    if (fs.statSync(OUT).mtimeMs >= fs.statSync(SRC).mtimeMs) {
      console.log('[gltf-to-glb] scene.glb is up to date, skipping.')
      return
    }
  }

  const srcSize = fs.statSync(SRC).size
  console.log(`[gltf-to-glb] reading ${path.relative(root, SRC)} (${mb(srcSize)})…`)
  const gltf = JSON.parse(fs.readFileSync(SRC, 'utf8'))

  // ---- 1. Flatten every buffer into one contiguous BIN chunk ----------------
  const chunks = []
  let binLength = 0
  const bufferOffsets = gltf.buffers.map((buffer, i) => {
    if (!buffer.uri) throw new Error(`buffer ${i} has no uri (already binary?)`)
    const decoded = decodeDataURI(buffer.uri)
    if (!decoded) throw new Error(`buffer ${i} uri is an external file, not a data URI`)
    const offset = binLength
    chunks.push(decoded.data)
    binLength += decoded.data.length
    const padding = pad4(binLength) - binLength
    if (padding) { chunks.push(Buffer.alloc(padding)); binLength += padding }
    delete buffer.uri
    return offset
  })

  // Rebase existing views onto the merged buffer.
  for (const view of gltf.bufferViews ?? []) {
    view.byteOffset = (view.byteOffset ?? 0) + bufferOffsets[view.buffer ?? 0]
    view.buffer = 0
  }

  // ---- 2. Move embedded images into the BIN chunk too ----------------------
  let imagesPacked = 0
  for (const image of gltf.images ?? []) {
    if (!image.uri) continue
    const decoded = decodeDataURI(image.uri)
    if (!decoded) continue // external file reference; leave it alone
    const byteOffset = binLength
    chunks.push(decoded.data)
    binLength += decoded.data.length
    const padding = pad4(binLength) - binLength
    if (padding) { chunks.push(Buffer.alloc(padding)); binLength += padding }

    gltf.bufferViews ??= []
    image.bufferView = gltf.bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: decoded.data.length,
    }) - 1
    image.mimeType ??= decoded.mimeType
    delete image.uri
    imagesPacked++
  }

  gltf.buffers = [{ byteLength: binLength }]

  // ---- 3. Write the GLB container -----------------------------------------
  const bin = Buffer.concat(chunks, binLength)
  const jsonRaw = Buffer.from(JSON.stringify(gltf), 'utf8')
  const jsonPadded = Buffer.alloc(pad4(jsonRaw.length), 0x20) // spec: pad JSON with spaces
  jsonRaw.copy(jsonPadded)

  const total = 12 + 8 + jsonPadded.length + 8 + bin.length
  const glb = Buffer.alloc(total)
  let p = 0
  glb.writeUInt32LE(GLB_MAGIC, p); p += 4
  glb.writeUInt32LE(2, p); p += 4
  glb.writeUInt32LE(total, p); p += 4
  glb.writeUInt32LE(jsonPadded.length, p); p += 4
  glb.writeUInt32LE(CHUNK_JSON, p); p += 4
  jsonPadded.copy(glb, p); p += jsonPadded.length
  glb.writeUInt32LE(bin.length, p); p += 4
  glb.writeUInt32LE(CHUNK_BIN, p); p += 4
  bin.copy(glb, p)

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, glb)

  const saved = ((1 - total / srcSize) * 100).toFixed(0)
  console.log(`[gltf-to-glb] packed ${imagesPacked} textures + ${mb(bin.length)} of buffer data`)
  console.log(`[gltf-to-glb] wrote ${path.relative(root, OUT)} (${mb(total)}, ${saved}% smaller)`)
}

main()
