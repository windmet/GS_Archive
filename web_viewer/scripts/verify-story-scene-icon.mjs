import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from '@vue/compiler-sfc'
import { createStoryAssetPlan } from '../shared/story/StoryAssetPlan.js'
for (const image_icon of ['102sha', { id: '102sha', layer: '' },
  { id: '102sha', display_id: '102sha', layer: '2' },
  { id: '01jup', display_id: '01jup', layer: '2' }]) {
  const scenario = { schema_version: 2, runtime_contract: 'story-runtime-v2', steps: [{ step_id: 1, type: 'adv',
    entry_snapshot: { image_icon, spines: [] } }] }
  const before = JSON.stringify(scenario)
  const plan = createStoryAssetPlan(scenario, { file: 'episodes/icon-regression.json', sha256: `sha256:${'0'.repeat(64)}` })
  assert.equal(plan.assets.some(asset => asset.kind === 'image-icon'), false)
  assert.equal(JSON.stringify(scenario), before, 'original metadata must be preserved')
}
const { descriptor } = parse(readFileSync(new URL('../src/components/SpineStage.vue', import.meta.url), 'utf8'))
assert.doesNotMatch(descriptor.template.content, /scene-icon|sceneIcon|image_icon/, 'identity metadata must not become a persistent HUD')
console.log('Scene identity metadata: unit/president icons retained without overlays or preload dependencies')
