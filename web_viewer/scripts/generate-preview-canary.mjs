import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Builds the canary upload list for the Preview bucket.
 *
 * The list must contain OBJECT keys, not request keys: the whole point of the
 * transform layer is that these differ for converted domains. One member of
 * every transformed domain is included, alongside the untransformed controls,
 * so a single small upload exercises every branch of the routing policy.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await fs.readFile(path.join(root, '.deploy', 'r2-manifest.json'), 'utf8'))
assert.equal(manifest.schema_version, 2, 'Canary generation needs a schema v2 manifest')

const pick = (label, predicate) => {
  const entry = manifest.entries.filter(predicate).sort((a, b) => a.deployed_size - b.deployed_size)[0]
  assert.ok(entry, `Manifest has no canary candidate for ${label}`)
  return { label, entry }
}

// Smallest matching object per domain keeps the canary genuinely small.
const picks = [
  pick('card-art WebP', entry => entry.transform !== 'copy' && entry.request_key.startsWith('assets/card-art/')),
  // `comu` is the atlas page the runtime actually loads, so the canary exercises
  // the real Spine path rather than an incidental face or icon texture.
  pick('spine texture WebP', entry => entry.transform !== 'copy' && /^assets\/spines\/[^/]+\/comu\.png$/.test(entry.request_key)),
  pick('live-chibi WebP', entry => entry.transform !== 'copy' && entry.request_key.startsWith('assets/live-chibi/') && entry.request_key.endsWith('.png')),
  pick('background WebP', entry => entry.transform !== 'copy' && entry.request_key.startsWith('assets/bg/')),
  pick('cards icon WebP', entry => entry.transform !== 'copy' && entry.request_key.startsWith('assets/cards/')),
  pick('gasha WebP', entry => entry.transform !== 'copy' && entry.request_key.startsWith('assets/gasha/')),
  pick('story art WebP', entry => entry.transform !== 'copy' && entry.request_key.startsWith('assets/stories/')),
  pick('effect texture WebP', entry => entry.transform !== 'copy' && entry.request_key.startsWith('data/fx_extracted/')),
  pick('brand PNG control', entry => entry.request_key.startsWith('assets/brand/') && entry.request_key.endsWith('.png')),
  pick('data manifest', entry => entry.request_key === 'data/archive_manifest.json'),
  pick('voice audio', entry => entry.request_key.startsWith('assets/voice/') && entry.request_key.endsWith('.m4a')),
]

const spineTexture = picks.find(item => item.label === 'spine texture WebP').entry.request_key
const spineModel = spineTexture.split('/').slice(0, 3).join('/') + '/'
const closures = [
  // Proves a converted texture sits correctly beside its own atlas and skel.
  { label: `spine closure ${spineModel}`, entries: manifest.entries.filter(entry => entry.request_key.startsWith(spineModel)) },
  // Proves a converted image layer sits beside the chibi manifest that names it.
  { label: 'live-chibi image layers closure', entries: manifest.entries.filter(entry => entry.request_key.startsWith('assets/live-chibi/image-layers/')).slice(0, 12) },
]
for (const closure of closures) assert.ok(closure.entries.length >= 2, `${closure.label} looks too small: ${closure.entries.length}`)
const closure = closures.flatMap(item => item.entries)

const keys = [...new Set([...picks.map(item => item.entry.object_key), ...closure.map(entry => entry.object_key)])].sort()
const listPath = path.join(root, '.deploy', 'canary-object-keys.txt')
await fs.writeFile(listPath, keys.join('\n') + '\n')

const totalBytes = manifest.entries.filter(entry => keys.includes(entry.object_key)).reduce((sum, entry) => sum + entry.deployed_size, 0)
console.log(`Canary list: ${keys.length} object keys, ${(totalBytes / 1024 ** 2).toFixed(2)} MiB`)
for (const item of picks) {
  const renamed = item.entry.request_key === item.entry.object_key ? '' : '  (request .png -> object .webp)'
  console.log(`  ${item.label.padEnd(22)} ${item.entry.object_key}${renamed}`)
}
for (const item of closures) console.log(`  ${item.label.padEnd(22)} ${item.entries.length} objects`)
console.log(`\nWritten to ${path.relative(root, listPath).replaceAll('\\', '/')}`)
console.log('Upload with: rclone copy .deploy/r2 cloudflare:sidem-archive-preview --files-from .deploy/canary-object-keys.txt')
