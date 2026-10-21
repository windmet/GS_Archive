import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import {
  CAMERA_BLUR_ZOOM_RANGE,
  NATIVE_BACKGROUND_BLUR,
  backgroundBlurAlpha,
  backgroundBlurTarget,
  backgroundColorValue,
  cameraBlurAlpha,
  gaussianBlurFragment,
  gaussianBlurTaps,
  lerpBackgroundColor,
} from '../shared/story/BackgroundBlur.js'

// Growing/GaussianBlur: i = -10..10, weight exp2(-3.60673761 (i/10)^2) = exp(-2.5 (i/10)^2), normalized.
const taps = gaussianBlurTaps()
assert.equal(NATIVE_BACKGROUND_BLUR, 10)
assert.deepEqual(taps.map(tap => tap.offset), Array.from({ length: 21 }, (_, index) => index - 10))
const raw = taps.map(({ offset }) => Math.exp(-2.5 * (offset / 10) ** 2))
const total = raw.reduce((sum, value) => sum + value, 0)
taps.forEach((tap, index) => assert.ok(Math.abs(tap.weight - raw[index] / total) < 1e-7, `tap ${tap.offset}`))
assert.ok(Math.abs(taps.reduce((sum, tap) => sum + tap.weight, 0) - 1) < 1e-12)
assert.ok(Math.abs(taps[10].weight - 0.0909000) < 1e-6 && Math.abs(taps[0].weight - 0.0074615) < 1e-6)
// _Blur below 1 still runs the 3-tap loop of max(_Blur, 1).
assert.equal(gaussianBlurTaps(0.2).length, 3)

const fragment = gaussianBlurFragment()
const samples = [...fragment.matchAll(/texture2D\(uSampler, clamp\(vTextureCoord \+ step \* (-?\d+\.0), inputClamp\.xy, inputClamp\.zw\)\) \* ([\d.e-]+);/g)]
assert.equal(samples.length, 21, 'one clamped sample per tap')
samples.forEach((match, index) => {
  assert.equal(Number(match[1]), taps[index].offset)
  assert.ok(Math.abs(Number(match[2]) - taps[index].weight) < 1e-8)
})
assert.match(fragment, /vec2 step = uDirection \* inputSize\.zw;/, 'offsets are in input texels')
// Pixi's default filter vertex shader declares inputSize highp; a mediump redeclaration fails to link in WebGL.
assert.match(fragment, /uniform highp vec4 inputSize;/, 'inputSize precision matches the default filter vertex shader')

assert.equal(CAMERA_BLUR_ZOOM_RANGE, 0.56)
assert.deepEqual([0.9, 1, 1.28, 1.56, 2].map(cameraBlurAlpha), [0, 0, 0.5, 1, 1])
assert.deepEqual([-1, 0, 0.4, 1.5].map(backgroundBlurAlpha), [0, 0, 0.4, 1])
assert.deepEqual([null, undefined, '', 'x', 0.8, -1].map(backgroundBlurTarget), [0, 0, 0, 0, 0.8, -1])
assert.deepEqual([null, '', '#AAAAAA', 'aaaaaa', 'bad'].map(backgroundColorValue), [0xFFFFFF, 0xFFFFFF, 0xAAAAAA, 0xAAAAAA, null])
assert.equal(lerpBackgroundColor(0xFFFFFF, 0x000000, 0.5), 0x808080)
assert.equal(lerpBackgroundColor(0xFFFFFF, 0x224466, 0.5), 0x91A2B3)
assert.equal(lerpBackgroundColor(0x102030, 0x405060, 7), 0x405060)

// Local only: the client's shader source and the StoryCamera divisor.
const shader = ['../../.analysis/adv_native_effects_20261021/gaussian_shader.txt',
  'E:/Web_build/SideM_Archived/.analysis/adv_native_effects_20261021/gaussian_shader.txt']
  .map(path => path.startsWith('..') ? new URL(path, import.meta.url) : path).find(existsSync)
if (shader) {
  const source = readFileSync(shader, 'utf8')
  assert.match(source, /Shader "Growing\/GaussianBlur"/)
  assert.equal(source.match(/max\(_Blur, 1\.0\)/g)?.length >= 2, true)
  assert.match(source, /\* -3\.60673761;/)
  assert.match(source, /u_xlat1\.x = u_xlat8 \* _GrabTexture_TexelSize\.x;/)
  assert.match(source, /u_xlat1\.y = u_xlat8 \* _GrabTexture_TexelSize\.y;/)
  console.log(`native shader: Growing/GaussianBlur kernel matched ${shader}`)
} else {
  console.log('native shader: dump absent, kernel source comparison skipped')
}
const elf = 'E:/Tools/ghidra_work/sidem/libil2cpp.decrypted.so'
if (existsSync(elf)) {
  const bytes = readFileSync(elf)
  const phoff = Number(bytes.readBigUInt64LE(0x20)), count = bytes.readUInt16LE(0x38)
  let divisor = null
  for (let index = 0; index < count; index++) {
    const header = phoff + index * 56
    if (bytes.readUInt32LE(header) !== 1) continue
    const offset = Number(bytes.readBigUInt64LE(header + 8)), address = Number(bytes.readBigUInt64LE(header + 16))
    const size = Number(bytes.readBigUInt64LE(header + 32))
    // StoryCamera.BlurBackGround (RVA 0x1cbd100) divides by DAT_032cd06c.
    if (address <= 0x32cd06c && 0x32cd06c < address + size) divisor = bytes.readFloatLE(0x32cd06c - address + offset)
  }
  assert.ok(divisor !== null && Math.abs(divisor - CAMERA_BLUR_ZOOM_RANGE) < 1e-6, `client divisor ${divisor}`)
  console.log(`native divisor: ${divisor}`)
} else {
  console.log('native divisor: libil2cpp absent, constant comparison skipped')
}
console.log('adv background blur: PASS')
