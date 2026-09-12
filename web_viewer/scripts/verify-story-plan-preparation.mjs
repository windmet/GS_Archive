import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { prepareScenario } from '../src/data/prepareScenario.js'
import { Preloader } from '../src/utils/Preloader.js'
import { storyAssetAdapter } from '../src/utils/StoryAssetAdapters.js'

const strict = { schema_version: 2, runtime_contract: 'story-runtime-v2', steps: [{
  step_id: 29, type: 'adv', state: { bg: 'must-not-use-legacy-state' },
  entry_snapshot: { bg: 'entry', spines: [] }, settled_snapshot: { bg: 'settled', spines: [] },
  cues: [{ cue_id: 'bg', action: 'background.change', payload: { bg: 'cue-only' } }],
}] }
const digest = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const bytes = ' \n' + JSON.stringify(strict, null, 2) + '\n'
let received, readComplete = false
const prepared = await prepareScenario('episodes/source.json', {
  isCurrent: () => true, fetchImpl: async () => new Response(bytes),
  readScenario: async response => { const value = await response.json(); readComplete = true; return value },
  loadPlayer: async () => assert.ok(readComplete, 'source validation precedes player import'),
  preloadAssets: async plan => { assert.ok(readComplete); received = plan },
})
assert.deepEqual(prepared, strict, 'plan normalization must not mutate the published source')
assert.equal(received.source.sha256, digest(bytes), 'hash exact response bytes including whitespace')
assert.notEqual(received.source.sha256, digest(JSON.stringify(strict)), 'never hash a reserialized object')
assert.equal(received.source.file, 'episodes/source.json')
assert.deepEqual(received.assets.map(task => task.key), ['background:entry', 'background:settled', 'background:cue-only'])
assert.ok(received.assets.every(task => task.uses.every(use => use.stepId === 29)))
const requests = []
class RecordingPreloader extends Preloader {
  static async _preloadImage(url) { requests.push(url); return 'image-loaded' }
}
const result = await RecordingPreloader.preloadScenario(received)
assert.deepEqual(requests, ['/assets/bg/entry.png', '/assets/bg/settled.png', '/assets/bg/cue-only.png'])
assert.equal(result.status.succeeded, 3)
assert.equal(result.status.source.sha256, digest(bytes))
assert.equal(result.status.tasks[2].uses[0].cueId, 'bg')

// Native loaders stay separate from logical unimplemented / disabled entries.
for (const [kind, id, expected] of [
  ['image-icon', '047shu', '/assets/idols/icons/image_chara_icon_047shu.png'],
  ['mobile-icon', '047shu', '/assets/idols/mobile_icons/image_chara_mobile_icon_047shu.png'],
  ['idol-mobile-background', '047shu', '/assets/idols/mobile_bg/image_chara_mobile_background_047shu.png'],
  ['unit-mobile-background', 'c_first', '/assets/units/mobile_bg/image_unit_mobile_background_c_first.png'],
  ['stamp', 'stamp', '/assets/stamps/stamp.png'], ['emoji', 'emoji', '/assets/emojis/emoji.png'],
  ['effect-texture', 'fx_adv_rain', '/data/fx_extracted/unity_fx_adv_rain.png'],
]) assert.equal(storyAssetAdapter({ kind, id }).url, expected)
assert.equal(storyAssetAdapter({ kind: 'spine-skeleton', id: '102sha_001_00' }).state, 'deferred')
assert.equal(storyAssetAdapter({ kind: 'effect-texture', id: 'fx_adv_flare_01', required: false, runtimeDisabled: 'disabled' }).state, 'excluded')
assert.equal(storyAssetAdapter({ kind: 'toString', id: 'unknown' }).state, 'deferred')
const openPlan = structuredClone(received)
openPlan.dependenciesComplete = false
openPlan.unresolved.push({ stepIndex: 0, stepId: 29, path: 'fixture', reason: 'unknown-dependency' })
openPlan.assets.push(
  { key: 'voice:test', kind: 'voice', id: 'test', required: true, dependencies: [], dependencyState: 'complete', uses: [] },
  { key: 'effect-texture:disabled', kind: 'effect-texture', id: 'disabled', required: false,
    runtimeDisabled: 'fixture-disabled', dependencies: [], dependencyState: 'complete', uses: [] },
)
const open = await RecordingPreloader.preloadScenario(openPlan)
assert.equal(open.status.phase, 'pending')
assert.equal(open.status.succeeded, 3)
assert.equal(open.status.pending, 1)
assert.equal(open.status.excluded, 1)
assert.equal(open.status.deferred, 1)
assert.equal(open.status.unresolved[0].reason, 'unknown-dependency')
assert.ok(!requests.some(url => url.includes('disabled') || url.includes('voice')), 'excluded and unadapted assets must not execute')

// Actual strict-v2 bytes go through the same production boundary, not a
// reconstituted fixture. The executor may not count any bundle as fetched.
const actualBytes = await readFile(new URL('../public/data/compiled/episodes/1_4_001_00_a.json', import.meta.url))
await prepareScenario('episodes/1_4_001_00_a.json', {
  isCurrent: () => true, fetchImpl: async () => new Response(actualBytes), loadPlayer: async () => {},
  preloadAssets: async plan => {
    assert.equal(plan.source.sha256, digest(actualBytes))
    assert.equal(plan.source.runtimeContract, 'story-runtime-v2')
    assert.ok(plan.assets.some(asset => asset.kind === 'background'))
    assert.ok(plan.assets.filter(asset => asset.kind === 'spine-bundle').every(asset => storyAssetAdapter(asset).state === 'deferred'))
  },
})
await assert.rejects(Preloader.preloadScenario(strict.steps), /source-bound StoryAssetPlan/)
console.log('Plan preparation verified: exact source SHA, strict snapshot/cue execution, provenance, adapters and real episode input')
