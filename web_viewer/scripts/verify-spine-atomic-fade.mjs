import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readSource = relative => readFile(new URL(relative, import.meta.url), 'utf8')
const [finalizeSource, stageSource, managerSource, stageManagerSource] = await Promise.all([
  readSource('../src/core/spineSpawnFinalize.js'),
  readSource('../src/components/SpineStage.vue'),
  readSource('../src/core/SpineManager.js'),
  readSource('../src/core/PixiStageManager.js'),
])

assert.match(finalizeSource, /fadeWrapper\.visible\s*=\s*false/)
assert.match(finalizeSource, /new PIXI\.AlphaFilter\(0\)/)
assert.match(finalizeSource, /if \(!options\.deferReveal\) fadeIn/)
assert.match(stageSource, /deferReveal:\s*true/)
assert.match(managerSource, /_wholeModelAlphaFilter\(target/)
assert.match(managerSource, /target\.alpha\s*=\s*1/)
assert.match(managerSource, /wrapper\.destroy\(\{ children: true, texture: false, baseTexture: false \}\)/)
assert.doesNotMatch(managerSource, /destroy\(\{[^}]*textures?\s*:\s*true/)
assert.doesNotMatch(stageManagerSource, /wrapper\.destroy\(\{[^}]*textures?\s*:\s*true/)

console.log('Spine atomic fade: hidden assembly, whole-model alpha and shared-texture disposal contracts verified')
