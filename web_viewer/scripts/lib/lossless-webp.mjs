import sharp from 'sharp'

/**
 * Encodes a PNG to lossless WebP, zeroing the RGB of fully transparent pixels.
 *
 * Completely transparent pixels cannot be seen, but encoders and GPU edge
 * sampling still read their RGB, which surfaces as red fringing, white halos
 * and black hair edges on alpha-tested art. Only `alpha === 0` is rewritten;
 * partial alpha is preserved exactly so half-transparent highlights are not
 * disturbed. Dimensions are never resampled.
 */
export async function encodeLosslessWebp({ source, target }) {
  const sourceMeta = await sharp(source, { failOn: 'error' }).metadata()
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  if (info.channels !== 4) throw new Error(`Expected RGBA after ensureAlpha: ${source}`)
  if (sourceMeta.width !== info.width || sourceMeta.height !== info.height) {
    throw new Error(`Raw decode changed dimensions: ${source}`)
  }

  let cleared = 0
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] === 0 && (data[offset] || data[offset + 1] || data[offset + 2])) {
      data[offset] = 0
      data[offset + 1] = 0
      data[offset + 2] = 0
      cleared++
    }
  }

  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ lossless: true, effort: 6 })
    .toFile(target)

  const outputMeta = await sharp(target, { failOn: 'error' }).metadata()
  if (outputMeta.format !== 'webp') throw new Error(`Expected webp output: ${target}`)
  if (outputMeta.width !== info.width || outputMeta.height !== info.height) {
    throw new Error(`WebP dimension mismatch for ${source}: ${outputMeta.width}x${outputMeta.height} != ${info.width}x${info.height}`)
  }
  return { width: info.width, height: info.height, alphaClearedPixels: cleared }
}

/**
 * Runs jobs through a fixed pool. Sharp is already multi-threaded, so the pool
 * only needs to keep the pipeline fed; large concurrency multiplies peak RSS
 * across several RGBA buffers at once.
 */
export async function runPool(items, limit, worker) {
  const results = new Array(items.length)
  let next = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return results
}
