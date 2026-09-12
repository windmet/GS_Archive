import assert from 'node:assert/strict'
import { createStoryAssetPlan } from '../shared/story/StoryAssetPlan.js'
import { createStoryAssetPriority, assetPriority } from '../shared/story/StoryAssetPriority.js'
import { prepareScenario } from '../src/data/prepareScenario.js'
import { Preloader } from '../src/utils/Preloader.js'

const scenario = { schema_version: 2, runtime_contract: 'story-runtime-v2', steps: Array.from({ length: 8 }, (_, index) => ({
  step_id: 100 + index * 7, type: index === 0 ? 'synopsis' : index === 4 ? 'choice' : 'adv',
  entry_snapshot: { bg: `bg${index}`, spines: index === 3 ? [{ model: 'fixture' }] : [] },
  settled_snapshot: { bg: `bg${index}`, spines: [] }, cues: [],
})) }
const source = { file: 'fixture.json', sha256: `sha256:${'a'.repeat(64)}` }
const plan = createStoryAssetPlan(scenario, source)
const original = structuredClone(plan)
const entry = { startStep: 2, initialStep: 4, endStep: 7 }
const projection = createStoryAssetPriority(scenario, entry)
assert.equal(projection.entryIndex, 3, 'one-based position, not authored step ID')
assert.deepEqual(projection.nearIndices, [4], 'do not predict a choice branch')
assert.equal(assetPriority(plan.assets.find(asset => asset.key === 'background:bg3'), projection), 'critical')
assert.equal(assetPriority(plan.assets.find(asset => asset.key === 'background:bg4'), projection), 'near')
assert.equal(assetPriority(plan.assets.find(asset => asset.key === 'background:bg7'), projection), 'deferred')
assert.equal(createStoryAssetPriority(scenario).entryIndex, 1, 'skip synopsis at default entry')
assert.equal(createStoryAssetPriority(scenario, { ...entry, initialStep: 99 }).entryIndex, 6, 'clamp to range')
assert.deepEqual(createStoryAssetPriority(scenario, { startStep: 4, endStep: 4 }).nearIndices, [])
assert.deepEqual(plan, original, 'priority projection does not mutate the source plan')

let passed
await prepareScenario('fixture.json', {
  isCurrent: () => true, playbackEntry: entry,
  fetchImpl: async () => new Response(JSON.stringify(scenario)), loadPlayer: async () => {},
  preloadAssets: async (_, __, options) => { passed = options.priority },
})
assert.deepEqual(passed, projection, 'actual preparation forwards requested entry and range')

const started = []
let releaseAtlas
const atlasGate = new Promise(resolve => { releaseAtlas = resolve })
class OrderedPreloader extends Preloader {
  static async _preloadImage(url) { started.push(url); return 'image-loaded' }
  static async _preloadBinary(url) { started.push(url); return 'fetched' }
  static async _preloadAtlas(url) {
    started.push(url)
    await atlasGate
    return { text: 'page.png\nsize: 2,2\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\n', sha256: source.sha256 }
  }
  static async _resolvePage() { started.push('resolve-page'); return '/page.png' }
}
const work = OrderedPreloader.preloadScenario(plan, null, { priority: projection })
await new Promise(resolve => setImmediate(resolve))
assert.ok(started.some(url => url.includes('bg3')))
assert.ok(!started.some(url => url.includes('bg4') || url.includes('bg0')), 'near/deferred cannot occupy slots while critical is pending')
releaseAtlas()
const { status } = await work
assert.ok(started.indexOf('/page.png') < started.findIndex(url => url.includes('bg4')), 'newly discovered critical atlas page precedes near')
assert.ok(started.findIndex(url => url.includes('bg4')) < started.findIndex(url => url.includes('bg0')), 'near precedes deferred')
assert.equal(status.tasks.find(task => task.kind === 'spine-texture').priority, 'critical')
assert.equal(status.tasks.find(task => task.kind === 'spine-bundle').state, 'deferred', 'priority is not readiness')
assert.deepEqual(status.priority, projection)
console.log('Asset priority verified: actual entry/range, synopsis, choice boundary, no source mutation, tier ordering and discovered atlas pages')
