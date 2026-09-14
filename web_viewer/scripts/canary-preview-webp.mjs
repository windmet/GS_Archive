import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodeLosslessWebp, shutdownEncoderPool } from './lib/lossless-webp.mjs'
import { resolvePreviewObjectKey } from '../shared/deploy/PreviewAssetTransform.js'

/**
 * Canary gate for the lossless WebP encoder.
 *
 * Encodes ONE source PNG with the historical pipeline and proves the pixel
 * contract against the source before anything is uploaded:
 *
 *   - dimensions identical
 *   - alpha byte-identical
 *   - every pixel with alpha > 0 has byte-identical RGB
 *   - every pixel with alpha === 0 decodes to exactly (0, 0, 0)
 *
 * The last two are the whole point: lossless means visible pixels cannot move,
 * and the encoder's `exact` flag is what stops libwebp re-spreading colour back
 * into the transparent pixels the cleanup just zeroed.
 *
 * Usage: node scripts/canary-preview-webp.mjs <source.png> [more.png ...]
 *   Writes each object to .deploy/r2/<object_key> and prints the keys to
 *   .deploy/canary-object-keys.txt for a targeted rclone copy.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stageRoot = path.join(root, '.deploy', 'r2')
const keyListPath = path.join(root, '.deploy', 'canary-object-keys.txt')

const sources = process.argv.slice(2)
assert.ok(sources.length, 'Usage: node scripts/canary-preview-webp.mjs <source.png> [more.png ...]')

const decode = async file => {
  const { data, info } = await (await import('sharp')).default(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, info }
}

const objectKeys = []
let failed = false

for (const sourceArg of sources) {
  const source = path.resolve(root, sourceArg)
  // The transform policy keys off the runtime URL, which is rooted at the
  // deployed prefix (`/assets/...`), not at the `public/` directory the file
  // happens to live in locally. Feeding it the filesystem-relative path would
  // yield `/public/assets/...` and stage the object under a key no request
  // ever resolves to.
  const relative = path.relative(path.join(root, 'public'), source).replaceAll('\\', '/')
  assert.ok(!relative.startsWith('..'), `${sourceArg} is outside public/ and has no runtime request key`)
  const requestKey = '/' + relative
  const objectKey = resolvePreviewObjectKey(requestKey)
  const target = path.join(stageRoot, ...objectKey.split('/'))

  const source_ = await decode(source)
  await encodeLosslessWebp({ source, target })
  const deployed = await decode(target)

  const label = path.basename(source)
  const problems = []

  if (deployed.info.width !== source_.info.width || deployed.info.height !== source_.info.height) {
    problems.push(`dimensions ${deployed.info.width}x${deployed.info.height} != ${source_.info.width}x${source_.info.height}`)
  }

  let alphaMismatches = 0
  let visibleMismatches = 0
  let transparentLeaks = 0
  let firstProblemPixel = null
  const pixels = source_.info.width * source_.info.height

  for (let offset = 0; offset < source_.data.length; offset += 4) {
    const alphaSource = source_.data[offset + 3]
    const alphaDeployed = deployed.data[offset + 3]
    if (alphaDeployed !== alphaSource) {
      alphaMismatches++
      firstProblemPixel ??= `pixel ${offset / 4}: alpha ${alphaDeployed} != ${alphaSource}`
      continue
    }
    if (alphaSource === 0) {
      if (deployed.data[offset] || deployed.data[offset + 1] || deployed.data[offset + 2]) {
        transparentLeaks++
        firstProblemPixel ??= `pixel ${offset / 4}: alpha 0 but RGB (${deployed.data[offset]}, ${deployed.data[offset + 1]}, ${deployed.data[offset + 2]})`
      }
      continue
    }
    for (let channel = 0; channel < 3; channel++) {
      if (deployed.data[offset + channel] !== source_.data[offset + channel]) {
        visibleMismatches++
        firstProblemPixel ??= `pixel ${offset / 4}: alpha ${alphaSource} channel ${channel} ${deployed.data[offset + channel]} != ${source_.data[offset + channel]}`
        break
      }
    }
  }

  if (alphaMismatches) problems.push(`${alphaMismatches} alpha mismatches`)
  if (visibleMismatches) problems.push(`${visibleMismatches} visible-RGB mismatches`)
  if (transparentLeaks) problems.push(`${transparentLeaks} transparent pixels with non-zero RGB`)

  const sourceBytes = (await fs.stat(source)).size
  const deployedBytes = (await fs.stat(target)).size

  console.log(`${problems.length ? 'FAIL' : 'PASS'}  ${label}`)
  console.log(`      ${source_.info.width}x${source_.info.height} RGBA, ${pixels.toLocaleString()} pixels`)
  console.log(`      alpha identical:            ${alphaMismatches === 0}`)
  console.log(`      alpha>0 RGB identical:      ${visibleMismatches === 0}`)
  console.log(`      alpha==0 RGB == (0,0,0):    ${transparentLeaks === 0}`)
  console.log(`      ${(sourceBytes / 1024 ** 2).toFixed(2)} MiB -> ${(deployedBytes / 1024 ** 2).toFixed(2)} MiB (${(deployedBytes / sourceBytes * 100).toFixed(1)}% retained)`)
  console.log(`      request key: ${requestKey}`)
  console.log(`      object key:  ${objectKey}`)
  if (problems.length) {
    console.log(`      PROBLEMS: ${problems.join('; ')}`)
    console.log(`      first: ${firstProblemPixel}`)
    failed = true
  }
  console.log()
  objectKeys.push(objectKey)
}

await fs.writeFile(keyListPath, objectKeys.join('\n') + '\n')
console.log(`Wrote ${objectKeys.length} object key(s) to ${path.relative(root, keyListPath)}`)
shutdownEncoderPool()
process.exit(failed ? 1 : 0)
