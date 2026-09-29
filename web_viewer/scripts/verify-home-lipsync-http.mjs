import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createArchiveAssetResolver } from './lib/archive-assets.mjs'

const base = process.argv[2]
assert.ok(base, 'Usage: node scripts/verify-home-lipsync-http.mjs http://127.0.0.1:5202/')
const resolver = createArchiveAssetResolver()
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
for (const part of ['001tom/2_1_001_01/2_1_001_01_00_09.json', '008rei/2_2_008_01/2_2_008_01_00_09.json', '008rei/2_2_008_02/2_2_008_02_00_09.json']) {
  const local = await fs.readFile(resolver.lipsyncPath(part))
  const url = new URL(`/assets/lipsync/adxlip/${part}`, base)
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
  assert.equal(response.status, 200, url.href)
  const bytes = Buffer.from(await response.arrayBuffer())
  assert.equal(hash(bytes), hash(local), `HTTP must serve the configured source: ${part}`)
  const curve = JSON.parse(bytes.toString('utf8'))
  assert.ok(curve.scales?.some(sample => sample.y > 0.04), `Nonzero source curve: ${part}`)
  console.log(`${part}: ${curve.scales.length} samples, sha256:${hash(bytes)}`)
}
