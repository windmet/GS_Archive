// Native story background blur and colour (client 2.6.10).
// - LoadBackgroundAsset renders every background sprite once through GaussianBlurConverter.Apply(scale 1.0,
//   _Blur 10.0); material GaussianBlur / shader Growing/GaussianBlur is two separable GrabPass passes
//   (x, then y) over i = -B..B texels, B = max(_Blur, 1), weight exp2(-3.60673761 * (i / B)^2), normalized.
// - AdventureBackgroundPanel.BlurBackGround(v) sets the CanvasGroup alpha of that blurred image, laid over
//   the sharp one, to clamp01(v). image_bg_dof [delay, duration, amount] runs SetOffsetBlur, which lerps
//   linearly from the previous amount target to the new one; StoryCamera.BlurBackGround overwrites the alpha
//   with (zoom - 1) / 0.56 on every MoveCamera frame. BackgroundChange does not reset either.
// - image_bg_color lerps both images' Image.color linearly (Color.Lerp) from the current colour.

export const NATIVE_BACKGROUND_BLUR = 10
export const CAMERA_BLUR_ZOOM_RANGE = 0.56

const clamp01 = value => Math.min(1, Math.max(0, value))

/** Taps of one Growing/GaussianBlur pass: texel offsets and normalized weights. */
export function gaussianBlurTaps(blur = NATIVE_BACKGROUND_BLUR) {
  const radius = Math.max(blur, 1)
  const taps = []
  for (let offset = -radius; offset <= radius; offset += 1) {
    taps.push({ offset, weight: 2 ** (((offset / radius) ** 2) * -3.60673761) })
  }
  const total = taps.reduce((sum, tap) => sum + tap.weight, 0)
  return taps.map(tap => ({ offset: tap.offset, weight: tap.weight / total }))
}

/** Pixi v7 filter fragment for one pass along uDirection, clamped to the input like a GrabPass edge. */
export function gaussianBlurFragment(blur = NATIVE_BACKGROUND_BLUR) {
  const samples = gaussianBlurTaps(blur).map(({ offset, weight }) =>
    `  color += texture2D(uSampler, clamp(vTextureCoord + step * ${offset.toFixed(1)}, inputClamp.xy, inputClamp.zw)) * ${weight.toPrecision(9)};`)
  return [
    'varying vec2 vTextureCoord;',
    'uniform sampler2D uSampler;',
    'uniform highp vec4 inputSize;',
    'uniform vec4 inputClamp;',
    'uniform vec2 uDirection;',
    'void main(void) {',
    '  vec2 step = uDirection * inputSize.zw;',
    '  vec4 color = vec4(0.0);',
    ...samples,
    '  gl_FragColor = color;',
    '}',
  ].join('\n')
}

/** BlurBackGround alpha written by a camera move frame. */
export function cameraBlurAlpha(zoom) {
  return clamp01((Number(zoom) - 1) / CAMERA_BLUR_ZOOM_RANGE)
}

/** BlurBackGround alpha for an offset-blur value. */
export function backgroundBlurAlpha(value) {
  return clamp01(Number(value) || 0)
}

/** image_bg_dof amount; an empty column is ConvertFloat("") = 0. */
export function backgroundBlurTarget(dof) {
  const value = Number(dof)
  return dof == null || !Number.isFinite(value) ? 0 : value
}

/** Image.color of an image_bg_color hex (white when cleared), or null when unparseable. */
export function backgroundColorValue(value) {
  if (!value) return 0xFFFFFF
  return typeof value === 'string' && /^#?[a-fA-F0-9]{6}$/.test(value) ? parseInt(value.replace('#', ''), 16) : null
}

/** Color.Lerp of two 0xRRGGBB colours, rounded to 8-bit channels. */
export function lerpBackgroundColor(from, to, t) {
  const k = clamp01(t)
  return [16, 8, 0].reduce((color, shift) => {
    const a = (from >> shift) & 255, b = (to >> shift) & 255
    return color | (Math.round(a + (b - a) * k) << shift)
  }, 0)
}
