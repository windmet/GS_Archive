// Promote authored module data from the pinned, local IPA export. No media copy.
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const root = new URL('../', import.meta.url)
const input = new URL(process.argv.slice(2).find(arg => !arg.startsWith('--')) || '.analysis/chart-native/hit-effect-assets/source-assets.json', root)
const bytes = readFileSync(input), source = JSON.parse(bytes)
const configFile = new URL('config/song-hit-effects.v1.json', root)
const config = JSON.parse(readFileSync(configFile))
if (source.dataSha256 !== config.source.dataSha256) throw Error('Different IPA source')
// Keep the serialized curves and gradients; remove empty disabled alternatives.
function compact(value) {
  if (Array.isArray(value)) return value.map(compact)
  if (!value || typeof value !== 'object') return value
  if ('minMaxState' in value && 'scalar' in value) {
    const mode = value.minMaxState
    return Object.fromEntries(Object.entries(value).filter(([k]) =>
      ['minMaxState', 'scalar'].includes(k) || (mode === 3 && k === 'minScalar')
      || ([1, 2].includes(mode) && k === 'maxCurve') || (mode === 2 && k === 'minCurve')).map(([k, v]) => [k, compact(v)]))
  }
  if ('minMaxState' in value && 'maxColor' in value) {
    const mode = value.minMaxState
    return Object.fromEntries(Object.entries(value).filter(([k]) => k === 'minMaxState'
      || ([0, 3].includes(mode) && k === 'maxColor') || (mode === 3 && k === 'minColor')
      || ([1, 2, 4].includes(mode) && k === 'maxGradient') || (mode === 2 && k === 'minGradient')).map(([k, v]) => [k, compact(v)]))
  }
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, compact(v)]))
}
for (const prefab of source.defaultAutoPrefabs) {
  const contract = config.defaultContracts[prefab.pathId]
  if (contract.layers.length !== prefab.layers.length) throw Error('Layer ordering changed')
  contract.rootTransform = prefab.rootTransform
  prefab.layers.forEach((node, index) => {
    const layer = contract.layers[index], particle = node.particles[0], renderer = node.renderers[0].tree
    if (node.path !== layer.path) throw Error('Layer binding changed')
    layer.nodeId = node.pathId
    layer.particleSourceSha256 = particle.sourceSha256
    layer.transform = node.transform
    layer.modules = compact(Object.fromEntries(Object.entries(particle.tree).filter(([k, v]) =>
      k.endsWith('Module') && v.enabled)))
    layer.simulationSpace = particle.tree.moveWithTransform
    layer.duration = particle.tree.lengthInSec
    layer.simulationSpeed = particle.tree.simulationSpeed
    layer.renderer = Object.fromEntries(Object.entries(renderer).filter(([k]) =>
      ['m_RenderMode', 'm_RenderAlignment', 'm_VelocityScale', 'm_LengthScale', 'm_Pivot', 'm_SortingOrder'].includes(k)))
  })
}
const clip = source.evaluation.animation.tree
config.evaluation.animation.sourceCurves = compact({ scale: clip.m_ScaleCurves, float: clip.m_FloatCurves })
config.evaluation.bindings = source.evaluation.bindings
config.evaluation.panel = source.evaluation.panel
config.particleModuleSource = { dataSha256: source.dataSha256,
  exportSha256: createHash('sha256').update(bytes).digest('hex'),
  boundary: 'Serialized Unity modules. Web deterministic seeds, integration and Canvas projection are adaptations, not Unity engine parity.' }
const output = JSON.stringify(config, null, 2) + '\n'
if (process.argv.includes('--check')) {
  if (readFileSync(configFile, 'utf8') !== output) throw Error('Particle contracts differ from pinned export')
} else writeFileSync(configFile, output)
console.log('Bound authored modules for seven prefabs and full Auto clip curves.')
