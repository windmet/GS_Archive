import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Home's scene picker groups backgrounds by time of day like the photo catalogue. Home never loads
// the photo read-model, so this tiny index carries each background's raw photo-studio scene variants
// (background_catalog.json, tables 107/108); the front end normalises them with photoVariantKey.
// node scripts/generate-background-variants.mjs [--check]
const root = fileURLToPath(new URL('../public/data/masterdata/', import.meta.url))
const catalog = JSON.parse(await fs.readFile(root + 'background_catalog.json', 'utf8'))
const variants = {}
for (const [id, meta] of Object.entries(catalog.backgrounds).sort(([a], [b]) => a.localeCompare(b))) {
  const raw = [...new Set((meta.picture_studio_scenes || []).map(scene => String(scene.variant || '')).filter(Boolean))]
  if (raw.length) variants[id] = raw
}
const output = JSON.stringify({ schemaVersion: 1, kind: 'background-variants', source: 'background_catalog.json', variants }, null, 1) + '\n'
const target = root + 'background_variants.json'
if (process.argv.includes('--check')) {
  const current = await fs.readFile(target, 'utf8').catch(() => '')
  if (current !== output) { console.error('background_variants.json is stale; run node scripts/generate-background-variants.mjs'); process.exit(1) }
  console.log(`Background variants: ${Object.keys(variants).length} backgrounds, in sync with background_catalog.json`)
} else {
  await fs.writeFile(target, output)
  console.log(`Wrote ${Object.keys(variants).length} background variants (${Buffer.byteLength(output)} bytes)`)
}
