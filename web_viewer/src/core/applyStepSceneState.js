export function applyStepSceneState({
  manager,
  step,
  state,
  fallbackBg = null,
  lastScreenEffectsKey = '',
}) {
  if (!manager || !state) return lastScreenEffectsKey

  manager.setCameraFilter(null)
  manager.applyBgEffects?.(state.bg_effects || [], state.bg_profile || null)

  const bg = state.bg || fallbackBg
  if (bg) manager.setBackground(bg, state.bg_transition || null)
  else manager.clearBackground()

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

  if (state.screen_slide) {
    const slide = state.screen_slide
    manager.setScreenSlide?.(
      slide.type,
      slide.color || '#000000',
      slide.duration ?? 0.5,
      slide.delay ?? 0,
      slide.direction || '6',
    )
  } else {
    manager.clearScreenSlide?.()
  }

  if (state.camera_zoom) {
    manager.setCameraZoom(state.camera_zoom)
  } else {
    manager.resetCameraZoom()
  }

  if (state.screen_fade) {
    const sf = state.screen_fade
    manager.setScreenFade(sf.type, sf.color, sf.duration, sf.delay || 0, sf.alpha ?? 1)
  } else {
    manager.clearScreenFade()
  }

  const screenEffectsKey = `${step?.step_id || ''}:${JSON.stringify(state.screen_effects || [])}`
  if (state.screen_effects?.length && screenEffectsKey !== lastScreenEffectsKey) {
    manager.playScreenEffects?.(state.screen_effects)
    return screenEffectsKey
  }
  if (!state.screen_effects?.length) return ''
  return lastScreenEffectsKey
}
