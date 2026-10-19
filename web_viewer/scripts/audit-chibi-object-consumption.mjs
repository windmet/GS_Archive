// Read-only census using the same attach validators and consumer precedence as runtime.
import fs from 'node:fs'
import crypto from 'node:crypto'
import { attachObjectEmitters } from '../src/core/chibiObjectEmitters.js'
import { attachChibiParticleLayers } from '../src/core/chibiParticleTimeline.js'
import { attachChibiFloor } from '../src/core/chibiFloorParticles.js'
import { attachBloom } from '../src/core/chibiBloomParticles.js'
import { objectParticleCoverage } from '../src/core/stageVfxCoverage.js'

const inputs = {}
const read = path => {
  const bytes = fs.readFileSync(new URL('../public/' + path, import.meta.url))
  inputs[path] = crypto.createHash('sha256').update(bytes).digest('hex')
  return JSON.parse(bytes)
}
const sourcePath = 'assets/live-chibi/object-layers/index.json'
const source = read(sourcePath), songs = read('assets/live-chibi/choreography/index.json').songs
let index = attachObjectEmitters(source, read('data/stage-object-emitters.json'), inputs[sourcePath], inputs['assets/live-chibi/choreography/index.json'])
index = attachChibiParticleLayers(index, read('assets/live-chibi/particle-layers/index.json'))
index = attachChibiFloor(index, read('assets/live-chibi/floor-particles/index.json'))
index = attachBloom(index, read('data/stage-bloom-particles.json'), inputs[sourcePath])
const assets = {}
for (const song of songs) for (const event of song.objectLayerEvents || []) {
  const name = event.asset, original = source.assets[name]
  const coverage = ['sprite', 'mixed'].includes(original?.kind)
    ? { consumer: 'spriteInstances', partialMarkers: [], deferredSystems: 0, status: 'mapped_unverified' }
    : objectParticleCoverage(index.assets[name])
  const row = assets[name] ||= { kind: original?.kind || 'missing', particleCount: original?.particleCount || 0,
    ...coverage, eventCount: 0, arrangements: [] }
  row.eventCount++
  if (!row.arrangements.includes(song.id)) row.arrangements.push(song.id)
}
const rows = Object.entries(assets).sort(([a], [b]) => a.localeCompare(b))
const particleRows = rows.filter(([, row]) => row.kind === 'particle')
const missing = particleRows.filter(([, row]) => !row.consumer)
const byConsumer = {}
for (const [, row] of particleRows) byConsumer[row.consumer || 'missing'] = (byConsumer[row.consumer || 'missing'] || 0) + 1
const report = { schemaVersion: 1, inputs, summary: { arrangements: songs.length,
  referencedParticleAssets: particleRows.length, byConsumer,
  missingParticleAssets: missing.length, missingParticleEvents: missing.reduce((n, [, r]) => n + r.eventCount, 0),
  missingParticleArrangements: new Set(missing.flatMap(([, r]) => r.arrangements)).size,
  partialParticleAssets: particleRows.filter(([, r]) => r.status === 'partial').length,
  missingSourceAssets: rows.filter(([, r]) => r.kind === 'missing').length }, assets: Object.fromEntries(rows) }
console.log(JSON.stringify(process.argv.includes('--json') ? report : report.summary, null, 2))
