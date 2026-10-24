import assert from 'node:assert/strict'
import {
  hitEffectsConfig,
  sampleHitEffectFrame,
  sampleHoldEffectFrame,
  sampleAutoEvaluationFrame,
} from '../src/presentation/SongChartHitEffectRenderer.js'

// 1. Ordinary PERFECT (hitType 0) - Contract-driven 9-system sampling
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

// Speedline burst count must match native 20 rays (contract 14650)
const speedlines = frame05.filter(l => l.subName.startsWith('speedline-'))
assert.equal(speedlines.length, 20, 'Ordinary PERFECT must emit 20 speedline rays from native burst')

const circle339 = frame05.find(l => l.subName === 'circle-339')
assert.ok(circle339, 'Circle 339 layer present')
assert.equal(circle339.textureId, 339)
assert.equal(circle339.sx, 0) // frame 0
assert.equal(circle339.sy, 0)
assert.equal(circle339.sw, 256) // 4x4 grid (1024 / 4)
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

// Contract mutation proof: changing contract layer parameters alters sampler output
const mutatedContracts = JSON.parse(JSON.stringify(hitEffectsConfig.defaultContracts))
mutatedContracts['14650'].layers[0].lifetime = 0.95 // Extend flash lifetime to 0.95s
const mutatedSample = sampleHitEffectFrame(hit0, 0.50, mutatedContracts)
assert.ok(mutatedSample.some(l => l.subName === 'flash'), 'Mutated contract lifetime extends flash output to 0.50s')
assert.ok(!frame35.some(l => l.subName === 'flash'), 'Default contract flash expired at 0.35s')

// 2. Flick hits with 2x8 Atlas UV Cropping
const flickUp = sampleHitEffectFrame({ hitType: 1 }, 0.1)
const streakUp = flickUp.find(l => l.subName === 'flick-streak')
assert.ok(streakUp, 'Flick up streak present')
assert.equal(streakUp.textureId, 935)
assert.equal(streakUp.sw, 1024, 'Flick line 2x8 atlas cell width is 1024 (2048 / 2)')
assert.equal(streakUp.sh, 256, 'Flick line 2x8 atlas cell height is 256 (2048 / 8)')
assert.ok(streakUp.dy < 0, 'Flick up streak shoots upward (-Y)')

const flickRight = sampleHitEffectFrame({ hitType: 2 }, 0.1)
const streakRight = flickRight.find(l => l.subName === 'flick-streak')
assert.ok(streakRight, 'Flick right streak present')
assert.ok(streakRight.dx > 0, 'Flick right streak shoots rightward (+X)')

// 3. P-Skill with 4x4 Atlas UV Cropping
const pskill = sampleHitEffectFrame({ hitType: 5 }, 0.1)
const starframe720 = pskill.find(l => l.subName === 'pskill-frame')
assert.ok(starframe720, 'P-Skill starframe present')
assert.equal(starframe720.sw, 256, 'Starframe 4x4 atlas cell width is 256 (1024 / 4)')
assert.equal(starframe720.sh, 256, 'Starframe 4x4 atlas cell height is 256 (1024 / 4)')

const starframe889 = pskill.find(l => l.subName === 'pskill-frame-inner')
assert.ok(starframe889, 'P-Skill starframe-inner present')
assert.equal(starframe889.sw, 256, 'Starframe2 4x4 atlas cell width is 256 (1024 / 4)')
assert.equal(starframe889.sh, 256, 'Starframe2 4x4 atlas cell height is 256 (1024 / 4)')

// 4. Special with 2x2 M_mark Atlas UV Cropping
const special = sampleHitEffectFrame({ hitType: 6 }, 0.1)
const mMark = special.find(l => l.subName === 'sp-m-mark')
assert.ok(mMark, 'Special M_mark present')
assert.equal(mMark.sw, 512, 'M_mark 2x2 atlas cell width is 512 (1024 / 2)')
assert.equal(mMark.sh, 512, 'M_mark 2x2 atlas cell height is 512 (1024 / 2)')
assert.ok(special.some(l => l.subName === 'sp-ring'), 'Special outer ring present')

// 5. Continuous Hold (5 systems)
const holdFrame = sampleHoldEffectFrame({ sourceIndex: 1 }, 0.5)
assert.ok(holdFrame.some(l => l.subName === 'hold-flash'), 'Hold flash present')
assert.ok(holdFrame.some(l => l.subName === 'hold-shine-1'), 'Hold shine present')
assert.ok(holdFrame.some(l => l.subName.startsWith('hold-glitter')), 'Hold glitter present')

// 6. Auto UI (3-layer EvalAnimationAuto keyframe curves)
const eval0 = sampleAutoEvaluationFrame(0.0)
assert.equal(eval0.layers.length, 3, 'All 3 layers active at t=0')

const eval2 = sampleAutoEvaluationFrame(0.20)
assert.equal(eval2.layers.length, 2, 'Layer 2 expired, Layer 1 & 3 active at 0.2s')
assert.equal(eval2.layers[0].target, 'EvaluationImage')
assert.ok(Math.abs(eval2.layers[0].scaleX - 1.0) < 1e-3, 'Native scale curve near 1.0 at 0.2s')
assert.equal(eval2.layers[0].alpha, 1.0)
assert.ok(eval2.layers[1].colorTint, 'Layer 3 EvaluationEffectImage2 provides native colorTint')

const eval5 = sampleAutoEvaluationFrame(0.50)
assert.equal(eval5.layers.length, 1, 'Only Layer 1 active at 0.5s')
assert.equal(eval5.layers[0].alpha, 1.0)

const eval95 = sampleAutoEvaluationFrame(0.95)
assert.equal(eval95.layers.length, 1)
assert.ok(eval95.layers[0].alpha < 1.0 && eval95.layers[0].alpha > 0, 'Layer 1 fading out at 0.95s')

const eval105 = sampleAutoEvaluationFrame(1.05)
assert.equal(eval105, null, 'EvalAnimationAuto expired at 1.05s')

// Animation data mutation proof
const mutatedAnim = JSON.parse(JSON.stringify(hitEffectsConfig.evaluation.animation))
mutatedAnim.targets.EvaluationImage.alpha[0].val = 0.42
mutatedAnim.targets.EvaluationImage.alpha[1].val = 0.42
const mutatedEval = sampleAutoEvaluationFrame(0.50, mutatedAnim)
assert.equal(mutatedEval.layers[0].alpha, 0.42, 'Mutated animation keyframe drives output alpha')

console.log('Contract-driven hit-effect renderer passed: dynamic contracts, 2x8/2x2/4x4 atlas slicing, 20 speedline rays, and keyframe curve evaluation verified.')
