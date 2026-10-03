// Native ordered lamps and RAW colors; pulse/wave curves are a recording-guided
// preview until the native director's tween/easing bodies have been decoded.
const clamp = value => Math.max(0, Math.min(1, value))
const rgb = value => /^#[\da-f]{6}$/i.test(value || '') ? parseInt(value.slice(1), 16) : 0xffffff
const mix = (a, b, t) => [16, 8, 0].reduce((color, shift) => color |
  (Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t) << shift), 0)
const takeStar = asset => {
  const match = /^fx_in_tkstp1_stagelight_(\d+)$/.exec(asset || '')
  return match && Number(match[1]) >= 1 && Number(match[1]) <= 16
}

function lampAt(state, time, index, count) {
  if (!state || state.previewSupported === false) return { color: 0xffffff, alpha: 0 }
  if (state.hideTime !== undefined) {
    const start = lampAt({ ...state, hideTime: undefined }, state.hideTime, index, count)
    return { color: start.color, alpha: start.alpha * (1 - clamp(
      (time - state.hideTime) / Math.max(1, state.fadeDuration || 1))) }
  }
  const elapsed = Math.max(0, time - state.time)
  const period = Math.max(1, state.period || 1)
  let color = rgb(state.color)
  let alpha = 1
  if (state.colorMode === 2) color = mix(state.fromColor, color, clamp(elapsed / period))
  if (state.colorMode === 1 && takeStar(state.asset)) {
    // Take authors each hanging star as its own command. Odd/even groups restart
    // 225 ms apart with a 450 ms period; do not phase all 16 by a shared index.
    // Recording-guided continuous envelope, not a recovered Unity tween body.
    const phase = elapsed % period
    // The reference starts a star dim, then rises and falls. Ground mode 5
    // starts bright; using that envelope here inverts the visible star phase.
    alpha = 1 - Math.abs(2 * phase / period - 1)
  }
  if (state.colorMode === 5) {
    // The interval belongs to successive entries in the native renderer array,
    // not to a shared fade followed by a black hold. Take's 450/225 commands
    // alternate adjacent lamps. A continuous triangular envelope is the bounded
    // recording-guided approximation; native tween easing remains unverified.
    const order = state.direction === 1 ? count - index - 1 : index
    const phase = ((elapsed - order * (state.interval || 0)) % period + period) % period
    alpha = Math.abs(2 * phase / period - 1)
  }
  if (state.alphaMode === 1 && count > 1) {
    const order = state.direction === 1 ? count - index - 1 : index
    const wavePeriod = Math.max(1, state.alphaPeriod || period)
    const phase = ((elapsed / wavePeriod - order / count) % 1 + 1) % 1
    alpha *= .5 + .5 * Math.cos(phase * Math.PI * 2)
  }
  return { color, alpha }
}

export function stagelightStatesAt(events = [], time = 0) {
  const states = new Map()
  for (const event of events) {
    if (event.time > time) break
    const previous = states.get(event.id)
    if (event.hide) {
      if (previous) states.set(event.id, { ...previous, hideTime: event.time,
        fadeDuration: event.fadeDuration })
      continue
    }
    states.set(event.id, { ...event,
      fromColor: previous ? lampAt(previous, event.time, 0, 1).color : rgb(event.color) })
  }
  return states
}

export function sampleStagelight(state, time, index = 0, count = 1) {
  return lampAt(state, time, index, count)
}

export function createStagelightRuntime(PIXI, parent, layers, textures) {
  const container = new PIXI.Container()
  container.sortableChildren = true
  const frameTextures = []
  const sprites = layers.map((layer, index) => {
    let texture = textures[index]
    if (layer.crop) {
      const {x,y,width,height} = layer.crop
      texture = new PIXI.Texture(texture.baseTexture,new PIXI.Rectangle(x,y,width,height))
      frameTextures.push(texture)
    }
    const sprite = new PIXI.Sprite(texture)
    sprite.anchor.set(layer.anchorX, layer.anchorY)
    sprite.position.set(layer.x, layer.y)
    sprite.scale.set(layer.scaleX, layer.scaleY)
    sprite.rotation = layer.rotation || 0
    sprite.zIndex = layer.sortingOrder || 0
    sprite.blendMode = PIXI.BLEND_MODES.ADD
    container.addChild(sprite)
    return sprite
  })
  parent.addChild(container)
  return { container, sprites, frameTextures }
}

export function applyNativeLampColor(lamp, layer) {
  const color = layer.nativeColor
  if (!color) return lamp
  return {color:[16,8,0].reduce((out,shift,i)=>out | (Math.round(((lamp.color>>shift)&255)*color[['r','g','b'][i]])<<shift),0),
    alpha:lamp.alpha*color.a}
}
