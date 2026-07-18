import { isRuntimeCueChannelEnabled } from './story-runtime/RuntimeFeatureFlags.js'

export function applyStepSceneState({
  manager,
  step,
  state,
  fallbackBg = null,
  lastScreenEffectsKey = '',
  resetScreenEffects = false,
}) {
  if (!manager || !state) return lastScreenEffectsKey

  if (resetScreenEffects) {
    manager.clearScreenEffects?.()
    lastScreenEffectsKey = ''
  }

  manager.setCameraFilter(null)
  manager.applyBgEffects?.(state.bg_effects || [], state.bg_profile || null)

  const bg = state.bg || fallbackBg
  if (!isRuntimeCueChannelEnabled('background')) {
    if (bg) manager.setBackground(bg, state.bg_transition || null)
    else manager.clearBackground()
  }

  if (state.camera_filter) manager.setCameraFilter(state.camera_filter)

  const bgDofTransition = state.bg_dof_transition || {}
  const bgColorTransition = state.bg_color_transition || {}
  const keepHeartVoiceBlur = state.bg_color && state.bg_color !== '#FFFFFF'
  manager.setBgBlur(
    keepHeartVoiceBlur && state.bg_dof ? state.bg_dof * 6 : 0,
    bgDofTransition.duration ?? 0,
    bgDofTransition.delay ?? 0,
  )
  manager.setBgColorOverlay(
    state.bg_color || null,
    bgColorTransition.duration ?? 0,
    bgColorTransition.delay ?? 0,
  )

  if (!isRuntimeCueChannelEnabled('screen') && state.screen_slide) {
    const slide = state.screen_slide
    manager.setScreenSlide?.(
      slide.type,
      slide.color || '#000000',
      slide.duration ?? 0.5,
      slide.delay ?? 0,
      slide.direction || '6',
    )
  }

  if (!isRuntimeCueChannelEnabled('camera')) {
    if (state.camera_zoom) {
      manager.setCameraZoom(state.camera_zoom)
    } else {
      manager.resetCameraZoom()
    }
  }

  if (!isRuntimeCueChannelEnabled('screen')) {
    if (state.screen_fade) {
      const sf = state.screen_fade
      // Legacy effect_fade and screen_fade historically used separate sprites.
      // Hand the visible color across before the screen fade begins so a later
      // screen_fadeout can reveal an earlier effect_fadein without a black layer
      // remaining above it.
      manager.playScreenEffects?.([{
        type: 'fadeout',
        color: sf.color || '#000000',
        alpha: sf.alpha ?? 1,
        duration: 0,
      }])
      manager.setScreenFade(sf.type, sf.color || '#000000', sf.duration, sf.delay || 0, sf.alpha ?? 1)
    } else {
      manager.clearScreenFade()
    }
  }

  const screenEffects = isRuntimeCueChannelEnabled('screen')
    ? (state.screen_effects || []).filter(effect => effect?.type !== 'fadein' && effect?.type !== 'fadeout')
    : (state.screen_effects || [])
  const screenEffectsKey = `${step?.step_id || ''}:${JSON.stringify(screenEffects)}`
  if (screenEffects.length && screenEffectsKey !== lastScreenEffectsKey) {
    manager.playScreenEffects?.(screenEffects)
    return screenEffectsKey
  }
  if (!screenEffects.length) return ''
  return lastScreenEffectsKey
}
