import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Container, settings } from 'pixi.js'
import {
  CAMERA_COLOR_PRESETS,
  COLOR_FILTER_PRESETS_BUNDLE,
  IDENTITY_COLOR_FILTER,
  backgroundIdolColorPreset,
  cameraColorPreset,
  colorFilterPixiMatrix,
  colorFilterRows,
  isIdentityColorFilter,
  lerpColorFilter,
} from '../shared/story/ColorFilter.js'
import { ColorFilterController } from '../src/core/ColorFilterController.js'
import { applyStepSceneState } from '../src/core/applyStepSceneState.js'

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = resolve(WEB, '..')
const close = (actual, expected, label) => {
  assert.equal(actual.length, expected.length, `${label}: length`)
  actual.forEach((value, index) => {
    const want = expected[index]
    if (Array.isArray(want)) return close(value, want, `${label}[${index}]`)
    assert.ok(Math.abs(value - want) < 1e-6, `${label}[${index}]: ${value} != ${want}`)
  })
}

// Expected rows of Translate(offset) * Scale(scale) * fromYCbCr * Scale(1, s, s) * toYCbCr, multiplied out
// independently as 4x4 matrices in the client's order.
const expectedRows = {
  gray: [[0.69528, 0.4224298, 0.0822902, -0.1], [0.2153453, 0.9026544, 0.0820003, -0.1], [0.2150554, 0.4228646, 0.56208, -0.1]],
  sepia: [[0.40601, 0.5810818, 0.1129082, 0], [0.2691136, 0.628303, 0.1025834, -0.02], [0.2152426, 0.4226774, 0.16208, -0.05]],
  mono: [[0.33405, 0.5576281, 0.1083219, 0], [0.2840568, 0.6076515, 0.1082917, 0], [0.2840266, 0.5576734, 0.1583, 0]],
}
for (const [name, rows] of Object.entries(expectedRows)) close(colorFilterRows(cameraColorPreset(name)), rows, name)
const evening = backgroundIdolColorPreset({ colorOffSet: { x: 0.02, y: 0, z: -0.05 }, colorScale: { x: 1.05, y: 1, z: 0.9 }, colorSaturation: 0.9 })
close(colorFilterRows(evening), [[0.976395, 0.0612211, 0.0123839, 0.02], [0.0300224, 0.958727, 0.0112506, 0], [0.0265309, 0.0532091, 0.82026, -0.05]], 'bg profile')
// Saturation 1 skips the YCbCr round trip, so scale/offset stay exact and identity is exact.
close(colorFilterRows({ colorOffset: { x: 0.1, y: 0, z: 0 }, colorScale: { x: 2, y: 1, z: 1 }, saturation: 1 }),
  [[2, 0, 0, 0.1], [0, 1, 0, 0], [0, 0, 1, 0]], 'unsaturated scale')
assert.deepEqual(colorFilterPixiMatrix(IDENTITY_COLOR_FILTER), [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0])
const grayMatrix = colorFilterPixiMatrix(CAMERA_COLOR_PRESETS.gray)
close([grayMatrix[4], grayMatrix[9], grayMatrix[14], grayMatrix[18], grayMatrix[19]], [-0.1, -0.1, -0.1, 1, 0], 'pixi offsets')

assert.deepEqual(Object.keys(CAMERA_COLOR_PRESETS).sort(), ['gray', 'mono', 'sepia', 'sepia_light'])
assert.equal(cameraColorPreset('unknown'), null)
assert.equal(cameraColorPreset('toString'), null)
assert.equal(backgroundIdolColorPreset(null), IDENTITY_COLOR_FILTER)
assert.ok(isIdentityColorFilter(backgroundIdolColorPreset({ colorOffSet: { x: 0, y: 0, z: 0 } })))
assert.ok(!isIdentityColorFilter(evening))
const middle = lerpColorFilter(IDENTITY_COLOR_FILTER, CAMERA_COLOR_PRESETS.gray, 0.5)
assert.deepEqual(middle, { colorOffset: { x: -0.05, y: -0.05, z: -0.05 }, colorScale: { x: 1.1, y: 1.1, z: 1.1 }, saturation: 0.7 })
assert.deepEqual(lerpColorFilter(IDENTITY_COLOR_FILTER, CAMERA_COLOR_PRESETS.gray, 4), lerpColorFilter(IDENTITY_COLOR_FILTER, CAMERA_COLOR_PRESETS.gray, 1))

// Controller: linear lerp after the delay, on a real Container with a deterministic scheduler.
const frames = new Map()
let frameId = 0, now = 0
globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId }
globalThis.cancelAnimationFrame = id => frames.delete(id)
const advance = milliseconds => {
  now += milliseconds
  const callbacks = [...frames.values()]
  frames.clear()
  callbacks.forEach(callback => callback(now))
}
// Filter construction probes shader precision; without WebGL Pixi falls back to medium precision.
settings.ADAPTER = { ...settings.ADAPTER, createCanvas: () => ({ getContext: () => null }) }
const target = new Container()
const other = { id: 'existing filter' }
target.filters = [other]
const controller = new ColorFilterController({ app: { renderer: { resolution: 2 } }, getTarget: () => target })
const nowMilliseconds = () => now
controller.set(CAMERA_COLOR_PRESETS.gray, { delay: 0.5, duration: 1, nowMilliseconds })
advance(400)
assert.equal(controller.current, IDENTITY_COLOR_FILTER, 'nothing before the delay')
assert.deepEqual(target.filters, [other])
advance(600)
assert.deepEqual(controller.current, middle, 'linear midpoint')
assert.equal(target.filters.length, 2)
assert.equal(target.filters[0], other, 'existing filters kept in front')
close(target.filters[1].matrix, colorFilterPixiMatrix(middle), 'midpoint matrix')
// The cumulative snapshot of the next step repeats the preset without timing; the lerp continues.
controller.set(CAMERA_COLOR_PRESETS.gray, { nowMilliseconds })
assert.deepEqual(controller.current, middle, 'repeat without timing keeps the running lerp')
assert.equal(frames.size, 1)
advance(250)
assert.deepEqual(controller.current, lerpColorFilter(IDENTITY_COLOR_FILTER, CAMERA_COLOR_PRESETS.gray, 0.75))
advance(250)
assert.deepEqual(controller.current, CAMERA_COLOR_PRESETS.gray)
close(target.filters[1].matrix, colorFilterPixiMatrix(CAMERA_COLOR_PRESETS.gray), 'end matrix')
assert.equal(frames.size, 0)
controller.set(IDENTITY_COLOR_FILTER, { duration: 1, nowMilliseconds })
advance(1000)
assert.deepEqual(target.filters, [other], 'identity removes only its own filter')
controller.set(CAMERA_COLOR_PRESETS.sepia)
assert.deepEqual(controller.current, CAMERA_COLOR_PRESETS.sepia, 'no timing applies instantly')
controller.reset()
assert.deepEqual(target.filters, [other])
controller.destroy()

// Step application hands the camera transition and the background profile to their owners.
const calls = []
const profile = { colorOffSet: { x: 0.02, y: 0, z: -0.05 }, colorScale: { x: 1, y: 1, z: 1 }, colorSaturation: 0.9 }
applyStepSceneState({
  manager: {
    setCameraFilter: (...args) => calls.push(['camera', ...args]),
    setIdolBackgroundColorFilter: (...args) => calls.push(['idol', ...args]),
    setBgBlur: () => {}, setBgColor: () => {},
  },
  step: { step_id: 'filter' },
  state: { camera_filter: 'sepia', camera_filter_transition: { delay: 0.2, duration: 1.5 }, bg_profile: profile },
  nowMilliseconds,
})
assert.deepEqual(calls, [['camera', 'sepia', { delay: 0.2, duration: 1.5 }, nowMilliseconds], ['idol', profile]])

// Compiler: camera_color [name, delay, duration] and camera_defaultcolor [delay, duration] keep their timing.
const compiled = JSON.parse(execFileSync('python', ['-c', `
import json, sys
sys.path.insert(0, ${JSON.stringify(join(REPO, 'data_pipeline'))})
from sidem_scenario.compiler import ScenarioCompiler
c = ScenarioCompiler({}, 'verify_color_filter')
c._camera_color(['sepia', '0.5', '2'])
color = (c.state.camera_filter, c.state.camera_filter_transition)
c._camera_defaultcolor(['', '1'])
print(json.dumps([color, (c.state.camera_filter, c.state.camera_filter_transition)]))
`], { encoding: 'utf8' }))
assert.deepEqual(compiled, [['sepia', { delay: 0.5, duration: 2 }], [null, { delay: 0, duration: 1 }]])

// Local only: the presets must equal the client's TextAssets verbatim.
const rawCandidates = [join(REPO, 'RAW', 'asset'), 'E:/Web_build/SideM_Archived/RAW/asset']
const rawBundle = rawCandidates.map(dir => join(dir, COLOR_FILTER_PRESETS_BUNDLE)).find(existsSync)
if (rawBundle) {
  const native = JSON.parse(execFileSync('python', ['-c', `
import json, sys, UnityPy
out = {}
for obj in UnityPy.load(sys.argv[1]).objects:
    if obj.type.name == 'TextAsset':
        data = obj.read()
        script = data.m_Script if isinstance(data.m_Script, str) else data.m_Script.decode('utf-8')
        out[data.m_Name] = json.loads(script)
print(json.dumps(out))
`, rawBundle], { encoding: 'utf8' }))
  assert.deepEqual(Object.keys(native).sort(), Object.keys(CAMERA_COLOR_PRESETS).map(name => `color_preset_${name}`).sort())
  for (const [name, value] of Object.entries(CAMERA_COLOR_PRESETS)) {
    assert.deepEqual(native[`color_preset_${name}`], JSON.parse(JSON.stringify(value)), name)
  }
  console.log(`native presets: ${Object.keys(native).length} matched ${rawBundle}`)
} else {
  console.log('native presets: RAW bundle absent, TextAsset comparison skipped')
}
console.log('adv color filter: PASS')
