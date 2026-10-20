// Native ADV placement (client 2.6.10): stage geometry, figure placement data and compiled-scenario coverage.
// Values below are independent arithmetic from the decompiled client, not reads of AdvStageLayout's constants.
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import {
  advHorizontalSqueeze, advStageUnit, advToScreen, advVisibleWidth, backgroundPanelRect, backgroundScreenSize, idolSlotPosition, skeletonFigureScreen, textureFigureScreen,
} from '../shared/story/AdvStageLayout.js'

const root = new URL('..', import.meta.url)
const close = (actual, expected, label = '') => assert.ok(Math.abs(actual - expected) < 1e-6, `${label} ${actual} != ${expected}`)

// StoryCamera: orthographicSize 4.347826 world units, canvas 72 units per world unit.
const viewHeight = 2 * 4.347826 * 72
close(advStageUnit(1280, 720), 720 / viewHeight, '16:9')
close(advStageUnit(2560, 720), 720 / viewHeight, 'wider keeps the height')
close(advStageUnit(720, 720), 720 / (viewHeight * 16 / 9), 'narrower keeps the 16:9 width')
// Portrait has no native rule: the visible width narrows continuously from the 16:9 width (aspect 1) to 496 (1:2),
// the 1.25x upper-body framing of 620.
close(advVisibleWidth(1), viewHeight * 16 / 9, 'square keeps the native width')
assert.ok(Math.abs(advVisibleWidth(0.999999) - advVisibleWidth(1)) < 0.01, 'continuous at square')
close(advVisibleWidth(0.5), 496, 'narrowest')
close(advVisibleWidth(0.3), 496, 'clamped')
close(advStageUnit(390, 844), 390 / (496 + (viewHeight * 16 / 9 - 496) * Math.max(0, (390 / 844 - 0.5) / 0.5)), 'phone portrait')
assert.ok(advStageUnit(390, 844) > 390 / (viewHeight * 16 / 9), 'portrait figures are larger than the 16:9 width fit')
close(advHorizontalSqueeze(1280, 720), 1, 'landscape not squeezed')
close(advHorizontalSqueeze(720, 720), 1, 'square not squeezed')
close(advHorizontalSqueeze(390, 844), 496 / (viewHeight * 16 / 9), 'portrait squeeze')
// Slot offsets do not grow with the figures: +-x lands where a 16:9-width fit puts it.
close(advToScreen(390, 844, 350, 0).x, 195 + 350 * 390 / (viewHeight * 16 / 9), 'portrait x squeezed')
assert.ok(advToScreen(390, 844, 350, 0).x < 390, 'a +-350 slot stays on a phone screen')
assert.deepEqual(advToScreen(1280, 720, 0, 0), { x: 640, y: 360 })
// Portrait figures grow down from the native view's top edge, which stays at its square-screen place (7/32 of
// the height), so their cut-off lower edge passes below the screen instead of hanging in view.
close(advToScreen(720, 720, 0, 0).y, 360, 'square stays centred')
close(advToScreen(720, 720, 0, viewHeight / 2).y, 720 * 7 / 32, 'square view top')
assert.ok(Math.abs(advToScreen(999.999, 1000, 0, 0).y - 500) < 0.01, 'continuous at square')
for (const [width, height] of [[600, 800], [390, 780], [400, 800], [390, 844], [320, 740]]) {
  close(advToScreen(width, height, 0, viewHeight / 2).y, height * 7 / 32, `${width}x${height} view top fixed`)
}
// Down to 1:2 the screen bottom never reaches lower into the canvas than on a square screen (-16:9 width / 2),
// where figures' cut-off edges already sit below it; the centred placement at 620 reached past it and showed them.
const bottomCanvasY = (width, height) => (advToScreen(width, height, 0, 0).y - height) / advStageUnit(width, height)
for (const [width, height] of [[600, 800], [390, 780], [400, 800]]) {
  assert.ok(bottomCanvasY(width, height) >= -viewHeight * 16 / 9 / 2 - 1e-9, `${width}x${height} screen bottom ${bottomCanvasY(width, height)}`)
}
// The background panel stays centred on the canvas origin and still covers the whole screen.
for (const [width, height] of [[1280, 720], [2560, 720], [720, 720], [600, 800], [390, 844], [320, 740]]) {
  const rect = backgroundPanelRect(width, height)
  close(rect.y + rect.height / 2, advToScreen(width, height, 0, 0).y, `${width}x${height} panel centre`)
  assert.ok(rect.x <= 1e-9 && rect.y <= 1e-9 && rect.x + rect.width >= width - 1e-9 && rect.y + rect.height >= height - 1e-9, `${width}x${height} panel covers`)
}

// IdolCharacter under NotChangedPriority (0, -50): idol_position + idol_zoom position.
assert.deepEqual(idolSlotPosition({ posX: -200, posY: 10, zoomX: 5, zoomY: -50 }), { x: -195, y: -90 })
assert.deepEqual(idolSlotPosition(), { x: 0, y: -50 })

// Skeleton figure: prefab root y scales with the slot; 1/300 world units per spine px = 1/3 canvas unit.
const unit = 720 / viewHeight
const frog = skeletonFigureScreen(1280, 720, idolSlotPosition({}), -630, 1)
close(frog.x, 640); close(frog.y, 360 + 680 * unit, 'frog root'); close(frog.scale, unit / 3)
const zoomed = skeletonFigureScreen(1280, 720, idolSlotPosition({ zoomY: -50 }), -560, 1.2)
close(zoomed.y, 360 - (-100 - 560 * 1.2) * unit, 'zoomed root'); close(zoomed.scale, unit * 1.2 / 3)

// Texture figure: sprite rect bottom-centre at positionY; the PNG is the packed rect at textureRectOffset.
const omn = { positionY: -640, size: [490, 897], offset: [9.076, 15.076], image: [471, 872] }
const placedOmn = textureFigureScreen(1280, 720, idolSlotPosition({}), omn, omn.positionY, 1)
close(placedOmn.x, 640 + (-245 + 9.076) * unit, 'omn left')
close(placedOmn.y, 360 - (-50 - 640 + 15.076 + 872) * unit, 'omn top')
close(placedOmn.scale, unit)

// AdventureBackgroundPanel 1800x960 at orthographicSize / 5 covers 4/3 of the view height.
const panel = backgroundScreenSize(1280, 720)
close(panel.height / 720, 4 / 3, 'panel covers 4/3')
close(panel.width / panel.height, 1800 / 960)
console.log('Native ADV geometry: view unit, idol slot, skeleton and texture figures, background panel')

// Placement data: every compiled actor model resolves to a prefab root or a texture rect, unless the client
// itself ships no figure for it (checked against RAW when available).
const placement = JSON.parse(readFileSync(new URL('public/data/idolsetting/idol_figure_placement.json', root), 'utf8'))
assert.equal(placement.schema, 'GS-IDOL-FIGURE-PLACEMENT-V1')
for (const [model, y] of Object.entries(placement.skeletons)) assert.ok(Number.isFinite(y) && y < 0, `${model} prefab y ${y}`)
for (const [model, texture] of Object.entries(placement.textures)) {
  assert.ok(Number.isFinite(texture.positionY), model)
  assert.ok(texture.image[0] <= texture.size[0] + 1 && texture.image[1] <= texture.size[1] + 1, `${model} packed rect fits`)
}
assert.equal(placement.skeletons['010pie_001_00'], -630)
// Site spines and compiled scenarios are gitignored corpus; CI checks the tracked placement data above.
if (process.argv.includes('--published-assets')) {
const spineDir = new URL('public/assets/spines/', root)
for (const model of readdirSync(spineDir)) {
  if (!existsSync(new URL(`${model}/`, spineDir)) || !readdirSync(new URL(`${model}/`, spineDir)).length) continue
  assert.ok(Object.hasOwn(placement.skeletons, model), `site spine ${model} has a prefab root y`)
}
const models = new Map()
const compiledDir = new URL('public/data/compiled/', root)
const walk = dir => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir)
    if (entry.isDirectory()) { walk(url); continue }
    if (!entry.name.endsWith('.json')) continue
    let data
    try { data = JSON.parse(readFileSync(url, 'utf8')) } catch { continue }
    for (const step of Array.isArray(data?.steps) ? data.steps : []) {
      for (const state of [step.state, step.entry_snapshot]) {
        for (const spine of state?.spines || []) if (spine?.model && !models.has(spine.model)) models.set(spine.model, entry.name)
      }
    }
  }
}
walk(compiledDir)
const rawDir = 'E:/Web_build/SideM_Archived/RAW/asset'
const uncovered = [...models.keys()].filter(model => !Object.hasOwn(placement.skeletons, model) && !Object.hasOwn(placement.textures, model))
for (const model of uncovered) {
  assert.ok(!existsSync(new URL(`${model}/comu.skel`, spineDir)), `${model} has a site spine but no placement`)
  if (existsSync(rawDir)) assert.ok(!existsSync(`${rawDir}/costume_${model}.unity3d`), `${model} has a RAW costume bundle but no placement`)
}
console.log(`Figure placement: ${models.size} compiled actor models, ${models.size - uncovered.length} placed; without any client figure: ${uncovered.join(' ') || 'none'}`)
}
