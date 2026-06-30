import { easeOutCubic, runRafTween } from './rafTween.js'

export function tweenOverlayFade({
  overlay,
  token,
  isCurrent,
  durationMs,
  delayMs = 0,
  startAlpha,
  endAlpha,
  onFinish,
}) {
  if (!overlay || overlay.destroyed) return null
  return runRafTween({
    durationMs,
    delayMs,
    startValue: startAlpha,
    endValue: endAlpha,
    ease: easeOutCubic,
    shouldStop: () => !isCurrent(token) || !overlay || overlay.destroyed,
    onUpdate: (alpha) => {
      overlay.alpha = alpha
    },
    onComplete: () => {
      onFinish?.()
    },
  })
}

export function tweenOverlaySlide({
  overlay,
  token,
  isCurrent,
  durationMs,
  delayMs = 0,
  start,
  end,
  onFinish,
}) {
  if (!overlay || overlay.destroyed) return null
  return runRafTween({
    durationMs,
    delayMs,
    startValue: 0,
    endValue: 1,
    ease: easeOutCubic,
    shouldStop: () => !isCurrent(token) || !overlay || overlay.destroyed,
    onUpdate: (t) => {
      overlay.x = start.x + (end.x - start.x) * t
      overlay.y = start.y + (end.y - start.y) * t
    },
    onComplete: () => {
      onFinish?.()
    },
  })
}

export function tweenOverlayPunch({
  overlay,
  spineContainer,
  durationMs,
  dir,
}) {
  if (!overlay || overlay.destroyed || !spineContainer) return null
  const baseX = spineContainer.x || 0
  const baseY = spineContainer.y || 0
  return runRafTween({
    durationMs,
    startValue: 0,
    endValue: 1,
    shouldStop: () => !overlay || overlay.destroyed,
    onUpdate: (t) => {
      const shake = (1 - t) * (dir || 1) * Math.sin(t * Math.PI * 8) * 9
      spineContainer.x = baseX + shake
      spineContainer.y = baseY + (1 - t) * Math.sin(t * Math.PI * 10) * 3
      overlay.alpha = 0.55 * Math.max(0, 1 - t * 2.4)
    },
    onComplete: () => {
      spineContainer.x = baseX
      spineContainer.y = baseY
      overlay.alpha = 0
      overlay.visible = false
    },
  })
}
