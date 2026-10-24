import assert from 'node:assert/strict'
import {
  sampleHitEffectFrame,
  sampleHoldEffectFrame,
  sampleAutoEvaluationFrame,
} from '../src/presentation/SongChartHitEffectRenderer.js'

// 1. Ordinary PERFECT (hitType 0) - 9-system deterministic sampling
const hit0 = { hitType: 0, pathId: 14650 }

// At t = 0.05: flash, shine, circles, glitter, speedlines active
const frame05 = sampleHitEffectFrame(hit0, 0.02)
assert.ok(frame05.length >= 8, 'Multiple layered systems active at 0.05s')
const flash = frame05.find(l => l.subName === 'flash')
assert.ok(flash, 'Flash layer present')
assert.equal(flash.textureId, 440)
assert.equal(flash.sx, 0)
assert.equal(flash.sy, 128) // frame 2 in 2x2 grid
assert.equal(flash.sw, 128)
assert.equal(flash.sh, 128)

const circle339 = frame05.find(l => l.subName === 'circle-339')
assert.ok(circle339, 'Circle 339 layer present')
assert.equal(circle339.textureId, 339)
assert.equal(circle339.sx, 0) // frame 0
assert.equal(circle339.sy, 0)
assert.equal(circle339.sw, 256) // 4x4 grid
assert.equal(circle339.sh, 256)

// At t = 0.15: second burst of circle-461 and glitter should be active
const frame15 = sampleHitEffectFrame(hit0, 0.15)
const burst1 = frame15.find(l => l.subName === 'circle-461-burst-0.1')
assert.ok(burst1, 'Second burst of circle-461 active at 0.15s')
assert.equal(burst1.textureId, 461)

// At t = 0.35: flash (0.3s) and speedline (0.3s) should be dead
const frame35 = sampleHitEffectFrame(hit0, 0.35)
assert.ok(!frame35.some(l => l.subName === 'flash'), 'Flash expired at 0.35s')
assert.ok(!frame35.some(l => l.subName === 'speedline-0'), 'Speedlines expired at 0.35s')
assert.ok(frame35.some(l => l.subName === 'circle-339'), 'Circle 339 still alive at 0.35s')

// At t = 0.71: all layers expired
const frame71 = sampleHitEffectFrame(hit0, 0.71)
assert.equal(frame71.length, 0, 'All 9 systems expired at 0.71s')

// 2. Flick hits (hitType 1, 2, 3)
const flickUp = sampleHitEffectFrame({ hitType: 1 }, 0.1)
const streakUp = flickUp.find(l => l.subName === 'flick-streak')
assert.ok(streakUp, 'Flick up streak present')
assert.equal(streakUp.textureId, 935)
assert.ok(streakUp.dy < 0, 'Flick up streak shoots upward (-Y)')

const flickRight = sampleHitEffectFrame({ hitType: 2 }, 0.1)
const streakRight = flickRight.find(l => l.subName === 'flick-streak')
assert.ok(streakRight, 'Flick right streak present')
assert.ok(streakRight.dx > 0, 'Flick right streak shoots rightward (+X)')

// 3. P-Skill (hitType 5)
const pskill = sampleHitEffectFrame({ hitType: 5 }, 0.1)
assert.ok(pskill.some(l => l.subName === 'pskill-frame'), 'P-Skill starframe present')
assert.ok(pskill.some(l => l.subName === 'pskill-frame-inner'), 'P-Skill starframe-inner present')

// 4. Special (hitType 6)
const special = sampleHitEffectFrame({ hitType: 6 }, 0.1)
assert.ok(special.some(l => l.subName === 'sp-m-mark'), 'Special M_mark present')
assert.ok(special.some(l => l.subName === 'sp-ring'), 'Special outer ring present')

// 5. Continuous Hold (5 systems)
const holdFrame = sampleHoldEffectFrame({ sourceIndex: 1 }, 0.5)
assert.ok(holdFrame.some(l => l.subName === 'hold-flash'), 'Hold flash present')
assert.ok(holdFrame.some(l => l.subName === 'hold-shine-1'), 'Hold shine present')
assert.ok(holdFrame.some(l => l.subName.startsWith('hold-glitter')), 'Hold glitter present')

// 6. Auto UI (3-layer EvalAnimationAuto)
const eval0 = sampleAutoEvaluationFrame(0.0)
assert.equal(eval0.layers.length, 3, 'All 3 layers active at t=0')

const eval2 = sampleAutoEvaluationFrame(0.20)
assert.equal(eval2.layers.length, 2, 'Layer 2 expired, Layer 1 & 3 active at 0.2s')
assert.equal(eval2.layers[0].target, 'EvaluationImage')
assert.equal(eval2.layers[0].scaleX, 1.0)
assert.equal(eval2.layers[0].alpha, 1.0)

const eval5 = sampleAutoEvaluationFrame(0.50)
assert.equal(eval5.layers.length, 1, 'Only Layer 1 active at 0.5s')
assert.equal(eval5.layers[0].alpha, 1.0)

const eval95 = sampleAutoEvaluationFrame(0.95)
assert.equal(eval95.layers.length, 1)
assert.ok(eval95.layers[0].alpha < 1.0 && eval95.layers[0].alpha > 0, 'Layer 1 fading out at 0.95s')

const eval105 = sampleAutoEvaluationFrame(1.05)
assert.equal(eval105, null, 'EvalAnimationAuto expired at 1.05s')

console.log('Prototype hit-effect sampler smoke passed: layer presence, direction and lifetime checks. These checks do not prove native curves, emission, UV or material parity.')
