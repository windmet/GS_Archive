import { nativeLightScreenLayout } from './chibiNativeLightProjection.js'
// Native command channels and LiveStage's design-plane registration.
const clamp = x => Math.max(0, Math.min(1, x))
const number = (values, i, fallback = 0) => values[i] === '' || values[i] == null ? fallback : Number(values[i])
const outQuad = x => 1 - (1 - x) ** 2
const linear = x => x
const inOutSine = x => (1 - Math.cos(Math.PI * x)) / 2
const mix = (a, b, t) => a + (b - a) * t

export const NEW_SUSPENSIONLIGHT_COMMANDS = ['create', 'normal_show', 'rotateanim', 'scaleanim', 'fade']
  .map(name => `NewSuspensionlight_${name}`)

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
  if (state.fade && !state.fade.loop && time >= state.fade.time + state.fade.rise) {
    state.envelope = envelopeAt(state, state.fade.time + state.fade.rise)
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

export function newSuspensionlightsAt(events = [], time = 0) {
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
      state.show = tween(event.time + number(v, 1), 0, 1,
        number(v, 2), number(v, 3), number(v, 4), number(v, 5), true)
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
      // Beat timing and HSV/continuous color commands remain unresolved.
      state.unresolved = event.command
    }
  }
  return [...instances.values()].filter(state => advance(state, time)).map(state => ({ ...state,
    alpha: state.active && !state.unresolved ? clamp(state.envelope) * clamp(state.opacity) : 0 }))
}

export function suspensionlightLayout(state, width, height, environmentScale = 1) {
  return nativeLightScreenLayout(state, width, height, environmentScale)
}
