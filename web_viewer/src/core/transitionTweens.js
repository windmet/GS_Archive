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
  nowMilliseconds,
}) {
  if (!overlay || overlay.destroyed) return null
  return runRafTween({
    durationMs,
    delayMs,
    startValue: startAlpha,
    nowMilliseconds,
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
  nowMilliseconds,
}) {
  if (!overlay || overlay.destroyed) return null
  return runRafTween({
    durationMs,
    delayMs,
    startValue: 0,
    nowMilliseconds,
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
