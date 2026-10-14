import { nativeLightScreenLayout } from './chibiNativeLightProjection.js'
// Native command channels and LiveStage's design-plane registration.
const clamp = x => Math.max(0, Math.min(1, x))
const number = (values, i, fallback = 0) => values[i] === '' || values[i] == null ? fallback : Number(values[i])
const outQuad = x => 1 - (1 - x) ** 2
const linear = x => x
const inOutSine = x => (1 - Math.cos(Math.PI * x)) / 2
const mix = (a, b, t) => a + (b - a) * t

export const NEW_SUSPENSIONLIGHT_COMMANDS = ['create', 'normal_show', 'beat_show', 'coloranim', 'rotateanim', 'scaleanim', 'fade']
  .map(name => `NewSuspensionlight_${name}`)

// ColorAnim (0x221f55c): HSV interpolation follows the authored direction,
// including a full turn for equal hues. The return leg keeps that direction.
function rgb(color) {
  if (Array.isArray(color)) return color
  let hex = String(color || '').replace(/^#/, '')
  if (hex.length === 3 || hex.length === 4) hex = [...hex].map(c => c + c).join('')
  if (!/^[\da-f]{6}([\da-f]{2})?$/i.test(hex)) return [0, 0, 0]
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
}
function hsv(color) {
  const [r, g, b] = rgb(color), max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  const h = !d ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, max ? d / max : 0, max]
}
function rgbFromHsv([h, s, v]) {
  h = ((h % 1) + 1) % 1 * 6
  const c = v * s, x = c * (1 - Math.abs(h % 2 - 1)), m = v - c
  const channels = [[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][Math.floor(h)]
  return channels.map(c => clamp(c + m))
}
function colorAt(channel, time) {
  const age = Math.max(0, time - channel.time), duration = channel.duration
  let from = channel.from, to = channel.to, progress = duration > 0 ? age / duration : 1
  if (channel.mode === 1) progress = duration > 0 ? progress % 1 : 1
  if (channel.mode === 3 && duration > 0) {
    const phase = (age % duration) / (duration / 2)
    if (phase >= 1) { from = channel.to; to = channel.returnTo }
    progress = phase % 1
  }
  return rgbFromHsv(from.map((value, i) => mix(value, to[i], outQuad(clamp(progress)))))
}
function startColor(state, event) {
  const v = event.values, mode = number(v, 1)
  state.colorTween = null
  state.palette = null
  if (mode === 4) {
    // Native palette starts with the current color, then nonempty value3/6/7/8.
    state.palette = { colors: [state.color, ...[2,5,6,7].map(i => v[i]).filter(Boolean)], index: 0 }
  } else if ([1,2,3].includes(mode)) {
    const from = hsv(state.color), to = mode === 1 ? [...from] : hsv(v[2])
    const returnTo = [...from], direction = number(v, 4)
    if (direction === 1) { if (to[0] <= from[0]) to[0] += 1; returnTo[0] += 1 }
    if (direction === 0) { if (to[0] >= from[0]) to[0] -= 1; returnTo[0] -= 1 }
    state.colorTween = { time: event.time, duration: Math.max(0, number(v, 3)), mode, from, to, returnTo }
  }
}

// BeatShow captures curTempo at command time; later tempo changes do not
// retime this sequence. Until offset semantics are verified, only constant
// validated charts supply a tempo in the viewer.
export function constantSuspensionTempo(chart) {
  const values = chart?.tempos?.map(t => Number(t.tempo)) || []
  return values.length && values.every(t => Number.isFinite(t) && t > 0 && t === values[0]) ? values[0] : null
}

// Durations stay in authored milliseconds. Unity Float getters divide by
// 1000, and its tween clock uses seconds. Restart loops include both waits.
function tweenAt(tween, time) {
  let age = Math.max(0, time - tween.time)
  const period = tween.rise + tween.hold + tween.fall + tween.wait
  if (tween.loop && period > 0) age %= period
  if (age < tween.rise) return mix(tween.from, tween.to, tween.ease(clamp(age / tween.rise)))
  if (!tween.loop || age < tween.rise + tween.hold) return tween.to
  age -= tween.rise + tween.hold
  if (age < tween.fall) return mix(tween.to, tween.from, tween.ease(clamp(age / tween.fall)))
  return tween.from
}

function envelopeAt(state, time) {
  if (!state.show || time < state.show.time) return state.envelope
  return tweenAt(state.show, time)
}

function advance(state, time) {
  // FadeInner completion kills the show channel and freezes its multiplier.
  // A fade is not a show command and does not activate a light.
  const fadeComplete = state.fade && !state.fade.loop && time >= state.fade.time + state.fade.rise
  const showTime = fadeComplete ? state.fade.time + state.fade.rise : time
  if (state.show) {
    const period = state.show.rise + state.show.hold + state.show.fall + state.show.wait
    const completed = period > 0 ? Math.max(0, Math.floor((showTime - state.show.time) / period)) : 0
    if (state.palette && completed > state.show.completed) {
      state.palette.index = (state.palette.index + completed - state.show.completed) % state.palette.colors.length
      state.color = state.palette.colors[state.palette.index]
    }
    state.show.completed = completed
  }
  if (state.colorTween) state.color = colorAt(state.colorTween, time)
  if (fadeComplete) {
    state.envelope = envelopeAt(state, showTime)
    state.show = null
    state.opacity = state.fade.to
    state.fade = null
  }
  state.envelope = envelopeAt(state, time)
  if (state.fade) state.opacity = tweenAt(state.fade, time)
  if (state.rotation) state.angle = tweenAt(state.rotation, time)
  if (state.scale) {
    state.scaleX = tweenAt(state.scale.x, time)
    state.scaleY = tweenAt(state.scale.y, time)
  }
  return state.eraseAt == null || time < state.eraseAt
}

function tween(time, from, to, rise, hold = 0, fall = 0, wait = 0, loop = false, ease = outQuad) {
  return { time, from, to, rise: Math.max(0, rise), hold: Math.max(0, hold),
    fall: Math.max(0, fall), wait: Math.max(0, wait), loop, ease }
}

export function newSuspensionlightsAt(events = [], time = 0, registration = {}) {
  const instances = new Map()
  for (const event of events) {
    if (event.time > time) break
    const v = event.values
    let state = instances.get(event.id)
    if (state && !advance(state, event.time)) { instances.delete(event.id); state = null }
    // value101 is the erase switch; value102 is its fade duration. Both are
    // retained in existing sidecars, so no corpus rewrite is needed.
    const erase = event.extraValues?.value101 != null ? event.extraValues.value101 === '1' : event.erase
    if (erase) {
      if (state) {
        const duration = Math.max(0, Number(event.extraValues?.value102) || 0)
        state.fade = tween(event.time, state.opacity, 0, duration)
        state.eraseAt = event.time + duration
        if (!duration) instances.delete(event.id)
      }
      continue
    }
    if (event.command === 'NewSuspensionlight_create') {
      // Create is a new generation: do not inherit an earlier show/tween for
      // the reused ID. Incomplete asset-less create rows never create a beam.
      instances.set(event.id, { id: event.id, asset: v[1], time: event.time,
        opacity: number(v, 2) / 1000, scaleX: number(v, 3) / 1000,
        scaleY: number(v, 4) / 1000, angle: number(v, 5), x: number(v, 6),
        y: number(v, 7), color: v[8], depth: number(v, 9, 1650), envelope: 0, active: false })
      continue
    }
    if (!state) continue
    if (event.command === 'NewSuspensionlight_normal_show') {
      state.active = true
      state.showUnresolved = null
      state.show = tween(event.time + number(v, 1), 0, 1,
        number(v, 2), number(v, 3), number(v, 4), number(v, 5), true)
      state.show.completed = 0
    } else if (event.command === 'NewSuspensionlight_beat_show') {
      const tempo = typeof registration.tempoAt === 'function' ? registration.tempoAt(event.time) : registration.tempo
      state.active = true
      state.envelope = 0
      state.show = null
      state.showUnresolved = tempo > 0 && Number.isFinite(tempo) ? null : 'tempo_unavailable'
      if (!state.showUnresolved) {
        const beat = 60000 / tempo, wait = beat * number(v, 3) / 1000
        const delay = number(v, 1) === 0 ? beat / 2 + wait : 0
        state.show = tween(event.time + delay, 0, 1, beat / 2, beat * number(v, 2) / 1000, beat / 2, wait, true)
        state.show.completed = 0
      }
    } else if (event.command === 'NewSuspensionlight_coloranim') {
      startColor(state, event)
    } else if (event.command === 'NewSuspensionlight_rotateanim') {
      const mode = number(v, 1)
      state.rotation = null // Kill only rotation, preserving the current angle.
      if ([1, 2, 3].includes(mode)) state.rotation = tween(event.time, state.angle, number(v, 2),
        number(v, 3), number(v, 4), mode === 3 ? number(v, 5) : 0,
        mode === 3 ? number(v, 6) : 0, mode !== 1, number(v, 7) === 0 ? linear : inOutSine)
    } else if (event.command === 'NewSuspensionlight_scaleanim') {
      state.scale = null
      if ([1, 2].includes(number(v, 7))) {
        const make = (from, to) => tween(event.time, from, to / 1000,
          number(v, 3), number(v, 4), number(v, 5), number(v, 6), number(v, 7) === 2)
        state.scale = { x: make(state.scaleX, number(v, 1)), y: make(state.scaleY, number(v, 2)) }
      }
    } else if (event.command === 'NewSuspensionlight_fade') {
      const mode = number(v, 6)
      if ([1, 2].includes(mode)) {
        state.eraseAt = null // Kill also cancels a pending erase completion callback.
        state.fade = tween(event.time, state.opacity, number(v, 1) / 1000,
          number(v, 2), number(v, 3), number(v, 4), number(v, 5), mode === 2)
      }
    } else {
      state.unresolved = event.command
    }
  }
  return [...instances.values()].filter(state => advance(state, time)).map(state => ({ ...state,
    // Keep floats while replaying interruptions; quantize only at PIXI's tint boundary.
    color: '#' + rgb(state.color).map(c => Math.round(clamp(c) * 255).toString(16).padStart(2, '0')).join(''),
    alpha: state.active && !state.unresolved && !state.showUnresolved ? clamp(state.envelope) * clamp(state.opacity) : 0 }))
}

export function suspensionlightLayout(state, width, height, environmentScale = 1) {
  return nativeLightScreenLayout(state, width, height, environmentScale)
}
