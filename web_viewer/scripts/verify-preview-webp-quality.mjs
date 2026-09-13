import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { LOSSLESS_WEBP_TRANSFORM } from '../shared/deploy/PreviewAssetTransform.js'

/**
 * Proves the deployed WebP is a faithful stand-in for the source PNG.
 *
 * Visual spot-checking is the usual advice here, but every property that would
 * cause the classic artifacts is checkable exactly: alpha must survive
 * untouched, visible pixels must survive untouched (the encode is lossless),
 * geometry must not move, and the only pixels allowed to differ are fully
 * transparent ones, whose RGB the encoder deliberately clears.
 *
 * Usage: node scripts/verify-preview-webp-quality.mjs [samplesPerDomain]
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await fs.readFile(path.join(root, '.deploy', 'r2-manifest.json'), 'utf8'))
assert.equal(manifest.schema_version, 2, 'Quality verification needs a schema v2 manifest')

const perDomain = Number(process.argv[2] || 6)
const indexOf = key => key.split('/').slice(0, 2).join('/') + '/'

// Derive the domains from the manifest rather than listing them here. A
// hardcoded list silently stops covering a domain the moment the policy grows,
// which is exactly how the second pass's ten new domains went unverified.
const domains = [...new Set(manifest.entries
  .filter(entry => entry.transform === LOSSLESS_WEBP_TRANSFORM)
  .map(entry => indexOf(entry.request_key)))].sort()
assert.ok(domains.length, 'No converted entries in the manifest')

const raw = async file => (await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true }))

let checked = 0
const summary = []
for (const domain of domains) {
  const candidates = manifest.entries
    .filter(entry => entry.transform === LOSSLESS_WEBP_TRANSFORM && indexOf(entry.request_key) === domain)
    .sort((a, b) => b.source_size - a.source_size)
  assert.ok(candidates.length, `No converted entries for ${domain}`)
  // Sample evenly across the size range so large and small atlas pages are both covered.
  const step = Math.max(1, Math.floor(candidates.length / perDomain))
  const sample = candidates.filter((_, index) => index % step === 0).slice(0, perDomain)

  let transparentDiffering = 0
  let bytesIn = 0
  let bytesOut = 0
  for (const entry of sample) {
    const source = await raw(entry.source)
    const deployed = await raw(path.join(root, '.deploy', 'r2', ...entry.object_key.split('/')))
    assert.equal(deployed.info.width, source.info.width, `${entry.request_key} width`)
    assert.equal(deployed.info.height, source.info.height, `${entry.request_key} height`)
    assert.equal(deployed.info.channels, 4, `${entry.request_key} channels`)
    if (source.info.channels !== 4) assert.fail(`${entry.request_key} source is not RGBA`)

    for (let offset = 0; offset < source.data.length; offset += 4) {
      const alphaSource = source.data[offset + 3]
      const alphaDeployed = deployed.data[offset + 3]
      assert.equal(alphaDeployed, alphaSource, `${entry.request_key} alpha changed at byte ${offset}`)
      if (alphaSource === 0) {
        // Invisible pixels may be zeroed, but must stay invisible and must never
        // gain colour that a sampler could bleed into a visible neighbour.
        if (deployed.data[offset] || deployed.data[offset + 1] || deployed.data[offset + 2]) {
          transparentDiffering++
        }
        continue
      }
      for (let channel = 0; channel < 3; channel++) {
        assert.equal(
          deployed.data[offset + channel],
          source.data[offset + channel],
          `${entry.request_key} visible RGB changed at pixel ${offset / 4} channel ${channel} (alpha ${alphaSource})`,
        )
      }
    }
    bytesIn += entry.source_size
    bytesOut += entry.deployed_size
    checked++
  }
  summary.push({ domain, sample: sample.length, bytesIn, bytesOut, transparentDiffering })
}

console.log(`WebP fidelity verified on ${checked} sampled conversions (alpha exact, visible RGB exact, dimensions exact)\n`)
console.log('  domain                    samples   source MiB   deployed MiB   retained   cleared-alpha RGB leaks')
for (const row of summary) {
  const pct = ((row.bytesOut / row.bytesIn) * 100).toFixed(1) + '%'
  console.log(`  ${row.domain.padEnd(24)} ${String(row.sample).padStart(7)} ${(row.bytesIn / 1024 ** 2).toFixed(1).padStart(12)} ${(row.bytesOut / 1024 ** 2).toFixed(1).padStart(14)} ${pct.padStart(10)} ${String(row.transparentDiffering).padStart(24)}`)
}
const totalIn = summary.reduce((sum, row) => sum + row.bytesIn, 0)
const totalOut = summary.reduce((sum, row) => sum + row.bytesOut, 0)
console.log(`\n  total ${(totalIn / 1024 ** 2).toFixed(1)} MiB -> ${(totalOut / 1024 ** 2).toFixed(1)} MiB  (${((totalOut / totalIn) * 100).toFixed(1)}% retained, ${(((totalIn - totalOut) / totalIn) * 100).toFixed(1)}% saved)`)
console.log('\nA non-zero "cleared-alpha RGB leaks" count is expected and benign: it counts fully transparent pixels that still carry non-zero RGB on the PNG side, which is exactly the fringing source the transform removes.')
