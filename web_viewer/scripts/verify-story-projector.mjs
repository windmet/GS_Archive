import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BaseTexture, Container, Sprite, Texture } from 'pixi.js'
import { CameraController } from '../src/core/CameraController.js'
import { BackgroundManager } from '../src/core/BackgroundManager.js'
import { PixiStageManager } from '../src/core/PixiStageManager.js'
import { projectStoryState } from '../shared/story/StoryStateProjector.js'
import { normalizeScenario } from '../shared/story/ScenarioNormalizer.js'

const viewport = { width: 1280, height: 720 }
const cue = (action, payload, at = .5, duration = 2, id = action) => ({ cue_id: id, action, payload, at, duration })
const scenario = cues => ({ schema_version: 2, steps: [{ step_id: 713, entry_snapshot: { bg: 'A' }, cues }] })
const query = (input, time, context) => projectStoryState(input, { stepIndex: 0, time, viewport, context })
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)
const input = scenario([cue('camera.transform', { zoom: 2, offset_x: 30, offset_y: -20 }),
  cue('screen.fade', { type: 'out', alpha: .8 }), cue('background.change', { bg: 'B', type: 'dissolve' })])
const frozen = JSON.stringify(input)
function freeze(x) { Object.values(x).forEach(v => { if (v && typeof v === 'object') freeze(v) }); return Object.freeze(x) }
freeze(input)
const samples = [0, .4999, .5, 1.5, 2.5, 8]
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
} finally { [globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame] = saved }
if (process.argv.includes('--local-sources')) {
  const catalog = JSON.parse(readFileSync(new URL('../public/data/masterdata/story_catalog.json', import.meta.url)))
  const names = [...new Set(catalog.collectionStructure.filter(c => c.domain === 'main')
    .flatMap(c => c.chapters.flatMap(chapter => chapter.episodes.map(e => e.resourceId))))]
  assert.ok(names.length, 'published main corpus must not be empty')
  const coverage = { documents: names.length, steps: 0, queries: 0, unsupportedCueActions: {}, unmappedFields: {}, limitations: {}, notProjectedSteps: { background: 0, screen: 0 } }
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
      for (const channel of ['background', 'screen']) if (final[channel].status !== 'projected') coverage.notProjectedSteps[channel]++
    }
    assert.equal(JSON.stringify(source), original, `${name}: projection cannot mutate normalized input`)
  }
  console.log(`Local main corpus coverage: ${JSON.stringify(coverage)}`)
}
console.log(`Projector verified: pure/order-independent queries, resolved history, boundaries and ${comparisons} production-manager shadow comparisons`)
