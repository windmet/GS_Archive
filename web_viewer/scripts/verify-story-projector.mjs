import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BaseTexture, Container, Sprite, Texture } from 'pixi.js'
import { CameraController } from '../src/core/CameraController.js'
import { BackgroundManager } from '../src/core/BackgroundManager.js'
import { PixiStageManager } from '../src/core/PixiStageManager.js'
import { projectStoryState } from '../shared/story/StoryStateProjector.js'
import { normalizeScenario } from '../shared/story/ScenarioNormalizer.js'
import { applyStepSceneState } from '../src/core/applyStepSceneState.js'

const viewport = { width: 1280, height: 720 }
const cue = (action, payload, at = .5, duration = 2, id = action) => ({ cue_id: id, action, payload, at, duration })
const scenario = cues => ({ schema_version: 2, steps: [{ step_id: 713, entry_snapshot: { bg: 'A' }, cues }] })
const query = (input, time, context) => projectStoryState(input, { stepIndex: 0, time, viewport, context })
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)
let geometryComparisons = 0
for (const [width, height] of [[1920, 1080], [1000, 1000], [500, 1500], [2561, 720]]) {
  const sprite = new Sprite(new Texture(new BaseTexture(null, { width, height })))
  for (const view of [viewport, { width: 390, height: 844 }, { width: 1001, height: 563 }]) {
    BackgroundManager.prototype._applyBgCover.call({ getWidth: () => view.width, getHeight: () => view.height }, sprite)
    const context = freeze({ backgroundTextures: { A: { width, height } } })
    const args = { stepIndex: 0, time: 0, viewport: view, context }
    const projected = projectStoryState(scenario([]), args).backgroundGeometry
    assert.equal(projected.status, 'projected')
    for (const key of ['x', 'y', 'width', 'height']) close(projected.layers[0][key], sprite[key])
    close(projected.layers[0].scaleX, sprite.scale.x); close(projected.layers[0].scaleY, sprite.scale.y)
    close(projected.layers[0].anchorX, sprite.anchor.x); close(projected.layers[0].anchorY, sprite.anchor.y)
    assert.deepEqual(projectStoryState(scenario([]), args).backgroundGeometry, projected)
    geometryComparisons++
  }
  sprite.destroy({ texture: true, baseTexture: true })
}
for (const size of [undefined, { width: 0, height: 1 }, { width: 1, height: Infinity }]) {
  assert.equal(query(scenario([]), 0, { backgroundTextures: { A: size } }).backgroundGeometry.status, 'not-projected')
}
assert.equal(query({ schema_version: 2, steps: [{ entry_snapshot: {}, cues: [] }] }, 0).backgroundGeometry.status, 'projected')
console.log(`Background geometry: ${geometryComparisons} production Sprite comparisons across aspect ratios and resized viewports`)
for (const state of [{}, { bg_color: '#AAAAAA', bg_dof: .8 }, { bg_color: '#FFFFFF', bg_dof: 2 },
  { bg_color: '#ffffff', bg_dof: .8 }, { bg_color: '#112233', bg_dof: .001 }, { bg_color: '#000000', bg_dof: -1 }]) {
  const sprite = new Sprite(new Texture(new BaseTexture(null, { width: 4, height: 4 })))
  const manager = Object.assign(Object.create(BackgroundManager.prototype), {
    bgContainer: new Container(), bgSprite: sprite, _bgBlurAmount: 0, _blurFilter: { blur: 0 },
    _bgOverlaySprite: new Sprite(sprite.texture), getWidth: () => 1280, getHeight: () => 720,
    setCameraFilter() {}, applyBgEffects() {},
  })
  manager._bgOverlaySprite.blendMode = 2
  applyStepSceneState({ manager, state })
  const projected = query({ schema_version: 2, steps: [{ entry_snapshot: state, cues: [] }] }, 0).backgroundFilters
  assert.equal(projected.status, 'projected'); close(projected.blur, manager._bgBlurAmount)
  assert.equal(projected.overlay.visible, !!manager._bgOverlaySprite.parent)
  if (projected.overlay.visible) {
    assert.equal(projected.overlay.tint, manager._bgOverlaySprite.tint)
    close(projected.overlay.alpha, manager._bgOverlaySprite.alpha)
    assert.equal(manager._bgOverlaySprite.blendMode, 2)
  }
  manager.clearBgColorOverlay(); manager._bgOverlaySprite.destroy(); sprite.destroy({ texture: true, baseTexture: true })
}
for (const key of ['bg_color_transition', 'bg_dof_transition']) {
  const state = { bg_color: '#AAAAAA', bg_dof: .8, [key]: { delay: .1, duration: .4 } }
  assert.equal(query({ schema_version: 2, steps: [{ entry_snapshot: state, cues: [] }] }, 100).backgroundFilters.reason, 'unresolved-filter-transition')
}
for (const state of [{ bg_color: 'bad-color' }, { bg_color: '#AAAAAA', bg_dof: Infinity },
  { bg_color: '#AAAAAA', bg_dof: 1e308 }]) {
  assert.equal(query({ schema_version: 2, steps: [{ entry_snapshot: state, cues: [] }] }, 0).backgroundFilters.reason, 'invalid-filter-state')
}
console.log('Background filters: 6 scene-adapter/manager static cases; unresolved transitions and invalid inputs rejected')
const input = scenario([cue('camera.transform', { zoom: 2, offset_x: 30, offset_y: -20 }),
  cue('screen.fade', { type: 'out', alpha: .8 }), cue('background.change', { bg: 'B', type: 'dissolve' })])
const frozen = JSON.stringify(input)
function freeze(x) { Object.values(x).forEach(v => { if (v && typeof v === 'object') freeze(v) }); return Object.freeze(x) }
freeze(input)
const samples = [0, .4999, .5, 1.5, 2.5, 8]
const tintScenario = scenario([{ ...cue('spine.visual.tint', { value: '#2050A0' }), target: '001tom' }])
tintScenario.steps[0].entry_snapshot.spines = [{ id: '001tom', idol_color: '#F0C080' }]
const tintOutput = (source, time, context) => projectStoryState(source, { stepIndex: 0, time, viewport, context }).spineTints.entries[0]
assert.equal(tintOutput(tintScenario, 0).tint, 0xF0C080)
assert.equal(tintOutput(tintScenario, 2.5).tint, 0x2050A0)
const blockedTint = structuredClone(tintScenario)
blockedTint.steps[0].normalization = { unmapped_legacy_fields: ['state.spines.001tom.idol_color_transition'] }
assert.equal(tintOutput(blockedTint, 1.5).status, 'not-projected')
const invalidTint = structuredClone(tintScenario)
invalidTint.steps[0].cues[0].payload.value = 'not-a-color'
assert.equal(tintOutput(invalidTint, 1.5).tint, null)
const missingTint = structuredClone(tintScenario)
missingTint.steps[0].entry_snapshot.spines = []
assert.ok(query(missingTint, 1.5).coverage.unsupported_cues.includes('spine.visual.tint'))
assert.equal(tintOutput(tintScenario, 1.5, { startedAt: { 'spine.visual.tint': 2 } }).tint, 0xF0C080)
assert.equal(tintOutput(tintScenario, 99, { entrySnapshot: tintScenario.steps[0].entry_snapshot, historyId: 'restored', cuePolicy: 'suppressed' }).tint, 0xF0C080)
const expected = samples.map(time => query(input, time))
for (let i = samples.length - 1; i >= 0; i--) assert.deepEqual(query(input, samples[i]), expected[i])
assert.equal(JSON.stringify(input), frozen)
assert.equal(query(input, 1.5).step_id, 713)
close(query(input, 1.5).camera.scale, 1.875)
close(query(input, 1.5).background.layers[0].alpha, .5)
const sameTime = scenario([cue('camera.transform', { zoom: 2 }, 0, 0, 'first'), cue('camera.transform', { zoom: 3 }, 0, 0, 'second')])
assert.equal(query(sameTime, 0).camera.scale, 3)
assert.equal(query(input, .7, { startedAt: { 'camera.transform': 1 } }).camera.scale, 1)
assert.throws(() => query(input, 0, { entrySnapshot: {} }), /historyId/)
assert.throws(() => query(input, -1), /time/)
assert.throws(() => query(input, 1, { startedAt: { missing: 2 } }), /identity/)
const resolved = query(input, 0, { historyId: 'choice-A/visit-2', entrySnapshot: { bg: 'history-bg', camera_zoom: { zoom: 1.5 } } })
assert.equal(resolved.background.layers[0].bg, 'history-bg')
assert.equal(resolved.camera.scale, 1.5)
assert.equal(resolved.basis.entry, 'resolved-entry')
const restoreContext = { historyId: 'settled-visit-2', cuePolicy: 'suppressed', entrySnapshot: { bg: 'restored', camera_zoom: { zoom: 1.5 } } }
assert.equal(query(input, 99, restoreContext).camera.scale, 1.5)
assert.equal(query(input, 99, restoreContext).background.layers[0].bg, 'restored')
assert.throws(() => query(input, 0, { cuePolicy: 'suppressed' }), /resolved entry/)
assert.equal(query(scenario([cue('screen.directional_wipe', { type: 'in', direction: '?' })]), 1).screen.status, 'not-projected')
const crossStep = normalizeScenario({ steps: [
  { step_id: 19, state: { bg: 'A', screen_fade: { type: 'out', color: '#FFFFFF', alpha: .4, duration: 1 } } },
  { step_id: 21, state: { bg: 'A' } },
] })
const carried = projectStoryState(crossStep, { stepIndex: 1, time: 0, viewport })
assert.equal(carried.screen.fade.visible, true)
assert.equal(carried.screen.fade.alpha, .4)
const planes = query(scenario([cue('screen.fade', { type: 'out' }, 0, 0), cue('screen.directional_wipe', { type: 'in' }, 0, 0)]), 0)
assert.equal(planes.screen.fade.visible, true)
assert.equal(planes.screen.wipe.visible, true)
const overlap = scenario([cue('camera.transform', { zoom: 2 }, 0, 2, 'first'), cue('camera.transform', { zoom: 3 }, 1, 2, 'second')])
close(query(overlap, 1).camera.scale, 1.875)
close(query(overlap, 2).camera.scale, 1.875 + (3 - 1.875) * .875)
assert.equal(query(scenario([cue('background.change', { bg: 'B' }, 0, 2, 'a'), cue('background.change', { bg: 'C' }, 1, 2, 'b')]), 1.5).background.status, 'not-projected')
assert.deepEqual(query(scenario([cue('se.play', { cue: 'never-executed' })]), 99).coverage.unsupported_cues, ['se.play'])

// Shadow comparison: production manager methods, synthetic textures, no GPU renderer.
let now = 0, sequence = 0
const frames = new Map(), saved = [globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame]
globalThis.requestAnimationFrame = fn => { frames.set(++sequence, fn); return sequence }
globalThis.cancelAnimationFrame = id => frames.delete(id)
const tick = () => { const list = [...frames.values()]; frames.clear(); list.forEach(fn => fn()) }
const texture = () => new Texture(new BaseTexture(null, { width: 4, height: 4 }))
let comparisons = 0
try {
  for (const time of samples) {
    now = 0
    const tintManager = Object.assign(Object.create(PixiStageManager.prototype), {
      spineInstances: { '001tom': { spine: { tint: 0xF0C080 } } }, _spineColorTweens: {},
      backgroundManager: Object.create(BackgroundManager.prototype),
    })
    if (time >= .5) {
      now = 500
      tintManager.setSpineColor('001tom', '#2050A0', 2, 0, () => now)
    }
    now = time * 1000; tick()
    assert.equal(tintOutput(tintScenario, time).tint, tintManager.spineInstances['001tom'].spine.tint)
    tintManager._spineColorTweens['001tom']?.cancel()
    comparisons++
    now = 0
    const spine = new Container(), bg = new Container()
    const camera = new CameraController({ bgContainer: bg, spineContainer: spine,
      getWidth: () => viewport.width, getHeight: () => viewport.height, getBgSprite: () => null })
    const c = input.steps[0].cues[0]
    if (time >= c.at) { now = c.at * 1000; camera.setCameraZoom({ ...c.payload, duration: c.duration, nowMilliseconds: () => now }) }
    now = time * 1000; tick()
    const projected = query(input, time).camera
    close(projected.scale, spine.scale.x); close(projected.x, spine.x); close(projected.y, spine.y)
    camera.destroy(); comparisons++
    for (const action of ['screen.fade', 'screen.directional_wipe']) for (const type of ['in', 'out']) {
      const stage = Object.assign(Object.create(PixiStageManager.prototype), { width: 1280, height: 720,
        _screenFadeToken: 0, _screenSlideToken: 0, _fadeOverlay: new Sprite(texture()), _slideOverlay: new Sprite(texture()) })
      stage.clearScreenFade(); stage.clearScreenSlide()
      const screenCue = cue(action, { type, alpha: .8, color: '#FFFFFF', direction: '4' })
      if (time >= screenCue.at) {
        now = screenCue.at * 1000
        if (action === 'screen.fade') stage.setScreenFade(type, '#FFFFFF', 2, 0, .8, () => now)
        else stage.setScreenSlide(type, '#FFFFFF', 2, 0, '4', () => now)
      }
      now = time * 1000; tick()
      const projected = query(scenario([screenCue]), time).screen
      const actual = action === 'screen.fade' ? stage._fadeOverlay : stage._slideOverlay
      const wanted = action === 'screen.fade' ? projected.fade : projected.wipe
      assert.equal(actual.visible, wanted.visible)
      if (action === 'screen.fade') close(actual.alpha, wanted.alpha)
      else { close(actual.x, wanted.x); close(actual.y, wanted.y) }
      stage.clearScreenFade(); stage.clearScreenSlide(); tick(); comparisons++
    }
    now = 0
    const tickers = new Set(), container = new Container()
    const background = new BackgroundManager({ app: { ticker: { add: fn => tickers.add(fn), remove: fn => tickers.delete(fn) } },
      bgContainer: container, bgEffectContainer: new Container(), getWidth: () => 1280, getHeight: () => 720,
      getBgUrl: id => id, loadTextureFromUrl: async () => texture() })
    await background.setBackground('A', { duration: 0 })
    if (time >= .5) {
      now = 500
      background.setBackground('B', { duration: 2, nowMilliseconds: () => now })
      await Promise.resolve()
    }
    now = time * 1000; [...tickers].forEach(fn => fn())
    const layers = query(input, time).background.layers
    assert.equal(container.children.length, layers.length)
    container.children.forEach((sprite, i) => close(sprite.alpha, layers[i].alpha))
    background.clearBackground(); comparisons++
  }
  const overlappingTints = structuredClone(tintScenario)
  overlappingTints.steps[0].cues.push({ ...cue('spine.visual.tint', { value: '#112233' }, 1.5, 1, 'tint-override'), target: '001tom' })
  for (const time of [1.5, 2, 2.5]) {
    const manager = Object.assign(Object.create(PixiStageManager.prototype), {
      spineInstances: { '001tom': { spine: { tint: 0xF0C080 } } }, _spineColorTweens: {},
      backgroundManager: Object.create(BackgroundManager.prototype),
    })
    now = 500; manager.setSpineColor('001tom', '#2050A0', 2, 0, () => now)
    now = 1500; tick()
    manager.setSpineColor('001tom', '#112233', 1, 0, () => now)
    now = time * 1000; tick()
    assert.equal(tintOutput(overlappingTints, time).tint, manager.spineInstances['001tom'].spine.tint)
    manager._spineColorTweens['001tom']?.cancel(); comparisons++
  }
} finally { [globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame] = saved }
if (process.argv.includes('--local-sources')) {
  const catalog = JSON.parse(readFileSync(new URL('../public/data/masterdata/story_catalog.json', import.meta.url)))
  const names = [...new Set(catalog.collectionStructure.filter(c => c.domain === 'main')
    .flatMap(c => c.chapters.flatMap(chapter => chapter.episodes.map(e => e.resourceId))))]
  assert.ok(names.length, 'published main corpus must not be empty')
  const coverage = { documents: names.length, steps: 0, queries: 0, unsupportedCueActions: {}, unmappedFields: {}, limitations: {}, notProjectedSteps: { background: 0, screen: 0, backgroundFilters: 0 } }
  for (const name of names) {
    assert.match(name, /^[A-Za-z0-9_-]+$/)
    const source = normalizeScenario(JSON.parse(readFileSync(new URL(`../public/data/compiled/episodes/${name}.json`, import.meta.url))))
    const original = JSON.stringify(source)
    coverage.steps += source.steps.length
    for (let stepIndex = 0; stepIndex < source.steps.length; stepIndex++) {
      const step = source.steps[stepIndex]
      const times = new Set([0, ...step.cues.flatMap(c => [Math.max(0, c.at - .001), c.at, c.at + c.duration / 2, c.at + c.duration])])
      const outputs = new Map()
      for (const time of times) {
        coverage.queries++
        const output = projectStoryState(source, { stepIndex, time, viewport })
        outputs.set(time, output)
        assert.deepEqual(projectStoryState(source, { stepIndex, time, viewport }), output)
        assert.equal(output.step_id, step.step_id)
        if (time >= Math.max(0, ...step.cues.map(c => c.at + c.duration))) {
          assert.equal(output.camera.scale, step.settled_snapshot.camera_zoom?.zoom ?? 1, `${name}:${step.step_id} camera settled`)
          if (output.background.status === 'projected') assert.equal(output.background.layers.at(-1)?.bg ?? null, step.settled_snapshot.bg || null, `${name}:${step.step_id} background settled`)
        }
      }
      for (const time of [...times].reverse()) assert.deepEqual(projectStoryState(source, { stepIndex, time, viewport }), outputs.get(time), `${name}:${step.step_id}: query order`)
      const final = projectStoryState(source, { stepIndex, time: Math.max(0, ...step.cues.map(c => c.at + c.duration)), viewport })
      for (const tint of final.spineTints.entries.filter(tint => tint.status === 'projected')) {
        const settled = step.settled_snapshot.spines?.find(spine => spine.id === tint.id)
        if (settled) assert.equal(tint.tint, settled.idol_color ? parseInt(settled.idol_color.replace('#', ''), 16) : 0xFFFFFF, `${name}:${step.step_id}:${tint.id}: settled tint`)
      }
      for (const id of new Set(final.coverage.unsupported_cues)) {
        const action = step.cues.find(cue => cue.cue_id === id)?.action
        assert.ok(action, `${name}:${step.step_id}: unsupported cue must resolve to its source`)
        coverage.unsupportedCueActions[action] = (coverage.unsupportedCueActions[action] || 0) + 1
      }
      for (const limitation of new Set(final.coverage.limitations)) coverage.limitations[limitation] = (coverage.limitations[limitation] || 0) + 1
      for (const field of new Set(final.coverage.unmapped_fields)) {
        const path = field.replace(/^state\.spines\.[^.]+\./, 'state.spines.*.')
        coverage.unmappedFields[path] = (coverage.unmappedFields[path] || 0) + 1
      }
      for (const channel of ['background', 'screen', 'backgroundFilters']) if (final[channel].status !== 'projected') coverage.notProjectedSteps[channel]++
    }
    assert.equal(JSON.stringify(source), original, `${name}: projection cannot mutate normalized input`)
  }
  console.log(`Local main corpus coverage: ${JSON.stringify(coverage)}`)
}
console.log(`Projector verified: pure/order-independent queries, resolved history, boundaries and ${comparisons} production-manager shadow comparisons`)
